/**
 * Video Transcription Service — uses OpenAI Whisper to transcribe Facebook video ads
 * Transcripts are stored permanently in fb_ads.video_transcript
 */

const { getDb } = require('../../database/db');
const { getAccessToken } = require('./data-sync');
const { GraphApiClient } = require('./graph-api');
const OpenAI = require('openai');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const MAX_VIDEO_SIZE = 25 * 1024 * 1024; // 25MB Whisper limit
const YTDLP_PATH = '/Users/hss/Library/Python/3.9/bin/yt-dlp';

/**
 * Download a Facebook video using yt-dlp (bypasses Graph API permissions)
 * @param {string} videoId - Facebook video ID
 * @returns {Buffer|null} Video file buffer
 */
async function downloadVideoWithYtdlp(videoId) {
  const tmpDir = os.tmpdir();
  const outFile = path.join(tmpDir, `fb_video_${videoId}.mp4`);

  // Clean up any previous file
  try { fs.unlinkSync(outFile); } catch {}

  const videoUrl = `https://www.facebook.com/reel/${videoId}`;
  const videoUrlAlt = `https://www.facebook.com/watch/?v=${videoId}`;

  // Try reel URL first, then watch URL
  for (const url of [videoUrl, videoUrlAlt]) {
    try {
      await new Promise((resolve, reject) => {
        execFile(YTDLP_PATH, [
          '-f', 'worst[ext=mp4]/worst',  // smallest quality to save bandwidth
          '--no-playlist',
          '-o', outFile,
          '--no-warnings',
          '--socket-timeout', '30',
          url,
        ], { timeout: 120000 }, (err, stdout, stderr) => {
          if (err) reject(new Error(stderr || err.message));
          else resolve(stdout);
        });
      });

      if (fs.existsSync(outFile)) {
        const buffer = fs.readFileSync(outFile);
        fs.unlinkSync(outFile);
        console.log(`[Transcription] Downloaded video via yt-dlp (${(buffer.length / 1024 / 1024).toFixed(1)}MB) from ${url}`);
        return buffer;
      }
    } catch (err) {
      console.log(`[Transcription] yt-dlp failed for ${url}: ${err.message.substring(0, 200)}`);
    }
  }

  return null;
}

/**
 * Transcribe a single video ad
 * @param {number} brandId
 * @param {string} fbAdId - The Facebook ad ID
 * @returns {object} { success, transcript, error }
 */
