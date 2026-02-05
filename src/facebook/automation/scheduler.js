/**
 * Scheduler — cron jobs for automated data sync and analysis
 * - Daily 6am: sync all active connections, re-classify, re-detect patterns
 * - Every 4h: check for fatigued ads (CTR declining)
 */

const cron = require('node-cron');
const { getDb } = require('../../database/db');
const { syncBrand, syncDailyInsights } = require('../data/data-sync');
const { classifyAllAds } = require('../analysis/classifier');

let dailySyncJob = null;
let fatigueCheckJob = null;

/**
 * Start all scheduled jobs
 */
function startScheduler() {
  console.log('[Scheduler] Starting Facebook Ads scheduler');

  // Daily at 6am: full sync + classify for all active brands
  dailySyncJob = cron.schedule('0 6 * * *', async () => {
    console.log('[Scheduler] Running daily sync...');
    await syncAllBrands();
  }, { timezone: 'America/New_York' });

  // Every 4 hours: fatigue check
  fatigueCheckJob = cron.schedule('0 */4 * * *', async () => {
    console.log('[Scheduler] Running fatigue check...');
    await checkFatigueAllBrands();
  }, { timezone: 'America/New_York' });

  console.log('[Scheduler] Scheduled: daily sync at 6am ET, fatigue check every 4h');
}

/**
 * Stop all scheduled jobs
 */
function stopScheduler() {
  if (dailySyncJob) { dailySyncJob.stop(); dailySyncJob = null; }
  if (fatigueCheckJob) { fatigueCheckJob.stop(); fatigueCheckJob = null; }
  console.log('[Scheduler] Stopped all jobs');
}

/**
 * Sync all brands with active Facebook connections
 */
async function syncAllBrands() {
  try {
    const db = getDb();
    const connections = db.prepare(`
      SELECT brand_id FROM fb_connections
      WHERE status = 'active' AND ad_account_id IS NOT NULL
    `).all();

    console.log(`[Scheduler] Syncing ${connections.length} active brands`);

    for (const conn of connections) {
      try {
        await syncBrand(conn.brand_id);
        await syncDailyInsights(conn.brand_id);
        classifyAllAds(conn.brand_id);
        console.log(`[Scheduler] Brand ${conn.brand_id} synced and classified`);
      } catch (err) {
        console.error(`[Scheduler] Error syncing brand ${conn.brand_id}:`, err.message);
        // Mark as expired if token issue
        if (err.message.includes('expired') || err.message.includes('OAuthException')) {
          db.prepare("UPDATE fb_connections SET status = 'expired' WHERE brand_id = ?").run(conn.brand_id);
        }
      }
    }
  } catch (err) {
    console.error('[Scheduler] syncAllBrands error:', err.message);
  }
}

/**
 * Check for fatigued ads across all brands
 */
async function checkFatigueAllBrands() {
  try {
    const db = getDb();
    const connections = db.prepare(`
      SELECT brand_id FROM fb_connections
      WHERE status = 'active' AND ad_account_id IS NOT NULL
    `).all();

    for (const conn of connections) {
      try {
        // Re-classify will detect fatigue from CTR trends
        classifyAllAds(conn.brand_id);

        // Log newly fatigued ads
        const fatigued = db.prepare(`
          SELECT ad_name, cpa, ctr FROM fb_ads
          WHERE brand_id = ? AND classification = 'fatigued'
        `).all(conn.brand_id);

        if (fatigued.length > 0) {
          console.log(`[Scheduler] Brand ${conn.brand_id}: ${fatigued.length} fatigued ads detected`);
          fatigued.forEach(ad => {
            console.log(`  - ${ad.ad_name} (CPA: $${ad.cpa?.toFixed(2)}, CTR: ${ad.ctr?.toFixed(2)}%)`);
          });
        }
      } catch (err) {
        console.error(`[Scheduler] Fatigue check error for brand ${conn.brand_id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[Scheduler] checkFatigueAllBrands error:', err.message);
  }
}

module.exports = { startScheduler, stopScheduler };
