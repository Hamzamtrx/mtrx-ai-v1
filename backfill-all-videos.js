/**
 * Backfill All Videos — Process EVERY video ad in the database
 *
 * This script:
 * 1. Fetches missing video_ids from Graph API
 * 2. Transcribes all video ads with Whisper
 * 3. Analyzes all video ads with Gemini
 * 4. Extracts structured tags (angle, format, creator type, etc.)
 *
 * Run with: node backfill-all-videos.js [brandId] [--skip-transcribe] [--skip-visuals] [--limit=N]
 *
 * Progress is saved, so you can stop and resume anytime.
 */

require('dotenv').config();

const { getDb } = require('./src/database/db');
const { getAccessToken } = require('./src/facebook/data/data-sync');
const { GraphApiClient } = require('./src/facebook/data/graph-api');
const { transcribeAd } = require('./src/facebook/data/transcription');
const { analyzeVideo } = require('./src/facebook/data/video-analysis');

const BRAND_ID = parseInt(process.argv[2]) || 1;
const SKIP_TRANSCRIBE = process.argv.includes('--skip-transcribe');
const SKIP_VISUALS = process.argv.includes('--skip-visuals');
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : 0; // 0 = no limit

// Rate limiting
const DELAY_BETWEEN_ADS = 2000; // 2 seconds between ads
const DELAY_BETWEEN_API_CALLS = 500; // 500ms between Graph API calls

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const db = getDb();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('           BACKFILL ALL VIDEOS — Full Processing Pipeline');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Get stats
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN ad_name LIKE '%VID%' THEN 1 ELSE 0 END) as video_ads,
      SUM(CASE WHEN video_id IS NOT NULL THEN 1 ELSE 0 END) as has_video_id,
      SUM(CASE WHEN video_transcript IS NOT NULL THEN 1 ELSE 0 END) as has_transcript,
      SUM(CASE WHEN video_description IS NOT NULL THEN 1 ELSE 0 END) as has_visuals
    FROM fb_ads WHERE brand_id = ? AND spend > 0
  `).get(BRAND_ID);

  console.log('CURRENT STATUS:');
  console.log(`  Total ads with spend: ${stats.total}`);
  console.log(`  Video ads (VID in name): ${stats.video_ads}`);
  console.log(`  Have video_id: ${stats.has_video_id}`);
  console.log(`  Have transcript: ${stats.has_transcript}`);
  console.log(`  Have visual analysis: ${stats.has_visuals}`);
  console.log('');

  const pendingVideoId = stats.video_ads - stats.has_video_id;
  const pendingTranscript = stats.has_video_id - stats.has_transcript;
  const pendingVisuals = stats.has_video_id - stats.has_visuals;

  console.log('WORK TO DO:');
  console.log(`  Need video_id: ${pendingVideoId}`);
  console.log(`  Need transcript: ${SKIP_TRANSCRIBE ? 'SKIPPED' : pendingTranscript}`);
  console.log(`  Need visual analysis: ${SKIP_VISUALS ? 'SKIPPED' : pendingVisuals}`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════
  // STEP 1: Fetch missing video_ids
  // ═══════════════════════════════════════════════════════════════

  console.log('─────────────────────────────────────────────────────────────────');
  console.log('STEP 1: Fetching missing video_ids from Graph API');
  console.log('─────────────────────────────────────────────────────────────────\n');

  const adsNeedingVideoId = db.prepare(`
    SELECT fb_ad_id, ad_name FROM fb_ads
    WHERE brand_id = ? AND spend > 0
    AND ad_name LIKE '%VID%'
    AND video_id IS NULL
    ORDER BY spend DESC
    ${LIMIT > 0 ? `LIMIT ${LIMIT}` : ''}
  `).all(BRAND_ID);

  if (adsNeedingVideoId.length === 0) {
    console.log('  ✓ All video ads have video_id\n');
  } else {
    console.log(`  Processing ${adsNeedingVideoId.length} ads...\n`);

    let { accessToken, adAccountId } = getAccessToken(BRAND_ID);
    const client = new GraphApiClient(accessToken);

    let fetched = 0;
    let failed = 0;

    for (let i = 0; i < adsNeedingVideoId.length; i++) {
      const ad = adsNeedingVideoId[i];
      const progress = `[${i + 1}/${adsNeedingVideoId.length}]`;

      try {
        const data = await client.request(`/${adAccountId}/ads`, {
          filtering: JSON.stringify([{ field: 'id', operator: 'EQUAL', value: ad.fb_ad_id }]),
          fields: 'creative{video_id}',
        });

        const videoId = data?.data?.[0]?.creative?.video_id || null;

        if (videoId) {
          db.prepare('UPDATE fb_ads SET video_id = ? WHERE brand_id = ? AND fb_ad_id = ?')
            .run(videoId, BRAND_ID, ad.fb_ad_id);
          fetched++;
          console.log(`  ${progress} ✓ ${ad.ad_name.substring(0, 50)}...`);
        } else {
          failed++;
          console.log(`  ${progress} ✗ No video_id returned for ${ad.ad_name.substring(0, 40)}...`);
        }
      } catch (err) {
        failed++;
        console.log(`  ${progress} ✗ Error: ${err.message.substring(0, 60)}`);
      }

      await sleep(DELAY_BETWEEN_API_CALLS);
    }

    console.log(`\n  Summary: ${fetched} fetched, ${failed} failed\n`);
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 2: Transcribe with Whisper
  // ═══════════════════════════════════════════════════════════════

  if (!SKIP_TRANSCRIBE) {
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('STEP 2: Transcribing videos with Whisper');
    console.log('─────────────────────────────────────────────────────────────────\n');

    const adsNeedingTranscript = db.prepare(`
      SELECT fb_ad_id, ad_name, video_id FROM fb_ads
      WHERE brand_id = ? AND video_id IS NOT NULL AND video_transcript IS NULL
      ORDER BY spend DESC
      ${LIMIT > 0 ? `LIMIT ${LIMIT}` : ''}
    `).all(BRAND_ID);

    if (adsNeedingTranscript.length === 0) {
      console.log('  ✓ All video ads have transcripts\n');
    } else {
      console.log(`  Processing ${adsNeedingTranscript.length} ads...\n`);

      let transcribed = 0;
      let failed = 0;

      for (let i = 0; i < adsNeedingTranscript.length; i++) {
        const ad = adsNeedingTranscript[i];
        const progress = `[${i + 1}/${adsNeedingTranscript.length}]`;

        try {
          const result = await transcribeAd(BRAND_ID, ad.fb_ad_id);

          if (result.success) {
            transcribed++;
            const preview = (result.transcript || '').substring(0, 50).replace(/\n/g, ' ');
            console.log(`  ${progress} ✓ ${ad.ad_name.substring(0, 40)}... → "${preview}..."`);
          } else {
            failed++;
            console.log(`  ${progress} ✗ ${ad.ad_name.substring(0, 40)}... → ${result.error}`);
          }
        } catch (err) {
          failed++;
          console.log(`  ${progress} ✗ Error: ${err.message.substring(0, 60)}`);
        }

        await sleep(DELAY_BETWEEN_ADS);
      }

      console.log(`\n  Summary: ${transcribed} transcribed, ${failed} failed\n`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 3: Analyze visuals with Gemini
  // ═══════════════════════════════════════════════════════════════

  if (!SKIP_VISUALS) {
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('STEP 3: Analyzing visuals with Gemini');
    console.log('─────────────────────────────────────────────────────────────────\n');

    const adsNeedingVisuals = db.prepare(`
      SELECT fb_ad_id, ad_name, video_id FROM fb_ads
      WHERE brand_id = ? AND video_id IS NOT NULL AND video_description IS NULL
      ORDER BY spend DESC
      ${LIMIT > 0 ? `LIMIT ${LIMIT}` : ''}
    `).all(BRAND_ID);

    if (adsNeedingVisuals.length === 0) {
      console.log('  ✓ All video ads have visual analysis\n');
    } else {
      console.log(`  Processing ${adsNeedingVisuals.length} ads...\n`);

      let analyzed = 0;
      let failed = 0;

      for (let i = 0; i < adsNeedingVisuals.length; i++) {
        const ad = adsNeedingVisuals[i];
        const progress = `[${i + 1}/${adsNeedingVisuals.length}]`;

        try {
          const result = await analyzeVideo(BRAND_ID, ad.fb_ad_id);

          if (result.success) {
            analyzed++;
            console.log(`  ${progress} ✓ ${ad.ad_name.substring(0, 50)}... (${result.description?.length || 0} chars)`);
          } else {
            failed++;
            console.log(`  ${progress} ✗ ${ad.ad_name.substring(0, 40)}... → ${result.error}`);
          }
        } catch (err) {
          failed++;
          console.log(`  ${progress} ✗ Error: ${err.message.substring(0, 60)}`);
        }

        await sleep(DELAY_BETWEEN_ADS);
      }

      console.log(`\n  Summary: ${analyzed} analyzed, ${failed} failed\n`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // FINAL STATS
  // ═══════════════════════════════════════════════════════════════

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                         FINAL STATS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const finalStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN ad_name LIKE '%VID%' THEN 1 ELSE 0 END) as video_ads,
      SUM(CASE WHEN video_id IS NOT NULL THEN 1 ELSE 0 END) as has_video_id,
      SUM(CASE WHEN video_transcript IS NOT NULL THEN 1 ELSE 0 END) as has_transcript,
      SUM(CASE WHEN video_description IS NOT NULL THEN 1 ELSE 0 END) as has_visuals
    FROM fb_ads WHERE brand_id = ? AND spend > 0
  `).get(BRAND_ID);

  console.log(`  Video ads: ${finalStats.video_ads}`);
  console.log(`  With video_id: ${finalStats.has_video_id} (${(finalStats.has_video_id / finalStats.video_ads * 100).toFixed(1)}%)`);
  console.log(`  With transcript: ${finalStats.has_transcript} (${(finalStats.has_transcript / finalStats.video_ads * 100).toFixed(1)}%)`);
  console.log(`  With visual analysis: ${finalStats.has_visuals} (${(finalStats.has_visuals / finalStats.video_ads * 100).toFixed(1)}%)`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════\n');

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
