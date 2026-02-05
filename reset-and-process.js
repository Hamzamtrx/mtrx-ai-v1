/**
 * Reset video analysis and re-process with new detailed prompt
 * Run with: node reset-and-process.js
 */

require('dotenv').config();

const { getDb } = require('./src/database/db');
const { batchTranscribe } = require('./src/facebook/data/transcription');
const { batchAnalyze } = require('./src/facebook/data/video-analysis');
const { getAccessToken } = require('./src/facebook/data/data-sync');
const { GraphApiClient } = require('./src/facebook/data/graph-api');

const BRAND_ID = 1;
const LIMIT = 15;

async function main() {
  const db = getDb();

  console.log('=== Step 1: Fixing missing video_ids ===\n');

  // Find VID ads missing video_id
  const vidsWithoutId = db.prepare(`
    SELECT id, fb_ad_id, ad_name
    FROM fb_ads
    WHERE brand_id = ?
      AND spend > 0
      AND ad_name LIKE '%VID%'
      AND (video_id IS NULL OR video_id = '')
    ORDER BY spend DESC
    LIMIT 20
  `).all(BRAND_ID);

  console.log(`Found ${vidsWithoutId.length} VID ads missing video_id`);

  if (vidsWithoutId.length > 0) {
    try {
      const { accessToken, adAccountId } = getAccessToken(BRAND_ID);
      const client = new GraphApiClient(accessToken);

      for (const ad of vidsWithoutId) {
        try {
          const data = await client.request(`/${ad.fb_ad_id}`, {
            fields: 'creative{video_id}'
          });
          const videoId = data.creative?.video_id;
          if (videoId) {
            db.prepare('UPDATE fb_ads SET video_id = ? WHERE id = ?').run(videoId, ad.id);
            console.log(`  ✓ Fixed: ${ad.ad_name.substring(0, 40)}... -> ${videoId}`);
          } else {
            console.log(`  ✗ No video_id: ${ad.ad_name.substring(0, 40)}...`);
          }
        } catch (err) {
          console.log(`  ✗ Error: ${ad.ad_name.substring(0, 40)}... - ${err.message}`);
        }
      }
    } catch (err) {
      console.log(`Token error: ${err.message}`);
    }
  }

  console.log('\n=== Step 2: Clearing old video descriptions for re-analysis ===\n');

  // Clear video_description for top ads so they get re-analyzed with new prompt
  const cleared = db.prepare(`
    UPDATE fb_ads
    SET video_description = NULL
    WHERE brand_id = ?
      AND video_id IS NOT NULL
      AND spend > 0
  `).run(BRAND_ID);
  console.log(`Cleared ${cleared.changes} video descriptions`);

  console.log('\n=== Step 3: Transcribing videos (Whisper) ===\n');

  try {
    const transcriptResult = await batchTranscribe(BRAND_ID, LIMIT);
    console.log(`Transcribed: ${transcriptResult.succeeded}/${transcriptResult.processed}`);
  } catch (err) {
    console.error('Transcription error:', err.message);
  }

  console.log('\n=== Step 4: Analyzing videos (Gemini - new detailed prompt) ===\n');

  try {
    const visualResult = await batchAnalyze(BRAND_ID, LIMIT);
    console.log(`Analyzed: ${visualResult.succeeded}/${visualResult.processed}`);
  } catch (err) {
    console.error('Visual analysis error:', err.message);
  }

  console.log('\n=== Done! Now run "Analyze with AI" ===');

  // Show final status
  const finalStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN video_id IS NOT NULL THEN 1 ELSE 0 END) as with_video_id,
      SUM(CASE WHEN video_transcript IS NOT NULL THEN 1 ELSE 0 END) as with_transcript,
      SUM(CASE WHEN video_description IS NOT NULL THEN 1 ELSE 0 END) as with_visuals
    FROM fb_ads
    WHERE brand_id = ? AND spend > 0
    ORDER BY spend DESC
    LIMIT 15
  `).get(BRAND_ID);

  console.log(`\nTop 15 ads status:`);
  console.log(`  Video IDs: ${finalStats.with_video_id}/15`);
  console.log(`  Transcripts: ${finalStats.with_transcript}/15`);
  console.log(`  Visual analysis: ${finalStats.with_visuals}/15`);

  process.exit(0);
}

main();
