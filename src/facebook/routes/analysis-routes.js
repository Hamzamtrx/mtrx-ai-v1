/**
 * Facebook Analysis Routes — /api/facebook/analysis/*
 * Classification, pattern analysis, creative briefs
 */

const { Router } = require('express');
const { getDb } = require('../../database/db');
const { classifyAllAds, calculateBenchmarks } = require('../analysis/classifier');
const { detectPatterns } = require('../analysis/pattern-detector');
const { generateBrief } = require('../analysis/brief-generator');
const { generateStrategicInsights } = require('../analysis/strategic-insights');
const { generateTestSuggestions } = require('../analysis/test-suggestions');

const router = Router();

/**
 * GET /api/facebook/analysis/overview/:brandId
 * Get classification overview with benchmarks
 */
router.get('/overview/:brandId', (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId);
    const db = getDb();

    // Check cache
    const cached = db.prepare(`
      SELECT data FROM fb_analysis_cache
      WHERE brand_id = ? AND analysis_type = 'classification'
      AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(brandId);

    if (cached) {
      return res.json(JSON.parse(cached.data));
    }

    // Generate fresh classification
    const result = classifyAllAds(brandId);
    res.json(result);
  } catch (err) {
    console.error('[Analysis] Overview error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/facebook/analysis/classify/:brandId
 * Force re-classification of all ads
 */
router.post('/classify/:brandId', (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId);
    const result = classifyAllAds(brandId);
    res.json(result);
  } catch (err) {
    console.error('[Analysis] Classify error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/facebook/analysis/patterns/:brandId
 * Get pattern analysis across winning ads
 */
router.get('/patterns/:brandId', (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId);
    const db = getDb();

    // Check cache
    const cached = db.prepare(`
      SELECT data FROM fb_analysis_cache
      WHERE brand_id = ? AND analysis_type = 'patterns'
      AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(brandId);

    if (cached) {
      return res.json(JSON.parse(cached.data));
    }

    const patterns = detectPatterns(brandId);

    // Cache for 6 hours
    if (patterns.hasData) {
      db.prepare(`
        INSERT INTO fb_analysis_cache (brand_id, analysis_type, data, expires_at)
        VALUES (?, 'patterns', ?, datetime('now', '+6 hours'))
      `).run(brandId, JSON.stringify(patterns));
    }

    res.json(patterns);
  } catch (err) {
    console.error('[Analysis] Patterns error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/facebook/analysis/brief/:brandId
 * Generate a fresh creative brief using Claude
 */
router.post('/brief/:brandId', async (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId);
    const result = await generateBrief(brandId);
    res.json(result);
  } catch (err) {
    console.error('[Analysis] Brief generation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/facebook/analysis/brief/:brandId
 * Get cached brief or indicate none exists
 */
router.get('/brief/:brandId', (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId);
    const db = getDb();

    const cached = db.prepare(`
      SELECT data FROM fb_analysis_cache
      WHERE brand_id = ? AND analysis_type = 'brief'
      AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(brandId);

    if (cached) {
      return res.json({ success: true, brief: JSON.parse(cached.data) });
    }

    res.json({ success: false, message: 'No cached brief. Generate one with POST.' });
  } catch (err) {
    console.error('[Analysis] Brief fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/facebook/analysis/fb-insights-context/:brandId
 * Synthesize FB ad intelligence into structured context for static generation.
 * Combines classification, pattern detection, and brief data.
 */
router.post('/fb-insights-context/:brandId', async (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId);
    const db = getDb();

    // Step 1: Classify all ads
    const classResult = classifyAllAds(brandId);

    // Step 2: Detect patterns
    const patterns = detectPatterns(brandId);
    if (!patterns.hasData) {
      return res.json({ success: false, message: 'Not enough winning ad data to extract insights.' });
    }

    // Step 3: Get or generate brief
    let brief = null;
    const cachedBrief = db.prepare(`
      SELECT data FROM fb_analysis_cache
      WHERE brand_id = ? AND analysis_type = 'brief'
      AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(brandId);

    if (cachedBrief) {
      brief = JSON.parse(cachedBrief.data);
    } else {
      try {
        const briefResult = await generateBrief(brandId);
        if (briefResult.success) brief = briefResult.brief;
      } catch (e) {
        console.log('[Analysis] Brief generation skipped:', e.message);
      }
    }

    // Step 4: Synthesize structured output
    const copyPatterns = patterns.copyPatterns || {};
    const topPerformers = patterns.topPerformers || [];

    const context = {
      success: true,
      proposedAngle: brief?.winningAngles || '',
      copyContext: {
        avgLength: copyPatterns.length?.winnerAvg || 0,
        emojiRate: copyPatterns.emojiUsage?.winnerRate || 0,
        questionRate: copyPatterns.questionUsage?.winnerRate || 0,
        structure: copyPatterns.structure?.recommendation || '',
        tone: copyPatterns.tone || {},
        powerWords: (copyPatterns.powerWords?.winnerTop || []).map(w => w.word),
      },
      winningCopy: topPerformers.slice(0, 3).map(ad => ({
        body: ad.body || '',
        headline: ad.headline || '',
        cpa: ad.cpa,
        roas: ad.roas,
      })),
      winningHeadlines: topPerformers.slice(0, 3).map(ad => ad.headline || ad.name).filter(Boolean),
      audienceInsights: brief?.audienceInsights || '',
      copyApproach: brief?.copyApproach || '',
      anglePatterns: patterns.anglePatterns || [],
    };

    res.json(context);
  } catch (err) {
    console.error('[Analysis] FB insights context error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/facebook/analysis/strategic-insights/:brandId
 * Generate Claude-powered strategic analysis of ad performance
 */
router.post('/strategic-insights/:brandId', async (req, res) => {
  // Extend timeout for Claude API calls + comment fetching
  req.setTimeout(180000);
  res.setTimeout(180000);
  try {
    const brandId = parseInt(req.params.brandId);
    const result = await generateStrategicInsights(brandId);
    res.json(result);
  } catch (err) {
    console.error('[Analysis] Strategic insights error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/facebook/analysis/strategic-insights/:brandId
 * Get cached strategic insights or indicate none exists
 */
router.get('/strategic-insights/:brandId', (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId);
    const db = getDb();

    const cached = db.prepare(`
      SELECT data FROM fb_analysis_cache
      WHERE brand_id = ? AND analysis_type = 'strategic_insights'
      AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(brandId);

    if (cached) {
      return res.json({ success: true, insights: JSON.parse(cached.data) });
    }

    res.json({ success: false, message: 'No cached insights. Generate with POST.' });
  } catch (err) {
    console.error('[Analysis] Strategic insights fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/facebook/analysis/test-suggestions/:brandId
 * Generate AI-powered test suggestions based on ad performance data
 */
router.post('/test-suggestions/:brandId', async (req, res) => {
  req.setTimeout(120000);
  res.setTimeout(120000);
  try {
    const brandId = parseInt(req.params.brandId);
    const result = await generateTestSuggestions(brandId);
    res.json(result);
  } catch (err) {
    console.error('[Analysis] Test suggestions error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/facebook/analysis/test-suggestions/:brandId
 * Get cached test suggestions
 */
router.get('/test-suggestions/:brandId', (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId);
    const db = getDb();

    const cached = db.prepare(`
      SELECT data FROM fb_analysis_cache
      WHERE brand_id = ? AND analysis_type = 'test_suggestions'
      AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(brandId);

    if (cached) {
      return res.json({ success: true, suggestions: JSON.parse(cached.data) });
    }

    res.json({ success: false, message: 'No cached test suggestions. Generate with POST.' });
  } catch (err) {
    console.error('[Analysis] Test suggestions fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/facebook/analysis/generate-daily-statics/:brandId
 * Generate statics based on test suggestions and strategic insights
 * Can be called by cron, GitHub Actions, or external schedulers
 *
 * Query params:
 * - tests: Number of tests to process (default: 3)
 * - staticsPerTest: Statics per test (default: 3)
 * - force: Force regenerate even if cached (default: false)
 */
router.post('/generate-daily-statics/:brandId', async (req, res) => {
  req.setTimeout(600000); // 10 minute timeout for full generation
  res.setTimeout(600000);

  try {
    const brandId = parseInt(req.params.brandId);
    const testsToProcess = parseInt(req.query.tests) || 3;
    const staticsPerTest = parseInt(req.query.staticsPerTest) || 3;
    const force = req.query.force === 'true';

    const db = getDb();
    const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(brandId);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    console.log(`[Daily Statics] Starting generation for ${brand.name}`);
    console.log(`   Tests: ${testsToProcess}, Statics/test: ${staticsPerTest}`);

    // Step 1: Get or generate strategic insights
    let insights = null;
    if (!force) {
      const cachedInsights = db.prepare(`
        SELECT data FROM fb_analysis_cache
        WHERE brand_id = ? AND analysis_type = 'strategic_insights'
        AND expires_at > datetime('now')
        ORDER BY created_at DESC LIMIT 1
      `).get(brandId);

      if (cachedInsights) {
        insights = JSON.parse(cachedInsights.data);
        console.log('   Using cached strategic insights');
      }
    }

    if (!insights) {
      console.log('   Generating fresh strategic insights...');
      const result = await generateStrategicInsights(brandId);
      if (!result.success) {
        return res.status(400).json({ error: 'Could not generate insights', details: result.message });
      }
      insights = result.insights;
    }

    // Step 2: Get or generate test suggestions
    let tests = null;
    if (!force) {
      const cachedTests = db.prepare(`
        SELECT data FROM fb_analysis_cache
        WHERE brand_id = ? AND analysis_type = 'test_suggestions'
        AND expires_at > datetime('now')
        ORDER BY created_at DESC LIMIT 1
      `).get(brandId);

      if (cachedTests) {
        tests = JSON.parse(cachedTests.data);
        console.log('   Using cached test suggestions');
      }
    }

    if (!tests) {
      console.log('   Generating fresh test suggestions...');
      const result = await generateTestSuggestions(brandId);
      if (!result.success) {
        return res.status(400).json({ error: 'Could not generate tests', details: result.message });
      }
      tests = result.suggestions;
    }

    if (!tests?.tests || tests.tests.length === 0) {
      return res.status(400).json({ error: 'No tests generated' });
    }

    // Return the test data for the client to process
    // (Actual static generation happens via /generate-statics endpoint)
    res.json({
      success: true,
      brand: {
        id: brand.id,
        name: brand.name,
        websiteUrl: brand.website_url,
      },
      insights: {
        winningAngles: insights?.winningAngles?.details,
        creatorAnalysis: insights?.creatorAnalysis?.details,
        visualAndFormat: insights?.visualAndFormat?.details,
        iterationIdeas: insights?.iterationIdeas?.details,
        newAngles: insights?.newAngles?.details,
      },
      tests: tests.tests.slice(0, testsToProcess).map(t => ({
        title: t.title,
        angle: t.angle,
        hook: t.hook,
        copyDirection: t.copyDirection,
        visualDirection: t.visualDirection,
        priority: t.priority,
        basedOn: t.basedOn,
        rationale: t.rationale,
      })),
      config: {
        testsToProcess,
        staticsPerTest,
        staticTypes: ['type1', 'type2', 'type6'], // Product Hero, Meme, UGC
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Daily Statics] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
