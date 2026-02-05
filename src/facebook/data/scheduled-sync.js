/**
 * Scheduled Sync Service — Handles automated data syncing and processing
 *
 * ARCHITECTURE:
 *
 * 1. CREATIVE PROCESSING (One-time per ad)
 *    - When a new ad enters the system, it gets:
 *      - Transcribed (Whisper)
 *      - Visually analyzed (Gemini)
 *      - Auto-tagged (angle, format, awareness, creator type)
 *    - This only happens ONCE because the creative doesn't change
 *
 * 2. PERFORMANCE SYNC (Every 3 days)
 *    - Pulls spend, CPA, ROAS, purchases from Facebook
 *    - Recalculates Winner Scores
 *    - Checks for breakout ads
 *    - Cost: Near-zero (just API calls)
 *
 * 3. FULL ANALYSIS (Weekly or on-demand)
 *    - Runs the 8-section strategic framework
 *    - Combines performance data with creative tags
 *    - Generates the complete insights report
 *
 * TRIGGER OPTIONS:
 * - Manual: Call syncPerformance() or runFullAnalysis()
 * - Cron/n8n: POST /api/facebook/scheduled/sync-performance
 * - Webhook: POST /api/facebook/scheduled/full-analysis
 */

const { getDb } = require('../../database/db');
const { syncBrand, getAccessToken } = require('./data-sync');
const { transcribeAd } = require('./transcription');
const { analyzeVideo } = require('./video-analysis');
const { generateStrategicInsights } = require('../analysis/strategic-insights');
const { classifyAllAds } = require('../analysis/classifier');

// Breakout thresholds
const BREAKOUT_SPEND_INCREASE_PCT = 300; // 300% increase
const BREAKOUT_SPEND_THRESHOLD = 5000; // $5K absolute threshold

/**
 * Sync performance data (spend, CPA, ROAS) for all ads
 * Run this every 3 days via cron/n8n
 */
