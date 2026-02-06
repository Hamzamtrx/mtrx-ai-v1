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
const { buildTestStaticPrompt, buildTestStaticPromptAsync, getAvailableFormats } = require('../analysis/test-static-builder');
const { generateAICopy } = require('../analysis/copy-generator');
const { generateAdName, addNamesToStatics } = require('../analysis/naming-convention');

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
 * Query: ?datePreset=last_30d|last_90d|lifetime
 */
router.post('/classify/:brandId', (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId);
    const datePreset = req.query.datePreset || 'last_90d';
    const result = classifyAllAds(brandId, datePreset);
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
 *
 * Query params:
 * - force: true to bypass cache and generate fresh suggestions
 *
 * Body (optional):
 * - externalSignals: { reddit, tiktok, facebookComments, articles, accountChanges }
 */
router.post('/test-suggestions/:brandId', async (req, res) => {
  req.setTimeout(120000);
  res.setTimeout(120000);
  try {
    const brandId = parseInt(req.params.brandId);
    const force = req.query.force === 'true';
    const externalSignals = req.body?.externalSignals || {};

    console.log(`[Test Suggestions] Request: brandId=${brandId}, force=${force}, hasExternalSignals=${Object.keys(externalSignals).length > 0}`);

    const result = await generateTestSuggestions(brandId, { force, externalSignals });
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
        commentInsights: insights?.commentInsights?.details,
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

/**
 * POST /api/facebook/analysis/generate-test-statics/:brandId
 * Generate statics for a specific test idea
 * Uses the test's hook, angle, and visual direction to create targeted statics
 */
router.post('/generate-test-statics/:brandId', async (req, res) => {
  req.setTimeout(300000); // 5 minute timeout
  res.setTimeout(300000);

  try {
    const brandId = parseInt(req.params.brandId);
    const { test, variants = 2, aspectRatios = ['4:5'] } = req.body;

    if (!test) {
      return res.status(400).json({ success: false, error: 'Test data required' });
    }

    const db = getDb();
    const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(brandId);
    if (!brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    // Check for Nano Banana API key
    if (!process.env.NANO_BANANA_API_KEY) {
      return res.status(400).json({ success: false, error: 'NANO_BANANA_API_KEY not configured' });
    }

    // Normalize aspectRatios to always be an array
    const ratios = Array.isArray(aspectRatios) ? aspectRatios : [aspectRatios];

    console.log(`[Test Statics] Generating statics for test: "${test.title}"`);
    console.log(`   Hook: ${test.hook}`);
    console.log(`   Formats: ${test.formats?.join(', ')}`);
    console.log(`   Aspect Ratios: ${ratios.join(', ')}`);

    // Get product reference image - prefer brand's product image, fall back to winning ad
    let referenceImageUrl = brand.product_image_url;

    if (!referenceImageUrl) {
      // Fall back to winning ad's image
      const winningAd = db.prepare(`
        SELECT image_url, thumbnail_url FROM fb_ads
        WHERE brand_id = ? AND classification = 'winner' AND (image_url IS NOT NULL OR thumbnail_url IS NOT NULL)
        ORDER BY spend DESC LIMIT 1
      `).get(brandId);

      referenceImageUrl = winningAd?.image_url || winningAd?.thumbnail_url;
    }

    if (!referenceImageUrl) {
      return res.status(400).json({
        success: false,
        error: 'No product image found. Set a product image in brand settings or sync ads first.'
      });
    }

    console.log(`   Using reference image: ${referenceImageUrl.substring(0, 50)}...`);

    // Fetch winning ad copy patterns for intelligent copy generation
    const winningAds = db.prepare(`
      SELECT ad_name, headline, body, roas, spend FROM fb_ads
      WHERE brand_id = ? AND classification IN ('winner', 'potential')
      AND (headline IS NOT NULL OR body IS NOT NULL)
      ORDER BY roas DESC LIMIT 5
    `).all(brandId);

    // Extract copy patterns from winning ads
    const winningCopyPatterns = winningAds.map(ad => ({
      headline: ad.headline,
      body: ad.body?.substring(0, 200),
      roas: ad.roas,
    })).filter(p => p.headline || p.body);

    console.log(`   Found ${winningCopyPatterns.length} winning copy patterns`);

    // Also get cached strategic insights if available
    const cachedInsights = db.prepare(`
      SELECT data FROM fb_analysis_cache
      WHERE brand_id = ? AND analysis_type = 'strategic_insights'
      AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(brandId);

    let strategicContext = null;
    if (cachedInsights) {
      try {
        const insights = JSON.parse(cachedInsights.data);
        strategicContext = {
          winningAngles: insights.winningAngles?.summary,
          copyPatterns: insights.commentInsights?.summary,
          audienceSignals: insights.audienceSignals?.summary,
        };
      } catch (e) {
        console.log('   Could not parse cached insights');
      }
    }

    // Initialize Nano Banana API
    const NanoBananaAPI = require('../../api/nano-banana');
    const api = new NanoBananaAPI(process.env.NANO_BANANA_API_KEY);

    // Get format configs from the skill-based builder (matching the image generator skills)
    const formatConfigs = getAvailableFormats();

    // All 6 apparel formats (from skill-based builder)
    const allFormats = Object.keys(formatConfigs);

    // Map test suggestion format names to our skill-based formats
    const formatMapping = {
      // Direct matches
      'product_hero': 'product_hero',
      'meme': 'meme',
      'aesthetic': 'aesthetic',
      'illustrated': 'illustrated',
      'vintage': 'vintage',
      'ugc': 'ugc',
      // Test suggestion format mappings
      'news_editorial': 'vintage',       // Editorial = Vintage magazine style
      'comparison': 'comparison',         // Comparison = Side-by-side format
      'lifestyle': 'aesthetic',           // Lifestyle = Aesthetic offer
      'testimonial': 'ugc',               // Testimonial = UGC style
      'benefit_focused': 'illustrated',   // Benefits = Illustrated benefits
      'problem_solution': 'meme',         // Problem/solution = Meme (good for contrast)
      'social_proof': 'ugc',              // Social proof = UGC
      'authority': 'vintage',             // Authority = Vintage (editorial credibility)
      'urgency': 'aesthetic',             // Urgency = Aesthetic offer (announcements)
      'feature': 'product_hero',          // Feature = Product Hero
      'hero': 'product_hero',
      'static': 'product_hero',
    };

    // Use test's recommended formats, or default to top 3 based on what's winning
    // Unknown formats will be handled dynamically by the prompt builder
    let formats = test.formats || [];
    formats = formats.map(f => {
      const cleaned = f.toLowerCase().replace('_static', '').replace('_caption', '').replace('_offer', '').replace(/-/g, '_');
      return formatMapping[cleaned] || cleaned;
    }).filter(f => f && f.length > 0); // Allow any format through - dynamic generation handles unknowns

    // If no formats specified, check what formats are winning and use those + defaults
    if (formats.length === 0) {
      // Check winning ads for format hints from names
      const winningFormats = db.prepare(`
        SELECT ad_name FROM fb_ads
        WHERE brand_id = ? AND classification IN ('winner', 'potential')
        ORDER BY spend DESC LIMIT 20
      `).all(brandId);

      const formatCounts = { product_hero: 0, meme: 0, aesthetic: 0, illustrated: 0, vintage: 0, ugc: 0 };
      for (const ad of winningFormats) {
        const name = (ad.ad_name || '').toLowerCase();
        if (name.includes('stat') || name.includes('hero')) formatCounts.product_hero++;
        if (name.includes('meme')) formatCounts.meme++;
        if (name.includes('ugc') || name.includes('caption')) formatCounts.ugc++;
        if (name.includes('aesthetic') || name.includes('lifestyle')) formatCounts.aesthetic++;
      }

      // Sort by count and pick top 3
      formats = Object.entries(formatCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([f]) => f);

      // Fallback defaults if nothing found
      if (formats.length < 3) {
        formats = ['product_hero', 'meme', 'ugc'];
      }
    }

    // Ensure we have 3 formats
    while (formats.length < 3) {
      const nextFormat = allFormats.find(f => !formats.includes(f));
      if (nextFormat) formats.push(nextFormat);
      else break;
    }
    const uniqueFormats = [...new Set(formats)].slice(0, 3);

    // Build prompts for each format using AI copy generation
    console.log(`   Generating AI copy for ${uniqueFormats.length} formats...`);
    const formatPrompts = {};

    // Generate AI copy for all formats in parallel
    const copyPromises = uniqueFormats.map(async (format) => {
      const config = formatConfigs[format] || formatConfigs['product_hero'];

      try {
        // Use async prompt builder with AI copy generation
        const prompt = await buildTestStaticPromptAsync({
          test: {
            title: test.title, // CRITICAL: Pass test title so AI knows what we're testing
            hook: test.hook,
            angle: test.angle,
            copyDirection: test.copyDirection,
            visualDirection: test.visualDirection,
            persona: test.persona,
            productType: 'shirt',
            material: 'premium fabric',
            keyBenefit: test.keyBenefit || test.angle,
            useCases: ['everyday wear', 'work', 'going out'],
            brandName: brand.name,
            winningCopy: winningCopyPatterns,
            strategicContext: strategicContext,
          },
          format,
          brandName: brand.name,
          logoUrl: brand.logo_url,
          accentColor: 'orange',
        });

        return { format, config, prompt };
      } catch (err) {
        console.error(`   Error generating copy for ${format}:`, err.message);
        // Fallback to sync version
        const prompt = buildTestStaticPrompt({
          test: {
            title: test.title,
            hook: test.hook,
            angle: test.angle,
            copyDirection: test.copyDirection,
            visualDirection: test.visualDirection,
            brandName: brand.name,
          },
          format,
          brandName: brand.name,
          accentColor: 'orange',
        });
        return { format, config, prompt };
      }
    });

    const promptResults = await Promise.all(copyPromises);
    promptResults.forEach(({ format, config, prompt }) => {
      formatPrompts[format] = { config, prompt };
    });

    console.log(`   AI copy generated for all formats`);

    console.log(`   Step 1: Generating ${uniqueFormats.length} formats at 4:5...`);

    // STEP 1: Generate all 4:5 versions in parallel
    const fourFiveResults = await Promise.all(
      uniqueFormats.map(async (format) => {
        const { config, prompt } = formatPrompts[format];
        console.log(`   Starting ${config.name} (4:5)...`);

        try {
          const result = await api.generateImage({
            prompt,
            referenceImageUrl,
            aspectRatio: '4:5',
          });

          if (result.success) {
            console.log(`   ✅ ${config.name} (4:5) generated`);
          } else {
            console.log(`   ❌ ${config.name} (4:5) failed: ${result.error}`);
          }

          return {
            format,
            config,
            result,
          };
        } catch (err) {
          console.log(`   ❌ ${config.name} (4:5) error: ${err.message}`);
          return {
            format,
            config,
            result: { success: false, error: err.message },
          };
        }
      })
    );

    console.log(`   Step 2: Extending successful images to 9:16...`);

    // STEP 2: For each successful 4:5, extend to 9:16 using generated image as reference
    const nineSixteenResults = await Promise.all(
      fourFiveResults.map(async ({ format, config, result: fourFiveResult }) => {
        if (!fourFiveResult.success || !fourFiveResult.imageUrl) {
          return { format, config, result: { success: false, error: 'No 4:5 to extend' } };
        }

        console.log(`   Extending ${config.name} to 9:16...`);

        try {
          // Use the exact extension prompt from the aspect-ratio-extension skill
          const extensionPrompt = `Recreate this exact image for 9:16 vertical format.

Keep IDENTICAL:
- Same scene/composition
- Same colors/lighting
- Same text (exact wording, same fonts, same placement)
- Same product placement
- Same style

ONLY CHANGE:
- Extend background vertically (top and bottom) to fill 9:16 frame
- Keep main subject centered in frame

9:16 aspect ratio.`;

          const result = await api.generateImage({
            prompt: extensionPrompt,
            referenceImageUrl: fourFiveResult.imageUrl, // Use the 4:5 as reference
            aspectRatio: '9:16',
          });

          if (result.success) {
            console.log(`   ✅ ${config.name} (9:16) extended`);
          } else {
            console.log(`   ❌ ${config.name} (9:16) failed: ${result.error}`);
          }

          return { format, config, result };
        } catch (err) {
          console.log(`   ❌ ${config.name} (9:16) error: ${err.message}`);
          return { format, config, result: { success: false, error: err.message } };
        }
      })
    );

    // Create or get campaign ID for naming
    // If a campaignId is provided in the request, use it; otherwise create a new one
    let campaignId = req.body.campaignId;

    if (!campaignId) {
      // Create a new campaign entry to get an ID for naming
      const campaignResult = db.prepare(`
        INSERT INTO test_campaigns (
          brand_id, title, hook, angle, hypothesis, copy_direction, visual_direction,
          priority, rationale, based_on, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
      `).run(
        brandId,
        test.title || 'Test Campaign',
        test.hook || null,
        test.angle || null,
        test.hypothesis || null,
        test.copyDirection || null,
        test.visualDirection || null,
        test.priority || null,
        test.rationale || null,
        test.basedOn || null
      );
      campaignId = campaignResult.lastInsertRowid;
      console.log(`   Created campaign T${String(campaignId).padStart(3, '0')} for naming`);
    }

    // Combine results with ad naming convention
    const results = [];
    fourFiveResults.forEach(({ format, config, result }) => {
      const adName = generateAdName({
        campaignId,
        format,
        aspectRatio: '4:5',
        hook: test.hook,
        title: test.title,
      });

      results.push({
        type: config.name,
        format,
        aspectRatio: '4:5',
        adName,
        description: test.hook,
        imageUrl: result.success ? result.imageUrl : null,
        status: result.success ? 'complete' : 'failed',
        error: result.error || null,
      });
    });
    nineSixteenResults.forEach(({ format, config, result }) => {
      const adName = generateAdName({
        campaignId,
        format,
        aspectRatio: '9:16',
        hook: test.hook,
        title: test.title,
      });

      results.push({
        type: config.name,
        format,
        aspectRatio: '9:16',
        adName,
        description: test.hook,
        imageUrl: result.success ? result.imageUrl : null,
        status: result.success ? 'complete' : 'failed',
        error: result.error || null,
      });
    });

    // Update campaign with generated statics
    const successfulStatics = results.filter(r => r.status === 'complete');
    if (successfulStatics.length > 0) {
      db.prepare(`
        UPDATE test_campaigns
        SET statics = ?, status = 'ready', updated_at = datetime('now')
        WHERE id = ?
      `).run(JSON.stringify(successfulStatics), campaignId);
      console.log(`   Updated campaign T${String(campaignId).padStart(3, '0')} with ${successfulStatics.length} statics`);
    }

    const successCount = results.filter(r => r.status === 'complete').length;
    const totalExpected = uniqueFormats.length * ratios.length;

    res.json({
      success: successCount > 0,
      message: `Generated ${successCount}/${totalExpected} statics (${uniqueFormats.length} formats × ${ratios.length} ratio${ratios.length > 1 ? 's' : ''})`,
      staticsCount: successCount,
      campaignId,
      campaignCode: `T${String(campaignId).padStart(3, '0')}`,
      statics: results,
      test: {
        title: test.title,
        hook: test.hook,
        angle: test.angle,
      },
      aspectRatios: ratios,
      namingConvention: 'MTRX_T{ID}_{DATE}_{FORMAT}_{HOOK}_{RATIO}',
    });

  } catch (err) {
    console.error('[Test Statics] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
