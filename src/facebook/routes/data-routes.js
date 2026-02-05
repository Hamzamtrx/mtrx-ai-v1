/**
 * Facebook Data Routes — /api/facebook/data/*
 * Handles data sync and ad listing
 */

const { Router } = require('express');
const { getDb } = require('../../database/db');
const { syncBrand, syncDailyInsights } = require('../data/data-sync');
const { decrypt } = require('../../database/encryption');
const { GraphApiClient } = require('../data/graph-api');
const { transcribeAd, batchTranscribe, getTranscriptionStats } = require('../data/transcription');
const { analyzeVideo, batchAnalyze } = require('../data/video-analysis');

const router = Router();

/**
 * POST /api/facebook/data/sync/:brandId
 * Trigger a full data sync for a brand
 * Query: ?datePreset=last_30d|last_90d|lifetime
 */
router.post('/sync/:brandId', async (req, res) => {
  try {
    const { brandId } = req.params;
    const datePreset = req.query.datePreset || 'last_90d';

    const summary = await syncBrand(parseInt(brandId), datePreset);
    res.json(summary);
  } catch (err) {
    console.error('[Data Routes] Sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/facebook/data/sync-daily/:brandId
 * Trigger daily insights sync for trend analysis
 */
router.post('/sync-daily/:brandId', async (req, res) => {
  try {
    const { brandId } = req.params;
    const result = await syncDailyInsights(parseInt(brandId));
    res.json(result);
  } catch (err) {
    console.error('[Data Routes] Daily sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/facebook/data/ads/:brandId
 * List all ads for a brand with filtering/sorting
 * Query: ?classification=winner&sort=spend&order=desc&limit=50&offset=0
 */
router.get('/ads/:brandId', (req, res) => {
  try {
    const { brandId } = req.params;
    const { classification, sort, order, limit, offset, search } = req.query;

    const db = getDb();
    let sql = 'SELECT * FROM fb_ads WHERE brand_id = ?';
    const params = [parseInt(brandId)];

    if (classification) {
      sql += ' AND classification = ?';
      params.push(classification);
    }

    if (search) {
      sql += ' AND (ad_name LIKE ? OR body LIKE ? OR headline LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Sorting
    const validSorts = ['spend', 'cpa', 'roas', 'ctr', 'purchases', 'impressions', 'ad_name', 'classification'];
    const sortCol = validSorts.includes(sort) ? sort : 'spend';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
    sql += ` ORDER BY ${sortCol} ${sortOrder}`;

    // Pagination
    const limitVal = Math.min(parseInt(limit) || 50, 200);
    const offsetVal = parseInt(offset) || 0;
    sql += ' LIMIT ? OFFSET ?';
    params.push(limitVal, offsetVal);

    const ads = db.prepare(sql).all(...params);

    // Also get total count
    let countSql = 'SELECT COUNT(*) as total FROM fb_ads WHERE brand_id = ?';
    const countParams = [parseInt(brandId)];
    if (classification) {
      countSql += ' AND classification = ?';
      countParams.push(classification);
    }
    const { total } = db.prepare(countSql).get(...countParams);

    res.json({ ads, total, limit: limitVal, offset: offsetVal });
  } catch (err) {
    console.error('[Data Routes] Ads list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/facebook/data/ads/:brandId/:adId
 * Get single ad details with daily history
 */
router.get('/ads/:brandId/:adId', (req, res) => {
  try {
    const { brandId, adId } = req.params;
    const db = getDb();

    const ad = db.prepare('SELECT * FROM fb_ads WHERE brand_id = ? AND fb_ad_id = ?').get(parseInt(brandId), adId);
    if (!ad) return res.status(404).json({ error: 'Ad not found' });

    const history = db.prepare(`
      SELECT * FROM fb_insights_history
      WHERE brand_id = ? AND fb_ad_id = ?
      ORDER BY date DESC LIMIT 30
    `).all(parseInt(brandId), adId);

    res.json({ ad, history });
  } catch (err) {
    console.error('[Data Routes] Ad detail error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/facebook/data/summary/:brandId
 * Get high-level summary stats
 */
router.get('/summary/:brandId', (req, res) => {
  try {
    const { brandId } = req.params;
    const db = getDb();
    const bid = parseInt(brandId);

    const totals = db.prepare(`
      SELECT
        COUNT(*) as totalAds,
        SUM(spend) as totalSpend,
        SUM(purchases) as totalPurchases,
        SUM(revenue) as totalRevenue,
        AVG(cpa) as avgCpa,
        AVG(roas) as avgRoas
      FROM fb_ads WHERE brand_id = ? AND spend > 0
    `).get(bid);

    const classificationCounts = db.prepare(`
      SELECT classification, COUNT(*) as count
      FROM fb_ads WHERE brand_id = ?
      GROUP BY classification
    `).all(bid);

    const lastSync = db.prepare('SELECT last_sync_at FROM fb_connections WHERE brand_id = ?').get(bid);

    res.json({
      ...totals,
      classifications: Object.fromEntries(classificationCounts.map(c => [c.classification, c.count])),
      lastSyncAt: lastSync?.last_sync_at,
    });
  } catch (err) {
    console.error('[Data Routes] Summary error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/facebook/data/comments/:brandId/:adId
 * Fetch comments on an ad's post (on-demand, not stored)
 */
router.get('/comments/:brandId/:adId', async (req, res) => {
  try {
    const { brandId, adId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const db = getDb();

    const conn = db.prepare('SELECT access_token FROM fb_connections WHERE brand_id = ? AND status = ?').get(parseInt(brandId), 'active');
    if (!conn) return res.status(400).json({ error: 'No active Facebook connection' });

    const accessToken = decrypt(conn.access_token);
    const client = new GraphApiClient(accessToken);
    const result = await client.getAdComments(adId, limit);
    res.json(result);
  } catch (err) {
    console.error('[Data Routes] Comments error:', err.message);
    res.status(500).json({ error: err.message, comments: [] });
  }
});

/**
 * POST /api/facebook/data/transcribe/:brandId/:adId
 * Transcribe a single video ad on-demand
 */
router.post('/transcribe/:brandId/:adId', async (req, res) => {
  try {
    req.setTimeout(120000);
    const { brandId, adId } = req.params;
    const result = await transcribeAd(parseInt(brandId), adId);
    res.json(result);
  } catch (err) {
    console.error('[Data Routes] Transcription error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/facebook/data/transcript/:brandId/:adId
 * Save a manually-entered transcript for a video ad
 */
router.post('/transcript/:brandId/:adId', (req, res) => {
  try {
    const { brandId, adId } = req.params;
    const { transcript } = req.body;
    if (transcript === undefined) return res.status(400).json({ error: 'transcript field required' });
    const db = getDb();
    db.prepare('UPDATE fb_ads SET video_transcript = ? WHERE brand_id = ? AND fb_ad_id = ?').run(transcript, parseInt(brandId), adId);
    res.json({ success: true });
  } catch (err) {
    console.error('[Data Routes] Save transcript error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/facebook/data/transcribe-batch/:brandId
 * Batch transcribe video ads without transcripts
 * Query: ?limit=10
 */
router.post('/transcribe-batch/:brandId', async (req, res) => {
  try {
    req.setTimeout(600000);
    const { brandId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const result = await batchTranscribe(parseInt(brandId), limit);
    res.json(result);
  } catch (err) {
    console.error('[Data Routes] Batch transcription error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/facebook/data/transcription-stats/:brandId
 * Get video transcription stats for a brand
 */
router.get('/transcription-stats/:brandId', (req, res) => {
  try {
    const { brandId } = req.params;
    const stats = getTranscriptionStats(parseInt(brandId));
    res.json(stats);
  } catch (err) {
    console.error('[Data Routes] Transcription stats error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/facebook/data/analyze-video/:brandId/:adId
 * Analyze a single video ad's visuals with Gemini
 */
router.post('/analyze-video/:brandId/:adId', async (req, res) => {
  try {
    req.setTimeout(120000);
    const { brandId, adId } = req.params;
    const result = await analyzeVideo(parseInt(brandId), adId);
    res.json(result);
  } catch (err) {
    console.error('[Data Routes] Video analysis error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/facebook/data/analyze-video-batch/:brandId
 * Batch analyze video ads' visuals with Gemini
 * Query: ?limit=10
 */
router.post('/analyze-video-batch/:brandId', async (req, res) => {
  try {
    req.setTimeout(600000);
    const { brandId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const result = await batchAnalyze(parseInt(brandId), limit);
    res.json(result);
  } catch (err) {
    console.error('[Data Routes] Batch video analysis error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
