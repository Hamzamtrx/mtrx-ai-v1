/**
 * Facebook Graph API Client
 * Rate-limited (200 calls/hr), exponential backoff, paginated
 */

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';
const MAX_CALLS_PER_HOUR = 200;
const MIN_DELAY_MS = 200;
const MAX_RETRIES = 3;

class GraphApiClient {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.callTimestamps = [];
  }

  /**
   * Rate-limit: ensure we don't exceed MAX_CALLS_PER_HOUR
   */
  async _rateLimit() {
    const now = Date.now();
    // Remove timestamps older than 1 hour
    this.callTimestamps = this.callTimestamps.filter(t => now - t < 3600000);

    if (this.callTimestamps.length >= MAX_CALLS_PER_HOUR) {
      const oldest = this.callTimestamps[0];
      const waitMs = 3600000 - (now - oldest) + 1000;
      console.log(`[GraphAPI] Rate limit reached, waiting ${Math.round(waitMs / 1000)}s`);
      await this._sleep(waitMs);
    }

    // Minimum delay between requests
    await this._sleep(MIN_DELAY_MS);
    this.callTimestamps.push(Date.now());
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Make a Graph API request with rate limiting and retries
   */
  async request(endpoint, params = {}) {
    await this._rateLimit();

    const url = new URL(`${GRAPH_BASE}${endpoint}`);
    url.searchParams.set('access_token', this.accessToken);
    for (const [key, val] of Object.entries(params)) {
      url.searchParams.set(key, val);
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(url.toString());
        const data = await res.json();

        if (data.error) {
          // Rate limit error from FB — back off and retry
          if (data.error.code === 4 || data.error.code === 17 || data.error.code === 32) {
            const backoff = Math.pow(2, attempt + 1) * 1000;
            console.log(`[GraphAPI] Rate limited by FB, backing off ${backoff}ms`);
            await this._sleep(backoff);
            continue;
          }
          // Auth/permission/field errors — fail immediately, no retry
          if (data.error.code === 190 || data.error.code === 100 || data.error.code === 200 || data.error.code === 10) {
            throw Object.assign(new Error(`Graph API error: ${data.error.message} (code: ${data.error.code})`), { noRetry: true });
          }
          throw new Error(`Graph API error: ${data.error.message} (code: ${data.error.code})`);
        }

        return data;
      } catch (err) {
        if (err.noRetry || attempt === MAX_RETRIES) throw err;
        const backoff = Math.pow(2, attempt + 1) * 1000;
        console.log(`[GraphAPI] Request failed (attempt ${attempt + 1}), retrying in ${backoff}ms: ${err.message}`);
        await this._sleep(backoff);
      }
    }
  }

  /**
   * Fetch all pages of a paginated endpoint
   */
  async fetchAllPages(endpoint, params = {}, maxPages = 50) {
    const allData = [];
    let page = 0;
    let nextUrl = null;

    // First request (limit 25 to avoid FB "too much data" errors on large accounts)
    const firstPage = await this.request(endpoint, { ...params, limit: '25' });
    allData.push(...(firstPage.data || []));
    nextUrl = firstPage.paging?.next || null;
    page++;

    // Subsequent pages
    while (nextUrl && page < maxPages) {
      await this._rateLimit();
      const res = await fetch(nextUrl);
      const data = await res.json();
      if (data.error) {
        throw new Error(`Graph API pagination error: ${data.error.message}`);
      }
      allData.push(...(data.data || []));
      nextUrl = data.paging?.next || null;
      page++;
    }

    return allData;
  }

  /**
   * Get all ads for an ad account
   * @param {string} adAccountId - e.g. "act_123456"
   */
  async getAds(adAccountId) {
    return this.fetchAllPages(`/${adAccountId}/ads`, {
      fields: 'id,name,status,adset_id,campaign_id,created_time,creative{id,title,body,image_url,thumbnail_url,video_id,call_to_action_type}',
    });
  }

  /**
   * Get insights for a specific ad
   * @param {string} adId
   * @param {string} datePreset - e.g. 'last_30d', 'last_90d', 'lifetime'
   */
  async getAdInsights(adId, datePreset = 'last_90d') {
    const data = await this.request(`/${adId}/insights`, {
      fields: 'spend,impressions,clicks,ctr,cpm,cpc,actions,action_values,cost_per_action_type',
      date_preset: datePreset,
    });
    return (data.data && data.data[0]) || null;
  }

  /**
   * Get daily insights for an ad (for trend analysis)
   * @param {string} adId
   * @param {string} datePreset
   */
  async getAdInsightsDaily(adId, datePreset = 'last_30d') {
    return this.fetchAllPages(`/${adId}/insights`, {
      fields: 'spend,impressions,clicks,ctr,cpm,cpc,actions,action_values,cost_per_action_type,date_start',
      date_preset: datePreset,
      time_increment: '1',
    });
  }

  /**
   * Get comments on an ad's post
   * Step 1: Get effective_object_story_id via the ad's creative
   * Step 2: Fetch /{postId}/comments
   * @param {string} adId - The ad ID
   * @param {number} limit - Max comments to return
   */
  async getAdComments(adId, limit = 10) {
    // Step 1: Get the post ID via the ad's creative
    const adData = await this.request(`/${adId}`, {
      fields: 'creative{effective_object_story_id}',
    });

    const postId = adData.creative?.effective_object_story_id;
    if (!postId) {
      return { comments: [], error: 'No post associated with this ad' };
    }

    // Step 2: Fetch comments on that post
    const commentsData = await this.request(`/${postId}/comments`, {
      fields: 'message,from,created_time,like_count',
      limit: String(limit),
    });

    return {
      comments: (commentsData.data || []).map(c => ({
        message: c.message,
        from: c.from?.name || 'Unknown',
        createdTime: c.created_time,
        likeCount: c.like_count || 0,
      })),
      postId,
    };
  }

  /**
   * Get video source URL (temporary signed download URL)
   * @param {string} videoId - Facebook video ID
   * @returns {string|null} Download URL
   */
  async getVideoSource(videoId) {
    const data = await this.request(`/${videoId}`, { fields: 'source' });
    return data.source || null;
  }

  /**
   * Get video source URL via the ad account's advideos endpoint (fallback)
   * Uses ads_read permission which is more commonly available
   * @param {string} adAccountId - e.g. "act_123456"
   * @param {string} videoId - Facebook video ID
   * @returns {string|null} Download URL
   */
  async getVideoSourceViaAccount(adAccountId, videoId) {
    const data = await this.request(`/${adAccountId}/advideos`, {
      filtering: JSON.stringify([{ field: 'id', operator: 'EQUAL', value: videoId }]),
      fields: 'source',
    });
    const video = data?.data?.[0];
    return video?.source || null;
  }

  /**
   * Get all ads + insights for an account in one batch
   * More efficient than individual calls
   * @param {string} adAccountId
   */
  async getAdsWithInsights(adAccountId, datePreset = 'last_90d') {
    // For large accounts, we filter to ads with spend to reduce data volume
    // The filtering happens server-side so we get less data per page
    return this.fetchAllPages(`/${adAccountId}/ads`, {
      fields: `id,name,status,adset_id,campaign_id,created_time,creative{id,title,body,image_url,thumbnail_url,video_id,call_to_action_type},insights.date_preset(${datePreset}){spend,impressions,clicks,ctr,cpm,cpc,actions,action_values,cost_per_action_type}`,
      filtering: JSON.stringify([{ field: 'impressions', operator: 'GREATER_THAN', value: '0' }]),
    });
  }
}

