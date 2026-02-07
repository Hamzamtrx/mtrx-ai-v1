/**
 * Process Existing Videos — Run Whisper + Gemini on ads that already have video_ids
 *
 * Use this IN PARALLEL with backfill-all-videos.js (which fetches video_ids).
 * This script only does Steps 2 + 3 on ads that already have video_ids stored.
 *
 * Run with: node backfill-process-existing.js [brandId] [--skip-transcribe] [--skip-visuals] [--limit=N]
 */

require('dotenv').config();

const { getDb } = require('./src/database/db');
const { transcribeAd } = require('./src/facebook/data/transcription');
const { analyzeVideo } = require('./src/facebook/data/video-analysis');

const BRAND_ID = parseInt(process.argv[2]) || 1;
const SKIP_TRANSCRIBE = process.argv.includes('--skip-transcribe');
const SKIP_VISUALS = process.argv.includes('--skip-visuals');
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1]) : 0;

const DELAY_BETWEEN_ADS = 2000;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const db = getDb();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('    PROCESS EXISTING VIDEOS — Whisper + Gemini (parallel)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const stats = db.prepare(`
    SELECT
      SUM(CASE WHEN video_id IS NOT NULL THEN 1 ELSE 0 END) as has_video_id,
      SUM(CASE WHEN video_transcript IS NOT NULL THEN 1 ELSE 0 END) as has_transcript,
      SUM(CASE WHEN video_description IS NOT NULL THEN 1 ELSE 0 END) as has_visuals
    FROM fb_ads WHERE brand_id = ? AND spend > 0
  `).get(BRAND_ID);

  console.log(`  Ads with video_id: ${stats.has_video_id}`);
  console.log(`  Already transcribed: ${stats.has_transcript}`);
  console.log(`  Already have visuals: ${stats.has_visuals}`);
  console.log(`  Need transcript: ${stats.has_video_id - stats.has_transcript}`);
  console.log(`  Need visuals: ${stats.has_video_id - stats.has_visuals}`);
  console.log('');

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
          console.log(`  ${progress} ✗ Error: ${err.message.substring(0, 80)}`);
        }

        await sleep(DELAY_BETWEEN_ADS);
      }

      console.log(`\n  Whisper Summary: ${transcribed} transcribed, ${failed} failed\n`);
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
          console.log(`  ${progress} ✗ Error: ${err.message.substring(0, 80)}`);
        }

        await sleep(DELAY_BETWEEN_ADS);
      }

      console.log(`\n  Gemini Summary: ${analyzed} analyzed, ${failed} failed\n`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // FINAL STATS
  // ═══════════════════════════════════════════════════════════════

  const finalStats = db.prepare(`
    SELECT
      SUM(CASE WHEN video_id IS NOT NULL THEN 1 ELSE 0 END) as has_video_id,
      SUM(CASE WHEN video_transcript IS NOT NULL THEN 1 ELSE 0 END) as has_transcript,
      SUM(CASE WHEN video_description IS NOT NULL THEN 1 ELSE 0 END) as has_visuals
    FROM fb_ads WHERE brand_id = ? AND spend > 0
  `).get(BRAND_ID);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                         FINAL STATS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  With video_id: ${finalStats.has_video_id}`);
  console.log(`  With transcript: ${finalStats.has_transcript}`);
  console.log(`  With visual analysis: ${finalStats.has_visuals}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
