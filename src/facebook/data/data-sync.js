/**
 * Data Sync Service — orchestrates full/incremental data pulls from Facebook
 * Pulls ads, creatives, insights and stores in SQLite
 */

const { getDb } = require('../../database/db');
const { decrypt } = require('../../database/encryption');
const { GraphApiClient, normalizeInsights } = require('./graph-api');
const { parse, isMtrxFormat } = require('./ad-name-parser');

/**
 * Get decrypted access token for a brand
 */
function getAccessToken(brandId) {
  const db = getDb();
  const conn = db.prepare(`
    SELECT access_token_encrypted, token_expires_at, ad_account_id, status
    FROM fb_connections WHERE brand_id = ? AND status = 'active'
  `).get(brandId);

  if (!conn) throw new Error(`No active Facebook connection for brand ${brandId}`);
  if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
    throw new Error('Facebook token has expired. Please reconnect.');
  }
  if (!conn.ad_account_id) throw new Error('No ad account selected. Please select an ad account.');

  return {
    accessToken: decrypt(conn.access_token_encrypted),
    adAccountId: conn.ad_account_id,
  };
}

/**
 * Sync all ads and insights for a brand
 * @param {number} brandId
 * @param {string} datePreset - 'last_30d', 'last_90d', 'lifetime'
 * @returns {object} Sync summary
 */
async function syncBrand(brandId, datePreset = 'last_90d') {
  const { accessToken, adAccountId } = getAccessToken(brandId);
  const client = new GraphApiClient(accessToken);
  const db = getDb();

  console.log(`[DataSync] Starting sync for brand ${brandId}, account ${adAccountId}`);

  // Fetch all ads with insights in one batch
  const rawAds = await client.getAdsWithInsights(adAccountId, datePreset);
  console.log(`[DataSync] Fetched ${rawAds.length} ads from Facebook`);

  const upsertAd = db.prepare(`
    INSERT INTO fb_ads (
      brand_id, fb_ad_id, fb_adset_id, fb_campaign_id, ad_name, status,
      headline, body, image_url, thumbnail_url, call_to_action,
      parsed_brand, parsed_batch, parsed_copy_style, parsed_awareness,
      parsed_angle_type, parsed_angle_num, parsed_audience, parsed_creator,
      parsed_editor, parsed_version, naming_format,
      spend, impressions, clicks, ctr, cpm, cpc, purchases, cpa, revenue, roas,
      fb_created_time, video_id, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, datetime('now')
    )
    ON CONFLICT(brand_id, fb_ad_id) DO UPDATE SET
      status = excluded.status,
      headline = excluded.headline,
      body = excluded.body,
      image_url = excluded.image_url,
      thumbnail_url = excluded.thumbnail_url,
      call_to_action = excluded.call_to_action,
      spend = excluded.spend,
      impressions = excluded.impressions,
      clicks = excluded.clicks,
      ctr = excluded.ctr,
      cpm = excluded.cpm,
      cpc = excluded.cpc,
      purchases = excluded.purchases,
      cpa = excluded.cpa,
      revenue = excluded.revenue,
      roas = excluded.roas,
      fb_created_time = COALESCE(excluded.fb_created_time, fb_created_time),
      video_id = COALESCE(excluded.video_id, video_id),
      updated_at = datetime('now')
  `);

  let synced = 0;
  let parsed = 0;
  let errors = 0;

  const syncTransaction = db.transaction((ads) => {
    for (const ad of ads) {
      try {
        // Extract creative info
        const creative = ad.creative || {};
        const headline = creative.title || '';
        const body = creative.body || '';
        const imageUrl = creative.image_url || '';
        const thumbnailUrl = creative.thumbnail_url || '';
        const cta = creative.call_to_action_type || '';
        const videoId = creative.video_id || null;

        // Debug: log creative for video ads
        if (ad.name && ad.name.includes('VID') && !videoId) {
          console.log(`[DataSync] VID ad missing video_id: "${ad.name}" | creative keys:`, Object.keys(creative), '| creative:', JSON.stringify(creative).substring(0, 300));
        }

        // Parse MTRX naming convention
        const parsedName = parse(ad.name);
        const namingFormat = parsedName ? 'mtrx' : 'unparsed';
        if (parsedName) parsed++;

        // Normalize insights
        const insightsRaw = ad.insights?.data?.[0] || null;
        const insights = normalizeInsights(insightsRaw);

        upsertAd.run(
          brandId, ad.id, ad.adset_id || null, ad.campaign_id || null, ad.name, ad.status,
          headline, body, imageUrl, thumbnailUrl, cta,
          parsedName?.brand || null, parsedName?.batch || null, parsedName?.copyStyle || null, parsedName?.awareness || null,
          parsedName?.angleType || null, parsedName?.angleNum || null, parsedName?.audience || null, parsedName?.creator || null,
          parsedName?.editor || null, parsedName?.version || null, namingFormat,
          insights.spend, insights.impressions, insights.clicks, insights.ctr,
          insights.cpm, insights.cpc, insights.purchases, insights.cpa,
          insights.revenue, insights.roas,
          ad.created_time || null, videoId
        );
        synced++;
      } catch (err) {
        console.error(`[DataSync] Error syncing ad ${ad.id}:`, err.message);
        errors++;
      }
    }
  });

  syncTransaction(rawAds);

  // Update last_sync_at
  db.prepare('UPDATE fb_connections SET last_sync_at = datetime(\'now\') WHERE brand_id = ?').run(brandId);

  // Clear analysis cache (stale after new data)
  db.prepare('DELETE FROM fb_analysis_cache WHERE brand_id = ?').run(brandId);

  // Count new video ads that need processing
  const unprocessedVideoAds = db.prepare(`
    SELECT COUNT(*) as count FROM fb_ads
    WHERE brand_id = ? AND video_id IS NOT NULL
    AND (video_transcript IS NULL OR video_description IS NULL)
  `).get(brandId);

  const summary = {
    totalAds: rawAds.length,
    synced,
    parsed,
    unparsed: synced - parsed,
    errors,
    unprocessedVideoAds: unprocessedVideoAds.count,
    timestamp: new Date().toISOString(),
  };

  console.log(`[DataSync] Sync complete:`, summary);

  // Note: To auto-process new ads after sync, use the scheduled-sync service:
  // const { processNewAds } = require('./scheduled-sync');
  // await processNewAds(brandId);

  return summary;
}