/**
 * Extract purchase count from FB actions array
 */
function extractPurchases(actions) {
  if (!actions) return 0;
  const purchase = actions.find(a =>
    a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
  );
  return purchase ? parseInt(purchase.value, 10) : 0;
}

/**
 * Extract purchase revenue from FB action_values array
 */
function extractRevenue(actionValues) {
  if (!actionValues) return 0;
  const purchase = actionValues.find(a =>
    a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
  );
  return purchase ? parseFloat(purchase.value) : 0;
}

/**
 * Extract CPA from cost_per_action_type array
 */
function extractCpa(costPerAction) {
  if (!costPerAction) return 0;
  const purchase = costPerAction.find(a =>
    a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
  );
  return purchase ? parseFloat(purchase.value) : 0;
}

/**
 * Normalize raw FB insights into our flat schema
 */
function normalizeInsights(raw) {
  if (!raw) {
    return { spend: 0, impressions: 0, clicks: 0, ctr: 0, cpm: 0, cpc: 0, purchases: 0, cpa: 0, revenue: 0, roas: 0 };
  }
  const spend = parseFloat(raw.spend || 0);
  const impressions = parseInt(raw.impressions || 0, 10);
  const clicks = parseInt(raw.clicks || 0, 10);
  const ctr = parseFloat(raw.ctr || 0);
  const cpm = parseFloat(raw.cpm || 0);
  const cpc = parseFloat(raw.cpc || 0);
  const purchases = extractPurchases(raw.actions);
  const revenue = extractRevenue(raw.action_values);
  const cpa = extractCpa(raw.cost_per_action_type) || (purchases > 0 ? spend / purchases : 0);
  const roas = spend > 0 ? revenue / spend : 0;

  return { spend, impressions, clicks, ctr, cpm, cpc, purchases, cpa, revenue, roas };
}

module.exports = { GraphApiClient, normalizeInsights, extractPurchases, extractRevenue, extractCpa };