async function syncPerformance(brandId) {
  const db = getDb();

  console.log(`[ScheduledSync] Starting performance sync for brand ${brandId}`);

  // Store previous spend values for breakout detection
  const previousSpend = db.prepare(`
    SELECT fb_ad_id, spend, ad_name FROM fb_ads
    WHERE brand_id = ? AND spend > 0
  `).all(brandId);

  const spendMap = {};
  for (const ad of previousSpend) {
    spendMap[ad.fb_ad_id] = { spend: ad.spend, name: ad.ad_name };
  }

  // Sync latest data from Facebook
  const syncResult = await syncBrand(brandId, 'last_90d');
  console.log(`[ScheduledSync] Synced ${syncResult.synced} ads`);

  // Re-classify all ads with fresh data
  classifyAllAds(brandId);

  // Detect breakout ads
  const breakoutAds = detectBreakoutAds(brandId, spendMap);

  // Find new ads that need processing
  const newAds = await processNewAds(brandId);

  return {
    success: true,
    synced: syncResult.synced,
    breakoutAds,
    newAdsProcessed: newAds.processed,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Detect ads with breakout performance
 * Returns ads that either:
 * - Increased spend by 300%+ since last sync
 * - Crossed the $5K spend threshold
 */
function detectBreakoutAds(brandId, previousSpendMap) {
  const db = getDb();

  const currentAds = db.prepare(`
    SELECT fb_ad_id, ad_name, spend, roas, cpa, classification
    FROM fb_ads WHERE brand_id = ? AND spend > 1000
    ORDER BY spend DESC
  `).all(brandId);

  const breakouts = [];

  for (const ad of currentAds) {
    const prev = previousSpendMap[ad.fb_ad_id];

    // Check for 300%+ increase
    if (prev && prev.spend > 0) {
      const increasePercent = ((ad.spend - prev.spend) / prev.spend) * 100;
      if (increasePercent >= BREAKOUT_SPEND_INCREASE_PCT) {
        breakouts.push({
          type: 'spend_increase',
          adId: ad.fb_ad_id,
          adName: ad.ad_name,
          previousSpend: prev.spend,
          currentSpend: ad.spend,
          increasePercent: increasePercent.toFixed(0),
          roas: ad.roas,
          cpa: ad.cpa,
        });
      }
    }

    // Check for crossing $5K threshold (was below, now above)
    if (prev && prev.spend < BREAKOUT_SPEND_THRESHOLD && ad.spend >= BREAKOUT_SPEND_THRESHOLD) {
      breakouts.push({
        type: 'threshold_crossed',
        adId: ad.fb_ad_id,
        adName: ad.ad_name,
        threshold: BREAKOUT_SPEND_THRESHOLD,
        currentSpend: ad.spend,
        roas: ad.roas,
        cpa: ad.cpa,
      });
    }
  }

  if (breakouts.length > 0) {
    console.log(`[ScheduledSync] Detected ${breakouts.length} breakout ads:`);
    for (const b of breakouts) {
      if (b.type === 'spend_increase') {
        console.log(`  🚀 ${b.adName.substring(0, 50)}... — ${b.increasePercent}% increase ($${b.previousSpend} → $${b.currentSpend})`);
      } else {
        console.log(`  💰 ${b.adName.substring(0, 50)}... — crossed $${b.threshold} threshold`);
      }
    }
  }

  return breakouts;
}

/**
 * Process new ads that haven't been transcribed/analyzed
 * Runs automatically after each sync
 */
async function processNewAds(brandId, limit = 20) {
  const db = getDb();

  // Find video ads without transcripts
  const unprocessedAds = db.prepare(`
    SELECT fb_ad_id, ad_name, video_id FROM fb_ads
    WHERE brand_id = ? AND video_id IS NOT NULL
    AND (video_transcript IS NULL OR video_description IS NULL)
    ORDER BY spend DESC
    LIMIT ?
  `).all(brandId, limit);

  console.log(`[ScheduledSync] Found ${unprocessedAds.length} ads needing processing`);

  let processed = 0;
  const results = [];

  for (const ad of unprocessedAds) {
    try {
      // Transcribe if needed
      const adData = db.prepare('SELECT video_transcript, video_description FROM fb_ads WHERE fb_ad_id = ?').get(ad.fb_ad_id);

      if (!adData.video_transcript) {
        console.log(`[ScheduledSync] Transcribing: ${ad.ad_name.substring(0, 40)}...`);
        await transcribeAd(brandId, ad.fb_ad_id);
      }

      if (!adData.video_description) {
        console.log(`[ScheduledSync] Analyzing visuals: ${ad.ad_name.substring(0, 40)}...`);
        await analyzeVideo(brandId, ad.fb_ad_id);
      }

      processed++;
      results.push({ adId: ad.fb_ad_id, success: true });
    } catch (err) {
      console.error(`[ScheduledSync] Error processing ${ad.fb_ad_id}:`, err.message);
      results.push({ adId: ad.fb_ad_id, success: false, error: err.message });
    }
  }

  return { processed, results };
}

/**
 * Run full strategic analysis
 * Run this weekly or on-demand before planning next batch
 */
async function runFullAnalysis(brandId) {
  console.log(`[ScheduledSync] Running full analysis for brand ${brandId}`);

  // Re-classify with latest data
  classifyAllAds(brandId);

  // Generate strategic insights
  const insights = await generateStrategicInsights(brandId);

  return {
    success: insights.success,
    insights: insights.insights,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get sync status for a brand
 */
function getSyncStatus(brandId) {
  const db = getDb();

  const conn = db.prepare(`
    SELECT last_sync_at FROM fb_connections WHERE brand_id = ?
  `).get(brandId);

  const adStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN ad_name LIKE '%VID%' THEN 1 ELSE 0 END) as video_ads,
      SUM(CASE WHEN video_id IS NOT NULL THEN 1 ELSE 0 END) as has_video_id,
      SUM(CASE WHEN video_transcript IS NOT NULL THEN 1 ELSE 0 END) as has_transcript,
      SUM(CASE WHEN video_description IS NOT NULL THEN 1 ELSE 0 END) as has_visuals
    FROM fb_ads WHERE brand_id = ? AND spend > 0
  `).get(brandId);

  const processingComplete = adStats.has_video_id > 0 &&
    adStats.has_transcript >= adStats.has_video_id * 0.9 && // 90%+ transcribed
    adStats.has_visuals >= adStats.has_video_id * 0.9; // 90%+ analyzed

  return {
    lastSync: conn?.last_sync_at,
    totalAds: adStats.total,
    videoAds: adStats.video_ads,
    processed: {
      hasVideoId: adStats.has_video_id,
      hasTranscript: adStats.has_transcript,
      hasVisuals: adStats.has_visuals,
    },
    processingComplete,
    coverage: {
      videoIdPct: ((adStats.has_video_id / adStats.video_ads) * 100).toFixed(1),
      transcriptPct: ((adStats.has_transcript / adStats.has_video_id) * 100).toFixed(1),
      visualsPct: ((adStats.has_visuals / adStats.has_video_id) * 100).toFixed(1),
    },
  };
}

module.exports = {
  syncPerformance,
  detectBreakoutAds,
  processNewAds,
  runFullAnalysis,
  getSyncStatus,
  BREAKOUT_SPEND_INCREASE_PCT,
  BREAKOUT_SPEND_THRESHOLD,
};