/**
 * Sync daily insights history for trend analysis
 * @param {number} brandId
 */
async function syncDailyInsights(brandId) {
  const { accessToken, adAccountId } = getAccessToken(brandId);
  const client = new GraphApiClient(accessToken);
  const db = getDb();

  // Get all active ads for this brand
  const ads = db.prepare('SELECT fb_ad_id FROM fb_ads WHERE brand_id = ? AND status = ?').all(brandId, 'ACTIVE');
  console.log(`[DataSync] Syncing daily insights for ${ads.length} active ads`);

  const upsertInsight = db.prepare(`
    INSERT INTO fb_insights_history (brand_id, fb_ad_id, date, spend, impressions, clicks, ctr, cpm, cpc, purchases, cpa, revenue, roas)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(brand_id, fb_ad_id, date) DO UPDATE SET
      spend = excluded.spend,
      impressions = excluded.impressions,
      clicks = excluded.clicks,
      ctr = excluded.ctr,
      cpm = excluded.cpm,
      cpc = excluded.cpc,
      purchases = excluded.purchases,
      cpa = excluded.cpa,
      revenue = excluded.revenue,
      roas = excluded.roas
  `);

  let totalInsights = 0;
  for (const ad of ads) {
    try {
      const dailyData = await client.getAdInsightsDaily(ad.fb_ad_id, 'last_30d');
      for (const day of dailyData) {
        const insights = normalizeInsights(day);
        upsertInsight.run(
          brandId, ad.fb_ad_id, day.date_start,
          insights.spend, insights.impressions, insights.clicks, insights.ctr,
          insights.cpm, insights.cpc, insights.purchases, insights.cpa,
          insights.revenue, insights.roas
        );
        totalInsights++;
      }
    } catch (err) {
      console.error(`[DataSync] Error syncing daily insights for ad ${ad.fb_ad_id}:`, err.message);
    }
  }

  console.log(`[DataSync] Synced ${totalInsights} daily insight records`);
  return { totalInsights };
}

module.exports = { syncBrand, syncDailyInsights, getAccessToken };
