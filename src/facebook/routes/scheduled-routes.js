/**
 * Scheduled Sync Routes — /api/facebook/scheduled/*
 * Endpoints for cron jobs, n8n workflows, and external triggers
 */

const { Router } = require('express');
const {
  syncPerformance,
  runFullAnalysis,
  getSyncStatus,
} = require('../data/scheduled-sync');

const router = Router();

/**
 * POST /api/facebook/scheduled/sync-performance/:brandId
 * Trigger performance data sync (run every 3 days via cron)
 *
 * This will:
 * 1. Pull latest spend/CPA/ROAS from Facebook
 * 2. Re-classify all ads
 * 3. Detect breakout ads
 * 4. Process any new unprocessed ads
 *
 * Returns breakout alerts if any ads spiked
 */
router.post('/sync-performance/:brandId', async (req, res) => {
  req.setTimeout(600000); // 10 minute timeout
  res.setTimeout(600000);

  try {
    const brandId = parseInt(req.params.brandId);
    const result = await syncPerformance(brandId);

    res.json(result);
  } catch (err) {
    console.error('[ScheduledSync] Performance sync error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/facebook/scheduled/full-analysis/:brandId
 * Trigger full strategic analysis (run weekly or on-demand)
 *
 * This runs the complete 8-section analysis framework
 */
router.post('/full-analysis/:brandId', async (req, res) => {
  req.setTimeout(300000); // 5 minute timeout
  res.setTimeout(300000);

  try {
    const brandId = parseInt(req.params.brandId);
    const result = await runFullAnalysis(brandId);

    res.json(result);
  } catch (err) {
    console.error('[ScheduledSync] Full analysis error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/facebook/scheduled/status/:brandId
 * Get sync and processing status
 */
router.get('/status/:brandId', (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId);
    const status = getSyncStatus(brandId);

    res.json(status);
  } catch (err) {
    console.error('[ScheduledSync] Status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Webhook for Slack alerts (optional)
 * POST /api/facebook/scheduled/webhook/breakout-alert
 */
router.post('/webhook/breakout-alert', async (req, res) => {
  const { breakoutAds, brandName } = req.body;

  if (!breakoutAds || breakoutAds.length === 0) {
    return res.json({ sent: false, reason: 'No breakout ads' });
  }

  // Format for Slack
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!slackWebhookUrl) {
    return res.json({ sent: false, reason: 'No Slack webhook configured' });
  }

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `🚀 Breakout Ads Detected — ${brandName}`,
      },
    },
  ];

  for (const ad of breakoutAds) {
    if (ad.type === 'spend_increase') {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${ad.adName.substring(0, 50)}*\n📈 ${ad.increasePercent}% spend increase\n$${ad.previousSpend} → $${ad.currentSpend} | ROAS: ${ad.roas?.toFixed(2)}x`,
        },
      });
    } else {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${ad.adName.substring(0, 50)}*\n💰 Crossed $${ad.threshold} threshold\nSpend: $${ad.currentSpend} | ROAS: ${ad.roas?.toFixed(2)}x`,
        },
      });
    }
  }

  try {
    await fetch(slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });

    res.json({ sent: true, count: breakoutAds.length });
  } catch (err) {
    res.status(500).json({ sent: false, error: err.message });
  }
});

module.exports = router;