async function transcribeAd(brandId, fbAdId) {
  const db = getDb();

  // Get the ad
  const ad = db.prepare('SELECT fb_ad_id, ad_name, video_id, video_transcript FROM fb_ads WHERE brand_id = ? AND fb_ad_id = ?').get(brandId, fbAdId);
  if (!ad) return { success: false, error: 'Ad not found' };
  if (ad.video_transcript !== null) return { success: true, transcript: ad.video_transcript, cached: true };

  // Get access token and create Graph API client
  const { accessToken, adAccountId } = getAccessToken(brandId);
  const client = new GraphApiClient(accessToken);

  // If video_id is missing, try to fetch it via the ad account ads endpoint (same as sync)
  if (!ad.video_id) {
    console.log(`[Transcription] video_id missing for ad ${fbAdId}, fetching via ad account endpoint...`);
    try {
      const data = await client.request(`/${adAccountId}/ads`, {
        filtering: JSON.stringify([{ field: 'id', operator: 'EQUAL', value: fbAdId }]),
        fields: 'creative{video_id}',
      });
      const videoId = data?.data?.[0]?.creative?.video_id || null;
      if (videoId) {
        db.prepare('UPDATE fb_ads SET video_id = ? WHERE brand_id = ? AND fb_ad_id = ?').run(videoId, brandId, fbAdId);
        ad.video_id = videoId;
        console.log(`[Transcription] Found and saved video_id ${videoId} for ad ${fbAdId}`);
      } else {
        return { success: false, error: 'Facebook did not return a video_id for this ad' };
      }
    } catch (err) {
      console.error(`[Transcription] Failed to fetch video_id for ad ${fbAdId}:`, err.message);
      return { success: false, error: 'Could not fetch video info: ' + err.message };
    }
  }

  // Download video — try Graph API first, then yt-dlp fallback
  let buffer = null;

  // Attempt 1: Graph API direct video source
  try {
    const sourceUrl = await client.getVideoSource(ad.video_id);
    if (sourceUrl) {
      console.log(`[Transcription] Downloading video ${ad.video_id} via Graph API`);
      const videoRes = await fetch(sourceUrl);
      if (videoRes.ok) {
        buffer = Buffer.from(await videoRes.arrayBuffer());
      }
    }
  } catch (err) {
    console.log(`[Transcription] Graph API video source failed: ${err.message}`);
  }

  // Attempt 2: yt-dlp (bypasses Graph API permissions)
  if (!buffer) {
    console.log(`[Transcription] Trying yt-dlp for video ${ad.video_id}...`);
    buffer = await downloadVideoWithYtdlp(ad.video_id);
  }

  if (!buffer) return { success: false, error: 'Could not download video. Graph API permission denied and yt-dlp fallback failed.' };

  if (buffer.length > MAX_VIDEO_SIZE) {
    return { success: false, error: `Video too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Max is 25MB.` };
  }

  // Send to OpenAI Whisper
  console.log(`[Transcription] Sending ${(buffer.length / 1024 / 1024).toFixed(1)}MB to Whisper for ad ${fbAdId}`);
  const openai = new OpenAI();
  const file = new File([buffer], 'video.mp4', { type: 'video/mp4' });

  const transcription = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file,
  });

  const transcript = transcription.text || '';

  // Store in database
  db.prepare('UPDATE fb_ads SET video_transcript = ? WHERE brand_id = ? AND fb_ad_id = ?').run(transcript, brandId, fbAdId);
  console.log(`[Transcription] Stored transcript for ad ${fbAdId} (${transcript.length} chars)`);

  return { success: true, transcript };
}

/**
 * Batch transcribe video ads without transcripts
 * Prioritized: winners > potential > new > losers, then by spend DESC
 * @param {number} brandId
 * @param {number} limit - Max ads to process (default 10, max 50)
 * @returns {object} { processed, succeeded, failed, results }
 */
async function batchTranscribe(brandId, limit = 10) {
  limit = Math.min(Math.max(1, limit), 50);
  const db = getDb();

  const ads = db.prepare(`
    SELECT fb_ad_id, video_id FROM fb_ads
    WHERE brand_id = ? AND video_id IS NOT NULL AND video_transcript IS NULL
    ORDER BY
      CASE classification
        WHEN 'winner' THEN 1
        WHEN 'potential' THEN 2
        WHEN 'new' THEN 3
        WHEN 'loser' THEN 4
        ELSE 5
      END,
      spend DESC
    LIMIT ?
  `).all(brandId, limit);

  const results = [];
  for (const ad of ads) {
    try {
      const result = await transcribeAd(brandId, ad.fb_ad_id);
      results.push({ adId: ad.fb_ad_id, ...result });
    } catch (err) {
      console.error(`[Transcription] Error transcribing ad ${ad.fb_ad_id}:`, err.message);
      results.push({ adId: ad.fb_ad_id, success: false, error: err.message });
    }
  }

  return {
    processed: results.length,
    succeeded: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  };
}

/**
 * Get transcription stats for a brand
 * @param {number} brandId
 * @returns {object} { totalVideoAds, transcribed, pending }
 */
function getTranscriptionStats(brandId) {
  const db = getDb();

  const stats = db.prepare(`
    SELECT
      SUM(CASE WHEN video_id IS NOT NULL THEN 1 ELSE 0 END) as totalVideoAds,
      SUM(CASE WHEN video_id IS NOT NULL AND video_transcript IS NOT NULL THEN 1 ELSE 0 END) as transcribed,
      SUM(CASE WHEN video_id IS NOT NULL AND video_transcript IS NULL THEN 1 ELSE 0 END) as pending
    FROM fb_ads WHERE brand_id = ?
  `).get(brandId);

  return {
    totalVideoAds: stats.totalVideoAds || 0,
    transcribed: stats.transcribed || 0,
    pending: stats.pending || 0,
  };
}

module.exports = { transcribeAd, batchTranscribe, getTranscriptionStats, downloadVideoWithYtdlp };
