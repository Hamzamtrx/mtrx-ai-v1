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
const { generateTestSuggestions, generateDoubleDownVariations } = require('../analysis/test-suggestions');
const { clearUsedThreads } = require('../analysis/reddit-research');
const { buildTestStaticPrompt, buildTestStaticPromptAsync, getAvailableFormats } = require('../analysis/test-static-builder');
const { generateAICopy } = require('../analysis/copy-generator');
const { generateAdName, addNamesToStatics } = require('../analysis/naming-convention');
const { analyzeStaticCopyForBrand, extractStaticCopy } = require('../analysis/static-style-analysis');
const https = require('https');
const http = require('http');

const router = Router();

/**
 * GET /api/facebook/analysis/image-proxy
 * Proxy endpoint to fetch Facebook CDN images (bypasses expiry/CORS)
 */
router.get('/image-proxy', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const protocol = imageUrl.startsWith('https') ? https : http;

    const proxyReq = protocol.get(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'image/*',
      },
    }, (proxyRes) => {
      // Set CORS and caching headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24h
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'image/jpeg');

      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('[Image Proxy] Error:', err.message);
      res.status(500).json({ error: 'Failed to fetch image' });
    });

    proxyReq.setTimeout(10000, () => {
      proxyReq.destroy();
      res.status(504).json({ error: 'Image fetch timeout' });
    });
  } catch (err) {
    console.error('[Image Proxy] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

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
 * POST /api/facebook/analysis/static-copy/:brandId
 * Extract copy/text from static ad images using Gemini vision AI
 * This reads the actual headline text that's ON the images
 *
 * Query params:
 * - limit: Number of statics to analyze (default: 15)
 * - force: Re-analyze even if already done (default: false)
 */
router.post('/static-copy/:brandId', async (req, res) => {
  req.setTimeout(300000); // 5 minute timeout for vision analysis
  res.setTimeout(300000);

  try {
    const brandId = parseInt(req.params.brandId);
    const limit = parseInt(req.query.limit) || 15;
    const force = req.query.force === 'true';

    console.log(`[Static Copy] Analyzing static images for brand ${brandId}, limit=${limit}, force=${force}`);

    const result = await analyzeStaticCopyForBrand(brandId, { limit, force });

    res.json({
      success: true,
      message: `Analyzed ${result.analyzed} static ads with vision AI`,
      analyzed: result.analyzed,
      errors: result.errors?.length || 0,
      errorDetails: result.errors?.slice(0, 5), // Only show first 5 errors
    });
  } catch (err) {
    console.error('[Static Copy] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/facebook/analysis/static-copy/:brandId
 * Get summary of static copy analysis for a brand
 */
router.get('/static-copy/:brandId', (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId);
    const db = getDb();

    // Count statics with and without copy extracted
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_statics,
        SUM(CASE WHEN static_copy IS NOT NULL AND static_copy != '' THEN 1 ELSE 0 END) as with_copy,
        SUM(CASE WHEN static_copy IS NULL OR static_copy = '' THEN 1 ELSE 0 END) as without_copy
      FROM fb_ads
      WHERE brand_id = ?
        AND image_url IS NOT NULL
        AND image_url != ''
        AND (video_url IS NULL OR video_url = '')
        AND spend > 100
    `).get(brandId);

    // Get sample of extracted headlines
    const samples = db.prepare(`
      SELECT fb_ad_id, ad_name, spend, static_copy
      FROM fb_ads
      WHERE brand_id = ?
        AND static_copy IS NOT NULL
        AND static_copy != ''
      ORDER BY spend DESC
      LIMIT 5
    `).all(brandId);

    const parsedSamples = samples.map(s => {
      try {
        const copy = JSON.parse(s.static_copy);
        return {
          adId: s.fb_ad_id,
          adName: s.ad_name?.substring(0, 40),
          spend: s.spend,
          headline: copy.headline,
          subheadline: copy.subheadline,
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    res.json({
      success: true,
      stats: {
        totalStatics: stats.total_statics,
        withCopy: stats.with_copy,
        withoutCopy: stats.without_copy,
        coveragePercent: stats.total_statics > 0
          ? Math.round((stats.with_copy / stats.total_statics) * 100)
          : 0,
      },
      samples: parsedSamples,
    });
  } catch (err) {
    console.error('[Static Copy] Stats error:', err.message);
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
/**
 * POST /api/facebook/analysis/clear-reddit-cache/:brandId
 * Clear used Reddit threads for a brand to get fresh ideas
 */
router.post('/clear-reddit-cache/:brandId', async (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId);
    clearUsedThreads(brandId);
    res.json({ success: true, message: 'Reddit thread history cleared. Next research will return fresh threads.' });
  } catch (err) {
    console.error('[Clear Reddit Cache] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/test-suggestions/:brandId', async (req, res) => {
  req.setTimeout(300000); // 5 minute timeout for Reddit research + Claude + double-downs
  res.setTimeout(300000);
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
      // Add stats to the response
      const { getSuggestionStats } = require('../analysis/test-suggestions');
      const stats = getSuggestionStats(brandId);
      const suggestions = JSON.parse(cached.data);
      suggestions.stats = stats;
      return res.json({ success: true, suggestions });
    }

    res.json({ success: false, message: 'No cached test suggestions. Generate with POST.' });
  } catch (err) {
    console.error('[Analysis] Test suggestions fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/facebook/analysis/suggestions/:brandId/dismiss
 * Dismiss a suggestion so it doesn't show again
 */
router.post('/suggestions/:brandId/dismiss', (req, res) => {
  try {
    const { suggestionId, hook } = req.body;
    const { markSuggestionDismissed, generateSuggestionHash } = require('../analysis/test-suggestions');
    const db = getDb();
    const brandId = parseInt(req.params.brandId);

    let dismissed = false;

    if (suggestionId) {
      // Dismiss by ID
      dismissed = markSuggestionDismissed(suggestionId);
    } else if (hook) {
      // Dismiss by hook text
      const result = db.prepare(`
        UPDATE test_suggestions
        SET status = 'dismissed', dismissed_at = datetime('now')
        WHERE brand_id = ? AND LOWER(hook) = LOWER(?) AND status = 'pending'
      `).run(brandId, hook.trim());
      dismissed = result.changes > 0;
    }

    if (dismissed) {
      res.json({ success: true, message: 'Suggestion dismissed' });
    } else {
      res.json({ success: false, message: 'Suggestion not found or already processed' });
    }
  } catch (err) {
    console.error('[Analysis] Dismiss suggestion error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/facebook/analysis/regenerate-variations/:brandId
 * Regenerate hook variations for a specific winner
 */
router.post('/regenerate-variations/:brandId', async (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId);
    const { winner, excludeHooks, direction } = req.body;
    const db = getDb();

    if (!winner) {
      return res.status(400).json({ success: false, error: 'Winner data required' });
    }

    // Get brand data
    const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(brandId);
    if (!brand) {
      return res.status(404).json({ success: false, error: 'Brand not found' });
    }

    console.log(`[Regenerate] Generating new variations for "${winner.title}"`);
    if (excludeHooks?.length > 0) {
      console.log(`[Regenerate] Excluding ${excludeHooks.length} existing hooks`);
    }
    if (direction) {
      console.log(`[Regenerate] Direction: ${direction}`);
    }

    // Generate new variations, passing hooks to exclude and optional direction
    const variations = await generateDoubleDownVariations(brand, winner, excludeHooks, direction);

    if (variations && variations.length > 0) {
      console.log(`[Regenerate] Got ${variations.length} new variations`);
      res.json({ success: true, variations });
    } else {
      res.json({ success: false, error: 'No variations generated' });
    }
  } catch (err) {
    console.error('[Analysis] Regenerate variations error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/facebook/analysis/suggestions/:brandId/stats
 * Get suggestion stats for a brand
 */
router.get('/suggestions/:brandId/stats', (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId);
    const { getSuggestionStats } = require('../analysis/test-suggestions');
    const stats = getSuggestionStats(brandId);
    res.json({ success: true, stats });
  } catch (err) {
    console.error('[Analysis] Suggestion stats error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/facebook/analysis/double-down/:brandId
 * Generate 4 test variations for a specific winning visual format
 */
router.post('/double-down/:brandId', async (req, res) => {
  req.setTimeout(120000);
  res.setTimeout(120000);

  try {
    const brandId = parseInt(req.params.brandId);
    const { format, topAds, winnerContext } = req.body;

    // Support both old format-based and new winner-based generation
    const useWinnerContext = !!winnerContext;

    if (!format && !winnerContext) {
      return res.status(400).json({ success: false, message: 'Format or winnerContext required' });
    }

    const db = getDb();
    const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(brandId);
    if (!brand) {
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }

    // Build the prompt for Claude
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic();

    let prompt;

    if (useWinnerContext) {
      // NEW: Winner-based generation with visual narrative analysis
      const winner = winnerContext;
      const formatLabel = winner.format?.label || 'Static';
      const angleLabel = winner.angle?.label || 'General';
      const isFounderVideo = winner.format?.key === 'founder' || winner.format?.key === 'video';

      console.log(`[Double Down] Generating variations for winner: "${winner.title}" (${formatLabel} + ${angleLabel})`);
      console.log(`[Double Down] Is founder video: ${isFounderVideo}, has transcript: ${!!winner.transcript}`);

      // Determine format key for consistency
      const formatKey = winner.format?.key || 'product_hero';

      // Use the title as the actual angle (it contains the vision-extracted angle like "Man Boob")
      const actualAngle = winner.title || angleLabel;

      // Extract visual narrative from staticCopy if available
      const visualDesc = winner.staticCopy?.visualDescription || '';
      const extractedHeadline = winner.staticCopy?.headline || '';

      // FOR FOUNDER VIDEOS: Combine FORMAT (founder video) + ANGLE (specific topic)
      if (isFounderVideo) {
        const transcript = winner.transcript?.substring(0, 1500) || ''; // First 1500 chars
        const detectedAngle = winner.angle?.label || 'General';
        const angleDesc = winner.angle?.desc || '';

        console.log(`[Double Down] Founder video - Detected angle: ${detectedAngle}`);

        prompt = `You are a performance creative strategist for ${brand.name}.

This FOUNDER VIDEO is a WINNER. We need to turn it into STATIC ADS.

=== THE FORMULA ===
FORMAT: Founder Video (founder talking to camera, authentic)
ANGLE: ${detectedAngle} ${angleDesc ? `(${angleDesc})` : ''}

Your job: Create 3 static ad headlines that combine FOUNDER FORMAT + ${detectedAngle.toUpperCase()} ANGLE

=== WINNING VIDEO DATA ===
- Title: ${winner.title}
- Detected Angle: ${detectedAngle}
- Spend: $${winner.spend?.toLocaleString() || 'N/A'} | ROAS: ${winner.roas || 'N/A'}x
${transcript ? `\nVIDEO TRANSCRIPT:\n"${transcript}"` : ''}

=== WHAT WE WANT ===
Headlines that combine the founder's authentic voice WITH the specific angle "${detectedAngle}".

If angle is "Fertility/PFA":
✅ "Polyester Is Killing Your Sperm Count"
✅ "Why I Stopped Wearing Synthetics After Learning About PFAs"
✅ "The Shirt That Won't Wreck Your Hormones"

If angle is "Anti-Polyester/Health":
✅ "I Refuse To Wear Plastic On My Skin"
✅ "Your Shirt Is Leaching Microplastics Into Your Body"
✅ "Why I Built A Brand Around Natural Fibers"

If angle is "Durability":
✅ "I've Worn This Same Shirt For 3 Years"
✅ "Why I Guarantee My Shirts For Life"
✅ "The Last Shirt You'll Ever Need To Buy"

=== WHAT WE DON'T WANT ===
❌ "Why I Started This Company" (too generic)
❌ "My Founder Journey" (meaningless)
❌ "Building A Brand I Love" (corporate fluff)
❌ "The Story Behind ${brand.name}" (vague)

=== RULES ===
- ALL hooks must be about the ${detectedAngle.toUpperCase()} angle
- Include the founder's perspective ("I", "My", "Why I")
- 5-12 words, punchy, specific
- Sound like a real person, not a marketer
- If transcript mentions specific numbers/stats, USE THEM

You MUST respond with this EXACT JSON:
{
  "tests": [
    {
      "title": "2-4 word angle (e.g. 'PFA Warning', 'Polyester Toxic')",
      "hook": "5-12 word headline combining founder voice + ${detectedAngle} angle",
      "recommended_formats": ["stat_stack_hero", "news_editorial", "product_hero"],
      "type": "double_down"
    }
  ]
}

Generate exactly 3 tests. Response must be ONLY the JSON object.`;
      } else {
        // STATIC AD: Use visual narrative analysis
        // Analyze narrative structure from visual description
        let narrativeAnalysis = '';
        if (visualDesc || extractedHeadline) {
          const combined = `${extractedHeadline} ${visualDesc}`.toLowerCase();

          // Detect comparison/contrast structure
          const hasComparison = combined.includes('vs') || combined.includes('weak') || combined.includes('strong') ||
                               combined.includes('before') || combined.includes('after') || combined.includes('left') ||
                               combined.includes('right') || combined.includes('two') || combined.includes('comparison');

          // Detect identity/masculinity angle
          const hasIdentity = combined.includes('real men') || combined.includes('weak men') || combined.includes('alpha') ||
                             combined.includes('beta') || combined.includes('chad') || combined.includes('viking') ||
                             combined.includes('warrior') || combined.includes('masculine');

          // Detect brand superiority
          const hasBrandSuperiority = combined.includes(brand.name?.toLowerCase() || 'undrdog') ||
                                      combined.includes('wear ') || combined.includes('choose ');

          if (hasComparison || hasIdentity || hasBrandSuperiority) {
            narrativeAnalysis = `
VISUAL NARRATIVE STRUCTURE (from AI vision analysis):
- Headline: "${extractedHeadline || 'N/A'}"
- Visual: ${visualDesc?.substring(0, 300) || 'N/A'}

DETECTED NARRATIVE ELEMENTS:
${hasComparison ? '• COMPARISON/CONTRAST: The ad shows a contrast (e.g., weak vs strong, before vs after). KEEP this contrast structure in your hooks.' : ''}
${hasIdentity ? '• IDENTITY/MASCULINITY: The ad uses identity messaging (e.g., "real men", "weak men"). KEEP this identity framing in your hooks.' : ''}
${hasBrandSuperiority ? `• BRAND SUPERIORITY: The ad positions ${brand.name} as the superior choice. KEEP this brand positioning.` : ''}

Your hooks MUST preserve these narrative elements. Don't just change the surface message - keep the STRUCTURE.
`;
          }
        }

        prompt = `You are a performance creative strategist for ${brand.name}.

This static ad is a WINNER. We want to create 3 variations with the SAME visual style, SAME angle, AND SAME narrative structure.

WINNING AD:
- Title: ${winner.title}
- Format: ${formatLabel} (keep this exact visual style)
- Actual Angle: ${actualAngle}
- Spend: $${winner.spend?.toLocaleString() || 'N/A'} | ROAS: ${winner.roas || 'N/A'}x
${narrativeAnalysis}
The angle "${actualAngle}" is WORKING. Generate 3 variations that:
1. Say the SAME core message in DIFFERENT words
2. PRESERVE any comparison/contrast structure
3. PRESERVE any identity framing (e.g., "weak men vs real men")
4. Keep ${brand.name} as the hero/solution

Example for "Anti-Polyester with Identity Contrast":
Original: "Weak Men Wear Polyester, Real Men Wear ${brand.name}"
1. "Boys Wear Plastic, Men Wear ${brand.name}"
2. "Polyester Is For Followers, ${brand.name} Is For Leaders"
3. "Average Guys Wear Synthetics, Alphas Wear ${brand.name}"

Example for "Man Boob" angle:
1. "Hide Your Man Boobs Instantly"
2. "The Moob Destroyer Tee"
3. "Finally, A Shirt That Hides Everything"

RULES:
- ALL 3 hooks must preserve the core angle AND narrative structure
- If it's a comparison ad, keep the "X vs Y" or "Bad thing vs Good thing" structure
- Keep the ${formatLabel} visual style
- Hooks should be 5-12 words, punchy, direct
- Sound like a guy talking to his friend, not a marketer

You MUST respond with this EXACT JSON:
{
  "tests": [
    {
      "title": "Hook Variation 1",
      "hook": "5-12 word hook preserving the narrative structure",
      "recommended_formats": ["${formatKey}"],
      "type": "double_down"
    }
  ]
}

Generate exactly 3 tests. Response must be ONLY the JSON object.`;
      }
    } else {
      // OLD: Format-based generation
      console.log(`[Double Down] Generating 4 variations for "${format}" format`);

      const topAdInfo = topAds?.length > 0
        ? topAds.map(a => `- "${a.name}" ($${a.spend} spend, ${a.roas}x ROAS)`).join('\n')
        : 'No specific ad data available';

      prompt = `You are a performance creative strategist for ${brand.name}.

The "${format.replace(/_/g, ' ')}" visual format is CRUSHING IT. Here are the top performers:

${topAdInfo}

Generate exactly 4 NEW test ideas that use the SAME "${format}" visual format but test DIFFERENT angles.

RULES:
- All 4 tests MUST use "${format}" as their primary format
- Each test should explore a DIFFERENT angle/hook/message
- Keep what's working (the format), change one variable (the angle)
- Hooks should sound natural, not like marketing copy
- Each test teaches us something new about WHY this format works

You MUST respond with this EXACT JSON:
{
  "tests": [
    {
      "title": "Short descriptive title",
      "hook": "The headline (5-10 words, casual tone)",
      "hypothesis": {
        "learning": "If this wins: X. If it loses: Y.",
        "vehicle": "${format}",
        "angle": "The specific positioning being tested"
      },
      "recommended_formats": ["${format}", "format2", "format3"],
      "type": "double_down"
    }
  ]
}

Generate exactly 4 tests. Response must be ONLY the JSON object.`;
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    let jsonStr = response.content[0].text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```\s*$/, '');
    }

    const parsed = JSON.parse(jsonStr);
    let tests = parsed.tests || [];

    // Ensure all tests have the format/type set correctly
    const effectiveFormat = useWinnerContext ? (winnerContext.format?.key || 'static') : format;
    tests.forEach(test => {
      test.type = 'double_down';
      if (!test.recommended_formats || !test.recommended_formats.includes(effectiveFormat)) {
        test.recommended_formats = [effectiveFormat, ...(test.recommended_formats || [])].slice(0, 3);
      }
    });

    console.log(`[Double Down] Generated ${tests.length} variations for "${format}"`);
    res.json({ success: true, tests, format });
  } catch (err) {
    console.error('[Double Down] Error:', err.message);
    res.status(500).json({ success: false, message: err.message });
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
    const { test, variants = 2, aspectRatios = ['4:5'], singleFormat = false, referenceImageUrl: passedReferenceUrl, winningAdVisualDescription, winningAdHeadline, isFounderVideo, videoTranscript, fixInstruction } = req.body;

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

    // Get product reference image
    // For founder videos: ALWAYS use brand's product image (not video thumbnail)
    // For other double-downs: use the passed reference (the winning ad being replicated)
    // Otherwise: prefer brand's product image, fall back to winning ad
    let referenceImageUrl;
    if (isFounderVideo) {
      // For founder statics: use brand's product image, NOT the video thumbnail
      referenceImageUrl = brand.product_image_url;
      console.log(`   FOUNDER VIDEO: Using brand's product image (not video thumbnail)`);
    } else {
      referenceImageUrl = passedReferenceUrl || brand.product_image_url;
    }

    if (!referenceImageUrl) {
      // Fall back to winning ad's image
      const winningAd = db.prepare(`
        SELECT image_url, thumbnail_url FROM fb_ads
        WHERE brand_id = ? AND classification = 'winner' AND (image_url IS NOT NULL OR thumbnail_url IS NOT NULL)
        ORDER BY spend DESC LIMIT 1
      `).get(brandId);

      referenceImageUrl = winningAd?.image_url || winningAd?.thumbnail_url;
    }

    if (passedReferenceUrl && !isFounderVideo) {
      console.log(`   Using DOUBLE DOWN reference: ${referenceImageUrl.substring(0, 50)}...`);
    }

    if (!referenceImageUrl) {
      return res.status(400).json({
        success: false,
        error: 'No product image found. Set a product image in brand settings or sync ads first.'
      });
    }

    console.log(`   Using reference image: ${referenceImageUrl.substring(0, 50)}...`);

    // Get logo URL if available
    const logoUrl = brand.logo_url || null;
    if (logoUrl) {
      console.log(`   Using logo: ${logoUrl.substring(0, 50)}...`);
    }

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

    // Helper function to retry failed generations
    async function generateWithRetry(generateFn, maxRetries = 2) {
      let lastError = null;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await generateFn();
          if (result.success) {
            return result;
          }
          lastError = result.error || 'Generation failed';
          if (attempt < maxRetries) {
            console.log(`      Retry ${attempt + 1}/${maxRetries}...`);
            await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
          }
        } catch (err) {
          lastError = err.message;
          if (attempt < maxRetries) {
            console.log(`      Retry ${attempt + 1}/${maxRetries} after error...`);
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }
      return { success: false, error: lastError };
    }

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
      'ugc_style': 'ugc',                 // Alias for ugc
      'testimonial': 'testimonial',       // Dedicated testimonial format
      // Test suggestion format mappings
      'news_editorial': 'news_editorial', // News/Breaking news editorial style
      'comparison': 'comparison',         // Comparison = Side-by-side format
      'before_after': 'before_after',     // Before/after transformation
      'lifestyle': 'aesthetic',           // Lifestyle = Aesthetic offer
      'benefit_focused': 'illustrated',   // Benefits = Illustrated benefits
      'problem_solution': 'meme',         // Problem/solution = Meme (good for contrast)
      'social_proof': 'testimonial',      // Social proof = Testimonial style
      'authority': 'vintage',             // Authority = Vintage (editorial credibility)
      'urgency': 'aesthetic',             // Urgency = Aesthetic offer (announcements)
      'feature': 'product_hero',          // Feature = Product Hero
      'hero': 'product_hero',
      'static': 'product_hero',
      // Stat Stack Hero for proof stories
      'stat_stack': 'stat_stack_hero',
      'stat_stack_hero': 'stat_stack_hero',
      'stat_hero': 'stat_stack_hero',
      'proof_story': 'stat_stack_hero',
      'proof': 'stat_stack_hero',
      'credibility': 'stat_stack_hero',   // Credibility angles work well with stat stack
      // Founder-specific styles (handled in isFounderVideo block)
      'quote_card': 'quote_card',         // Quote Card = stat_stack_hero variant
      'newspaper': 'newspaper',           // Newspaper = news_editorial variant
      'instagram_story': 'instagram_story', // IG Story native style
      'magazine': 'magazine',             // Magazine Editorial style
      'text_confession': 'text_confession', // Text-heavy confession style
    };

    // Persona → best formats mapping (each persona gets unique primary format)
    const personaFormats = {
      'health_switcher': ['news_editorial', 'stat_stack_hero', 'illustrated'],
      'fit_seeker': ['before_after', 'ugc', 'testimonial'],
      'durability_buyer': ['stat_stack_hero', 'news_editorial', 'comparison'],
      'eco_conscious': ['illustrated', 'aesthetic', 'news_editorial'],
      'skeptic': ['comparison', 'stat_stack_hero', 'product_hero'],
      'gift_buyer': ['testimonial', 'aesthetic', 'ugc'],
    };

    // All available formats for rotation
    const allAvailableFormats = [
      'product_hero', 'meme', 'aesthetic', 'illustrated', 'ugc',
      'comparison', 'testimonial', 'before_after', 'news_editorial', 'stat_stack_hero'
    ];

    // Use test's recommended formats, then vehicle, then persona-based defaults
    let formats = test.recommended_formats || test.formats || [];
    formats = formats.map(f => {
      const cleaned = f.toLowerCase().replace('_static', '').replace('_caption', '').replace('_offer', '').replace(/-/g, '_');
      return formatMapping[cleaned] || cleaned;
    }).filter(f => f && f.length > 0);

    // SINGLE FORMAT MODE: For double-downs, use exactly what's passed without padding
    if (singleFormat && formats.length > 0) {
      console.log(`[Test Statics] Single format mode: using only "${formats[0]}"`);
      formats = [formats[0]]; // Use only the first format
    } else {
      // If no formats but we have a vehicle, use the vehicle as first format
      if (formats.length === 0 && test.hypothesis?.vehicle) {
        const vehicle = test.hypothesis.vehicle.toLowerCase().replace(/-/g, '_');
        const mappedVehicle = formatMapping[vehicle] || vehicle;
        if (mappedVehicle) formats.push(mappedVehicle);
      }

      // Add persona-based formats if we still need more
      if (formats.length < 3 && test.persona?.id) {
        const personaId = test.persona.id.toLowerCase();
        const personaDefaults = personaFormats[personaId] || [];
        for (const pf of personaDefaults) {
          if (!formats.includes(pf) && formats.length < 3) {
            formats.push(pf);
          }
        }
      }
    }

    // If still no formats, check what's winning in the account
    if (formats.length === 0) {
      // Check winning ads for format hints from names
      const winningFormats = db.prepare(`
        SELECT ad_name FROM fb_ads
        WHERE brand_id = ? AND classification IN ('winner', 'potential')
        ORDER BY spend DESC LIMIT 20
      `).all(brandId);

      const formatCounts = { product_hero: 0, meme: 0, aesthetic: 0, illustrated: 0, vintage: 0, ugc: 0, comparison: 0, stat_stack_hero: 0 };
      for (const ad of winningFormats) {
        const name = (ad.ad_name || '').toLowerCase();
        if (name.includes('stat') || name.includes('proof')) formatCounts.stat_stack_hero++;
        if (name.includes('hero') || name.includes('product')) formatCounts.product_hero++;
        if (name.includes('meme')) formatCounts.meme++;
        if (name.includes('ugc') || name.includes('caption')) formatCounts.ugc++;
        if (name.includes('aesthetic') || name.includes('lifestyle')) formatCounts.aesthetic++;
        if (name.includes('vs') || name.includes('comparison')) formatCounts.comparison++;
      }

      // Sort by count and pick top 3
      formats = Object.entries(formatCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([f]) => f);

      // Fallback defaults if nothing found - rotate based on test title hash for variety
      if (formats.length < 3) {
        const rotatingDefaults = [
          ['product_hero', 'stat_stack_hero', 'news_editorial'],
          ['comparison', 'testimonial', 'before_after'],
          ['meme', 'ugc', 'aesthetic'],
          ['illustrated', 'news_editorial', 'stat_stack_hero'],
          ['before_after', 'comparison', 'product_hero'],
          ['testimonial', 'aesthetic', 'illustrated'],
        ];
        // Simple hash of test title to pick rotation
        const titleHash = (test.title || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        formats = rotatingDefaults[titleHash % rotatingDefaults.length];
      }
    }

    // Ensure we have 3 formats - use allAvailableFormats for variety (skip for singleFormat mode)
    if (!singleFormat) {
      while (formats.length < 3) {
        const nextFormat = allAvailableFormats.find(f => !formats.includes(f));
        if (nextFormat) formats.push(nextFormat);
        else break;
      }
    }
    const uniqueFormats = singleFormat ? formats : [...new Set(formats)].slice(0, 3);

    // Build prompts for each format using AI copy generation
    console.log(`   Generating AI copy for ${uniqueFormats.length} formats...`);
    const formatPrompts = {};

    // Check if this is a double-down (has passed reference image AND visual description)
    const isDoubleDown = !!passedReferenceUrl;
    const hasVisualDescription = !!winningAdVisualDescription;

    console.log(`   Double-down mode: ${isDoubleDown}, has visual description: ${hasVisualDescription}`);
    console.log(`   Founder video mode: ${!!isFounderVideo}`);

    // Generate AI copy for all formats in parallel
    const copyPromises = uniqueFormats.map(async (format) => {
      const config = formatConfigs[format] || formatConfigs['product_hero'];

      try {
        let prompt;

        // FOUNDER VIDEO SPECIAL HANDLING: Generate founder-focused statics
        // TWO REFERENCE IMAGES PROVIDED:
        // 1. FOUNDER IMAGE (first) - clear photo of the founder for face/person matching
        // 2. PRODUCT IMAGE (second) - the product they should be holding/wearing
        if (isFounderVideo) {
          console.log(`   Using FOUNDER-SPECIFIC prompt for video → static conversion`);

          // Build founder-appropriate copy based on the hook
          const founderHook = test.hook || 'I built something better';
          const founderName = 'Founder'; // Could be extracted from brand settings later

          // Check if we have founder image and description
          const hasFounderImage = !!brand.founder_image_url;
          const founderDesc = brand.founder_description || '';

          // Detect angle from test title/hook for scene customization
          const testContent = (test.title + ' ' + test.hook).toLowerCase();
          let angleScene = '';
          let shortQuote = '';
          if (testContent.includes('fertil') || testContent.includes('sperm') || testContent.includes('hormone') || testContent.includes('pfa')) {
            angleScene = 'holding his sleeping baby on his chest. Intimate family moment, soft proud emotional smile.';
            shortQuote = 'Polyester was tanking my testosterone. So I built a shirt without it.';
          } else if (testContent.includes('durab') || testContent.includes('last') || testContent.includes('strong') || testContent.includes('built')) {
            angleScene = 'in a workshop, working with his hands. Tools visible, confident energy.';
            shortQuote = 'I built this to last a lifetime. Because that\'s how long I plan to wear it.';
          } else if (testContent.includes('sweat') || testContent.includes('stink') || testContent.includes('odor') || testContent.includes('gym')) {
            angleScene = 'post-workout, athletic setting. Fresh despite the workout.';
            shortQuote = 'Hemp breathes. Polyester traps sweat and bacteria. Simple choice.';
          } else if (testContent.includes('polyester') || testContent.includes('plastic') || testContent.includes('synthetic')) {
            angleScene = 'examining fabric between his fingers, thoughtful expression.';
            shortQuote = 'Once you know what\'s in polyester, you can\'t unknow it.';
          } else {
            angleScene = 'in a natural lifestyle setting, authentic and relaxed.';
            shortQuote = 'I built this for myself. Then everyone wanted one.';
          }

          // Build founder reference line for prompts
          const founderRef = founderDesc
            ? `The reference image of ${founderDesc}`
            : (hasFounderImage ? 'The reference image of the founder' : 'The founder');

          if (format === 'news_editorial') {
            // STYLE 5: Newspaper - from skill
            // Create editorial-style headline (third person) based on angle
            let editorialHeadline = '';
            if (testContent.includes('fertil') || testContent.includes('sperm') || testContent.includes('hormone') || testContent.includes('pfa')) {
              editorialHeadline = 'He Couldn\'t Have A Baby. His Clothes Were The Reason.';
            } else if (testContent.includes('durab') || testContent.includes('last') || testContent.includes('strong') || testContent.includes('built')) {
              editorialHeadline = 'The Founder Who Built A Shirt That Lasts Forever';
            } else if (testContent.includes('sweat') || testContent.includes('stink') || testContent.includes('odor')) {
              editorialHeadline = 'Why This Founder\'s Shirt Never Smells';
            } else if (testContent.includes('polyester') || testContent.includes('plastic') || testContent.includes('synthetic')) {
              editorialHeadline = 'He Quit Polyester. Here\'s What Happened.';
            } else {
              editorialHeadline = 'The Father Who Built A Better Shirt';
            }

            prompt = `Scanned newspaper page, clean modern newspaper layout on white paper.

NEWSPAPER MASTHEAD at top: "THE DAILY STANDARD"

LARGE BOLD HEADLINE in black serif font:
"${editorialHeadline}"

Below headline: ${founderRef} ${angleScene}
He is wearing a fitted plain black t-shirt.

Small italic caption: "Founder of ${brand.name}"

SUBHEADLINE: "${shortQuote}"

Two columns of small newspaper body text (illegible texture).

BLACK BAR at bottom with white text: "${brand.name.toUpperCase()}.COM"

Clean newspaper aesthetic. NOT posed looking at camera. Candid authentic moment.

4:5 aspect ratio.`;
          } else if (format === 'stat_stack_hero' || format === 'quote_card') {
            // STYLE 3: Quote Card - from skill
            prompt = `${founderRef} ${angleScene} fills the entire 4:5 frame edge to edge.
He is wearing a fitted plain ${brand.name} t-shirt.

Dark gradient overlay covering bottom 40% of image fading to transparent at top.

TOP LEFT on the image:
Bold white text: "${founderHook}"

LEFT SIDE badges (small white pills):
"Zero PFAs" | "Hemp fabric" | "Lifetime guarantee" | "Chemical-free"

Bottom left on the gradient, white text:
"${shortQuote}"

Below in bold white uppercase:
"FOUNDER, ${brand.name.toUpperCase()}"

Bottom right corner: "${brand.name.toUpperCase()}.COM"

CAMERA: 35mm f1.8, shallow depth of field, warm golden tones, slight film grain. Natural light. Intimate candid feel like his wife took this photo.

NO separate background. Just image with text on gradient. NOT posed looking at camera.

4:5 aspect ratio.`;
          } else if (format === 'instagram_story') {
            // STYLE 2: Instagram Story - from skill
            // Create casual conversational hook
            let casualHook = 'fun fact: this changed everything';
            if (testContent.includes('fertil') || testContent.includes('baby') || testContent.includes('hormone')) {
              casualHook = 'fun fact: we almost couldn\'t have him';
            } else if (testContent.includes('durab') || testContent.includes('last')) {
              casualHook = 'this shirt is older than my relationship';
            } else if (testContent.includes('sweat') || testContent.includes('stink')) {
              casualHook = 'haven\'t washed this in a week. seriously.';
            }

            prompt = `Instagram story style image. ${founderRef} fills the entire frame edge to edge, 9:16 vertical.
He is wearing a fitted plain black t-shirt.
${angleScene}

Light dark overlay across entire image for text readability.

TOP of frame, white casual text like typed on a phone:
"${casualHook}"

BOTTOM of frame, white text stacked casually:
"${shortQuote.toLowerCase()}"

VERY BOTTOM: small text "${brand.name.toLowerCase()}.com"

NO brand logo. NO bold headlines. NO ad layout. Looks like a real Instagram story.
Casual lowercase throughout. 9:16 vertical format.

CAMERA: iPhone quality, slightly imperfect, authentic feel. NOT professional photography.`;
          } else if (format === 'magazine') {
            // STYLE 1: Magazine Editorial - from skill
            prompt = `Founder story static ad. Dark charcoal background, clean modern layout.

TOP: Small white text "${brand.name}" centered

LARGE BOLD WHITE UPPERCASE HEADLINE centered:
"${founderHook.toUpperCase()}"

LARGE CENTER IMAGE: ${founderRef} ${angleScene} Full width, no border. Takes up at least 50% of the frame.
He is wearing a fitted plain black t-shirt.

BELOW IMAGE in smaller white text centered:
"${shortQuote}"

BELOW in small gray italic text:
"— Founder of ${brand.name}"

BOTTOM in bold white uppercase:
"${brand.name.toUpperCase()}.COM"

CRITICAL: Image is the LARGEST element. Quote BELOW image not above. Dark charcoal background. Clean modern sans-serif typography.

4:5 vertical format.`;
          } else if (format === 'text_confession') {
            // STYLE 6: Text Confession - from skill
            // Build the story arc
            let storyArc = '';
            if (testContent.includes('fertil') || testContent.includes('baby') || testContent.includes('hormone')) {
              storyArc = `We tried for 2 years.
Nothing.

Then a doctor said something
nobody talks about:

Your clothes are full of chemicals
that lower testosterone.

I threw out every shirt.
Built one from hemp.
Zero plastic. Zero chemicals.

8 months later:`;
            } else if (testContent.includes('durab') || testContent.includes('last')) {
              storyArc = `I've bought the same shirt 47 times.

Different brands, same problem:
Fades. Shrinks. Falls apart.

So I built one myself.
Hemp + bamboo + organic cotton.

Lifetime guarantee.
Because I'm tired of buying shirts.`;
            } else {
              storyArc = `Everyone asked about my shirt.

So I kept making more.
For friends. Then strangers.

No polyester. No PFAS.
No microplastics in your skin.

Just real fabric.
The way clothes used to be made.`;
            }

            prompt = `Dark charcoal background. White sans-serif text, left-aligned, generous line spacing.

TOP: Small white "${brand.name}"

Large white text filling top 60% of frame:
"${storyArc}"

SMALL IMAGE centered below text: ${founderRef} ${angleScene} About 30% of frame width, rounded corners.
He is wearing a fitted plain black t-shirt.

Below image in bold white:
"Worth it."

BOTTOM: Bold white "${brand.name.toUpperCase()}.COM"

Dark background. Text IS the ad. Image is the payoff.

4:5 vertical format.`;
          } else if (format === 'newspaper') {
            // Alias for news_editorial - same prompt
            let editorialHeadline = 'The Father Who Built A Better Shirt';
            if (testContent.includes('fertil') || testContent.includes('sperm') || testContent.includes('hormone') || testContent.includes('pfa')) {
              editorialHeadline = 'He Couldn\'t Have A Baby. His Clothes Were The Reason.';
            } else if (testContent.includes('durab') || testContent.includes('last') || testContent.includes('strong') || testContent.includes('built')) {
              editorialHeadline = 'The Founder Who Built A Shirt That Lasts Forever';
            } else if (testContent.includes('sweat') || testContent.includes('stink') || testContent.includes('odor')) {
              editorialHeadline = 'Why This Founder\'s Shirt Never Smells';
            } else if (testContent.includes('polyester') || testContent.includes('plastic') || testContent.includes('synthetic')) {
              editorialHeadline = 'He Quit Polyester. Here\'s What Happened.';
            }

            prompt = `Scanned newspaper page, clean modern newspaper layout on white paper.

NEWSPAPER MASTHEAD at top: "THE DAILY STANDARD"

LARGE BOLD HEADLINE in black serif font:
"${editorialHeadline}"

Below headline: ${founderRef} ${angleScene}
He is wearing a fitted plain black t-shirt.

Small italic caption: "Founder of ${brand.name}"

SUBHEADLINE: "${shortQuote}"

Two columns of small newspaper body text (illegible texture).

BLACK BAR at bottom with white text: "${brand.name.toUpperCase()}.COM"

Clean newspaper aesthetic. NOT posed looking at camera. Candid authentic moment.

4:5 aspect ratio.`;
          } else {
            // Product Hero - Use actual product from reference image on dark background
            prompt = `Clean product marketing static ad. Pure black background.

TOP: Small white text "${brand.name}" centered

LARGE BOLD WHITE UPPERCASE HEADLINE centered below brand name:
"${founderHook}"

CENTER: The EXACT product from the reference image floating against pure black background.
- MUST match the product in reference image exactly (same shirt, same color, same details)
- Professional studio product photography style
- Product floating, soft lighting highlighting fabric texture
- NO person wearing it - just the product floating
- Product takes up middle 40% of frame

BELOW PRODUCT in smaller white text centered:
"Zero polyester. Zero PFAS. Zero microplastics."
"Hemp + Bamboo + Organic Cotton. Lifetime Guarantee."

BOTTOM in bold white uppercase:
"${brand.name.toUpperCase()}.COM"

CRITICAL: Match the EXACT product from reference image. Same shirt, same style, same details.

Pure black background. Clean, minimal, premium feel. Product is the hero.

4:5 vertical format.`;
          }
        }
        // For DOUBLE DOWNS with visual description: Use style-matching prompt instead of format template
        else if (isDoubleDown && hasVisualDescription) {
          console.log(`   Using STYLE-MATCHING prompt for double-down`);
          prompt = `=== DOUBLE DOWN — RECREATE THIS EXACT STYLE ===

CRITICAL: This is a DOUBLE DOWN. The reference image is a WINNING AD.
Recreate the EXACT same visual style with a new headline.

WINNING AD VISUAL DESCRIPTION (from AI analysis):
${winningAdVisualDescription}

${winningAdHeadline ? `ORIGINAL HEADLINE: "${winningAdHeadline}"` : ''}
NEW HEADLINE TO USE: "${test.hook}"

INSTRUCTIONS:
1. COPY the exact visual style described above
2. SAME illustration style, colors, layout, characters, composition
3. SAME typography style and placement
4. ONLY change the text to the new headline: "${test.hook}"
5. Keep everything else IDENTICAL to the reference image

TEXT PLACEMENT — CRITICAL:
• All headline text MUST be fully readable with no obstruction
• Do NOT let character heads, faces, or bodies overlap with text
• Position text in CLEAR AREAS away from character faces
• If characters are in center, place headline at very top or use side positioning
• Text legibility is MORE IMPORTANT than exact layout matching

The reference image shows exactly what we want. Match it precisely, just with the new headline text.

4:5 aspect ratio.`;
        } else {
          // Standard new angle generation - use format-based prompt
          prompt = await buildTestStaticPromptAsync({
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
            brandId: parseInt(brandId, 10), // For brand style analysis
            logoUrl: brand.logo_url,
            accentColor: 'orange',
          });

          // For double-downs WITHOUT visual description, still add matching instruction
          if (isDoubleDown) {
            prompt = `=== DOUBLE DOWN — MATCH REFERENCE EXACTLY ===
This is a DOUBLE DOWN. The reference image is a WINNING AD that works.
You MUST recreate the EXACT same visual style, layout, and design.

CRITICAL INSTRUCTIONS:
• SAME illustration style (if illustrated, keep illustrated)
• SAME color palette and background
• SAME layout and composition
• SAME character/figure style (if any)
• SAME typography style and placement
• ONLY change the headline text to: "${test.hook}"

TEXT PLACEMENT — CRITICAL:
• All headline text MUST be fully readable with no obstruction
• Do NOT let character heads, faces, or bodies overlap with text
• Position text in CLEAR AREAS away from character faces
• Text legibility is MORE IMPORTANT than exact layout matching

The reference image is the winning ad. Copy its style EXACTLY.
===

${prompt}`;
          }
        }

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
      // If there's a fix instruction (user is regenerating to fix an issue), append it
      let finalPrompt = prompt;
      if (fixInstruction) {
        finalPrompt = `${prompt}

=== FIX REQUIRED ===
The previous generation had this issue that MUST be fixed:
${fixInstruction}

This is a REGENERATION. The above issue is CRITICAL and must be addressed in this generation.
===`;
      }
      formatPrompts[format] = { config, prompt: finalPrompt };
    });

    if (fixInstruction) {
      console.log(`   Regenerating with fix: ${fixInstruction.substring(0, 50)}...`);
    }
    console.log(`   AI copy generated for all formats`);

    // Get founder image URL if available (for founder video statics)
    // Should already be a full public URL from ImageHost upload
    const founderImageUrl = isFounderVideo ? (brand.founder_image_url || null) : null;
    if (isFounderVideo) {
      console.log(`   Founder image URL: ${founderImageUrl ? founderImageUrl.substring(0, 50) + '...' : 'NOT SET - add in Brand Settings for better results!'}`);
    }

    console.log(`   Step 1: Generating ${uniqueFormats.length} formats at 4:5...`);

    // STEP 1: Generate all 4:5 versions in parallel
    const fourFiveResults = await Promise.all(
      uniqueFormats.map(async (format) => {
        const { config, prompt } = formatPrompts[format];
        console.log(`   Starting ${config.name} (4:5)...`);

        // For product_hero, only use product image (no founder)
        // For other founder formats, use founder + product
        const useFounderImage = isFounderVideo && format !== 'product_hero';

        const result = await generateWithRetry(async () => {
          return await api.generateImage({
            prompt,
            referenceImageUrl,
            founderImageUrl: useFounderImage ? founderImageUrl : null,
            logoUrl,
            aspectRatio: '4:5',
          });
        });

        if (result.success) {
          console.log(`   ✅ ${config.name} (4:5) generated`);
        } else {
          console.log(`   ❌ ${config.name} (4:5) failed after retries: ${result.error}`);
        }

        return {
          format,
          config,
          result,
        };
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

        const result = await generateWithRetry(async () => {
          return await api.generateImage({
            prompt: extensionPrompt,
            referenceImageUrl: fourFiveResult.imageUrl, // Use the 4:5 as reference
            aspectRatio: '9:16',
          });
        });

        if (result.success) {
          console.log(`   ✅ ${config.name} (9:16) extended`);
        } else {
          console.log(`   ❌ ${config.name} (9:16) failed after retries: ${result.error}`);
        }

        return { format, config, result };
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
