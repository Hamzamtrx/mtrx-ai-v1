/**
 * Test Campaign Routes — /api/facebook/campaigns/*
 * Manages test ideas saved with their generated statics
 */

const { Router } = require('express');
const { getDb } = require('../../database/db');

const router = Router();

/**
 * GET /api/facebook/campaigns/:brandId
 * List all campaigns for a brand
 * Query: ?status=draft|ready|launched|completed
 */
router.get('/:brandId', (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId);
    const { status } = req.query;
    const db = getDb();

    let sql = 'SELECT * FROM test_campaigns WHERE brand_id = ?';
    const params = [brandId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    const campaigns = db.prepare(sql).all(...params);

    // Parse JSON fields
    const parsed = campaigns.map(c => ({
      ...c,
      statics: c.statics ? JSON.parse(c.statics) : [],
      recommended_formats: c.recommended_formats ? JSON.parse(c.recommended_formats) : [],
      fb_ad_ids: c.fb_ad_ids ? JSON.parse(c.fb_ad_ids) : [],
    }));

    res.json({ success: true, campaigns: parsed });
  } catch (err) {
    console.error('[Campaigns] List error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/facebook/campaigns/:brandId/stats
 * Get campaign statistics for a brand
 * NOTE: This route MUST come before /:brandId/:campaignId to avoid "stats" being parsed as campaignId
 */
router.get('/:brandId/stats', (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId);
    const db = getDb();

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as ready,
        SUM(CASE WHEN status = 'launched' THEN 1 ELSE 0 END) as launched,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(total_spend) as totalSpend,
        SUM(total_purchases) as totalPurchases
      FROM test_campaigns
      WHERE brand_id = ?
    `).get(brandId);

    res.json({ success: true, stats });
  } catch (err) {
    console.error('[Campaigns] Stats error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/facebook/campaigns/:brandId/:campaignId
 * Get single campaign details
 */
router.get('/:brandId/:campaignId', (req, res) => {
  try {
    const { brandId, campaignId } = req.params;
    const db = getDb();

    const campaign = db.prepare(
      'SELECT * FROM test_campaigns WHERE brand_id = ? AND id = ?'
    ).get(parseInt(brandId), parseInt(campaignId));

    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    // Parse JSON fields
    const parsed = {
      ...campaign,
      statics: campaign.statics ? JSON.parse(campaign.statics) : [],
      recommended_formats: campaign.recommended_formats ? JSON.parse(campaign.recommended_formats) : [],
      fb_ad_ids: campaign.fb_ad_ids ? JSON.parse(campaign.fb_ad_ids) : [],
    };

    res.json({ success: true, campaign: parsed });
  } catch (err) {
    console.error('[Campaigns] Get error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/facebook/campaigns/:brandId
 * Create/save a new campaign (test + statics)
 */
router.post('/:brandId', (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId);
    const {
      title,
      hook,
      angle,
      hypothesis,
      copyDirection,
      visualDirection,
      priority,
      rationale,
      basedOn,
      recommendedFormats,
      statics,
      status = 'ready',
      notes,
    } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Title required' });
    }

    const db = getDb();

    const result = db.prepare(`
      INSERT INTO test_campaigns (
        brand_id, title, hook, angle, hypothesis, copy_direction, visual_direction,
        priority, rationale, based_on, recommended_formats, statics, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      brandId,
      title,
      hook || null,
      angle || null,
      hypothesis || null,
      copyDirection || null,
      visualDirection || null,
      priority || null,
      rationale || null,
      basedOn || null,
      recommendedFormats ? JSON.stringify(recommendedFormats) : null,
      statics ? JSON.stringify(statics) : null,
      status,
      notes || null
    );

    const campaignId = result.lastInsertRowid;

    // Mark the suggestion as saved (if it exists)
    if (hook) {
      try {
        const { markSuggestionSaved } = require('../analysis/test-suggestions');
        markSuggestionSaved(brandId, hook, campaignId);
      } catch (e) {
        // Non-critical - continue even if marking fails
        console.log('[Campaigns] Could not mark suggestion as saved:', e.message);
      }
    }

    res.json({
      success: true,
      campaignId,
      message: 'Campaign saved successfully',
    });
  } catch (err) {
    console.error('[Campaigns] Create error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/facebook/campaigns/:brandId/:campaignId
 * Update a campaign
 */
router.put('/:brandId/:campaignId', (req, res) => {
  try {
    const { brandId, campaignId } = req.params;
    const updates = req.body;
    const db = getDb();

    // Build dynamic update query
    const allowedFields = [
      'title', 'hook', 'angle', 'hypothesis', 'copy_direction', 'visual_direction',
      'priority', 'rationale', 'based_on', 'recommended_formats', 'statics',
      'status', 'fb_ad_ids', 'total_spend', 'total_purchases', 'avg_roas', 'notes'
    ];

    const setClauses = [];
    const params = [];

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase(); // camelCase to snake_case
      if (allowedFields.includes(dbKey)) {
        setClauses.push(`${dbKey} = ?`);
        // Stringify JSON fields
        if (['recommended_formats', 'statics', 'fb_ad_ids'].includes(dbKey) && typeof value === 'object') {
          params.push(JSON.stringify(value));
        } else {
          params.push(value);
        }
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    setClauses.push("updated_at = datetime('now')");
    params.push(parseInt(brandId), parseInt(campaignId));

    db.prepare(`
      UPDATE test_campaigns
      SET ${setClauses.join(', ')}
      WHERE brand_id = ? AND id = ?
    `).run(...params);

    res.json({ success: true, message: 'Campaign updated' });
  } catch (err) {
    console.error('[Campaigns] Update error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/facebook/campaigns/:brandId/:campaignId
 * Delete a campaign
 */
router.delete('/:brandId/:campaignId', (req, res) => {
  try {
    const { brandId, campaignId } = req.params;
    const db = getDb();

    const result = db.prepare(
      'DELETE FROM test_campaigns WHERE brand_id = ? AND id = ?'
    ).run(parseInt(brandId), parseInt(campaignId));

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    res.json({ success: true, message: 'Campaign deleted' });
  } catch (err) {
    console.error('[Campaigns] Delete error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
