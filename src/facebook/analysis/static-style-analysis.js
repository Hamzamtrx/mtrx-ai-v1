/**
 * Static Ad Style Analysis — uses Google Gemini to analyze brand's static ad style
 * Extracts visual patterns from top-performing static ads to inform new creative generation
 */

const { getDb } = require('../../database/db');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Cache style analysis for 24 hours
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * Get top-performing static ads for a brand
 * Static = has image_url but no video_url
 * @param {number} brandId
 * @param {number} limit - Number of ads to fetch
 * @returns {Array} Array of static ad objects
 */
function getTopStaticAds(brandId, limit = 5) {
  const db = getDb();

  // Get static ads (have image, no video) ordered by performance
  const ads = db.prepare(`
    SELECT
      fb_ad_id, ad_name, headline, body, image_url, thumbnail_url,
      spend, impressions, clicks, purchases, revenue,
      CASE WHEN spend > 0 THEN revenue / spend ELSE 0 END as roas
    FROM fb_ads
    WHERE brand_id = ?
      AND image_url IS NOT NULL
      AND image_url != ''
      AND (video_url IS NULL OR video_url = '')
      AND spend > 10
    ORDER BY
      CASE WHEN spend > 0 THEN revenue / spend ELSE 0 END DESC,
      spend DESC
    LIMIT ?
  `).all(brandId, limit);

  return ads;
}

/**
 * Extract the headline/copy text from a static ad image using Gemini vision
 * This reads the actual text that's ON the image (not the ad metadata)
 * @param {string} imageUrl - URL of the image to analyze
 * @returns {Promise<Object>} { headline, subheadline, callToAction, allText, visualDescription }
 */
async function extractStaticCopy(imageUrl) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  // Fetch the image
  let imageBuffer;
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    imageBuffer = Buffer.from(await response.arrayBuffer());
  } catch (err) {
    throw new Error(`Could not download image: ${err.message}`);
  }

  // Determine mime type from URL or default to jpeg
  const mimeType = imageUrl.includes('.png') ? 'image/png' : 'image/jpeg';

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `Analyze this advertisement image and extract ALL TEXT that appears on the image.

Your task is to identify and extract:

1. **MAIN HEADLINE** - The largest, most prominent text (the main message/hook)
2. **SUBHEADLINE** - Secondary text that supports the headline
3. **CALL TO ACTION** - Button text or action prompts (e.g., "Shop Now", "Learn More")
4. **OTHER TEXT** - Any other visible text (bullet points, features, prices, etc.)

Also provide a brief 1-2 sentence description of what the image shows visually (product, person, style).

CRITICAL: Read the ACTUAL text on the image. Be precise. If text says "MAN BOOBS DESTROYER" that's what you report.

Respond in JSON format:
{
  "headline": "The main headline text exactly as shown",
  "subheadline": "Secondary text or null if none",
  "callToAction": "CTA button text or null",
  "otherText": ["Array of any other text on the image"],
  "visualDescription": "Brief description of the image visuals",
  "confidence": "high | medium | low"
}

If you cannot read any text, set headline to null and explain in visualDescription.`;

  try {
    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType,
          data: imageBuffer.toString('base64'),
        },
      },
    ]);

    const text = result.response.text();

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Create a combined "allText" field for easy searching
      parsed.allText = [
        parsed.headline,
        parsed.subheadline,
        ...(parsed.otherText || []),
        parsed.callToAction,
      ].filter(Boolean).join(' | ');
      return parsed;
    }

    return { headline: null, visualDescription: text, confidence: 'low' };
  } catch (err) {
    throw new Error(`Gemini copy extraction failed: ${err.message}`);
  }
}

/**
 * Analyze a single static ad image with Gemini
 * @param {string} imageUrl - URL of the image to analyze
 * @returns {Promise<Object>} Style analysis result
 */
async function analyzeImageStyle(imageUrl) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  // Fetch the image
  let imageBuffer;
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
    imageBuffer = Buffer.from(await response.arrayBuffer());
  } catch (err) {
    throw new Error(`Could not download image: ${err.message}`);
  }

  // Determine mime type from URL or default to jpeg
  const mimeType = imageUrl.includes('.png') ? 'image/png' : 'image/jpeg';

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `Analyze this static advertisement image and extract the VISUAL STYLE elements.

Focus ONLY on design/visual aspects, NOT the messaging or copy:

1. **COLOR PALETTE**
   - Primary colors used
   - Background color/style
   - Accent colors
   - Overall mood (warm/cool/neutral)

2. **TYPOGRAPHY STYLE**
   - Font style (serif, sans-serif, script, bold, etc.)
   - Text treatment (all caps, mixed case, outlined, shadowed)
   - Text positioning (top, center, bottom, overlaid)

3. **LAYOUT & COMPOSITION**
   - Overall layout structure (centered, split, grid, etc.)
   - Product placement (hero, corner, lifestyle context)
   - Use of whitespace
   - Visual hierarchy

4. **VISUAL ELEMENTS**
   - Icons or badges used
   - Borders, shapes, or dividers
   - Photography style (product shot, lifestyle, flat lay)
   - Any recurring design motifs

5. **OVERALL AESTHETIC**
   - One-line description of the visual style
   - Similar brand aesthetics it resembles

Respond in JSON format:
{
  "colorPalette": {
    "primary": ["color1", "color2"],
    "background": "description",
    "accents": ["color1"],
    "mood": "warm/cool/neutral"
  },
  "typography": {
    "style": "description",
    "treatment": "description",
    "positioning": "description"
  },
  "layout": {
    "structure": "description",
    "productPlacement": "description",
    "whitespace": "minimal/moderate/generous"
  },
  "visualElements": {
    "icons": "description or none",
    "shapes": "description or none",
    "photoStyle": "description"
  },
  "overallAesthetic": "One line summary",
  "similarTo": ["brand1", "brand2"]
}`;

  try {
    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType,
          data: imageBuffer.toString('base64'),
        },
      },
    ]);

    const text = result.response.text();

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return { raw: text };
  } catch (err) {
    throw new Error(`Gemini analysis failed: ${err.message}`);
  }
}

/**
 * Analyze brand's static ad style by examining top performers
 * @param {number} brandId
 * @returns {Promise<Object>} Aggregated style analysis
 */
async function analyzeBrandStaticStyle(brandId) {
  const db = getDb();

  // Check cache first
  const cached = db.prepare(`
    SELECT style_analysis, analyzed_at
    FROM brands
    WHERE id = ?
  `).get(brandId);

  if (cached?.style_analysis) {
    const analyzedAt = new Date(cached.analyzed_at).getTime();
    if (Date.now() - analyzedAt < CACHE_DURATION_MS) {
      console.log(`[StaticStyleAnalysis] Using cached style for brand ${brandId}`);
      return { success: true, style: JSON.parse(cached.style_analysis), cached: true };
    }
  }

  console.log(`[StaticStyleAnalysis] Analyzing static ad style for brand ${brandId}...`);

  // Get top static ads
  const topAds = getTopStaticAds(brandId, 5);

  if (topAds.length === 0) {
    return { success: false, error: 'No static ads found for this brand' };
  }

  console.log(`[StaticStyleAnalysis] Found ${topAds.length} static ads to analyze`);

  // Analyze each ad (limit to 3 to save API calls)
  const analyses = [];
  const adsToAnalyze = topAds.slice(0, 3);

  for (const ad of adsToAnalyze) {
    try {
      console.log(`[StaticStyleAnalysis] Analyzing ad ${ad.fb_ad_id}...`);
      const analysis = await analyzeImageStyle(ad.image_url);
      analyses.push({
        adId: ad.fb_ad_id,
        adName: ad.ad_name,
        roas: ad.roas,
        analysis,
      });
    } catch (err) {
      console.error(`[StaticStyleAnalysis] Failed to analyze ad ${ad.fb_ad_id}:`, err.message);
    }
  }

  if (analyses.length === 0) {
    return { success: false, error: 'Could not analyze any static ads' };
  }

  // Aggregate style patterns
  const aggregatedStyle = aggregateStyleAnalyses(analyses);

  // Cache the result
  try {
    // Check if column exists, add if not
    const cols = db.prepare("PRAGMA table_info(brands)").all().map(c => c.name);
    if (!cols.includes('style_analysis')) {
      db.exec("ALTER TABLE brands ADD COLUMN style_analysis TEXT");
    }
    if (!cols.includes('analyzed_at')) {
      db.exec("ALTER TABLE brands ADD COLUMN analyzed_at TEXT");
    }

    db.prepare(`
      UPDATE brands
      SET style_analysis = ?, analyzed_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(aggregatedStyle), brandId);

    console.log(`[StaticStyleAnalysis] Cached style analysis for brand ${brandId}`);
  } catch (err) {
    console.error(`[StaticStyleAnalysis] Failed to cache style:`, err.message);
  }

  return {
    success: true,
    style: aggregatedStyle,
    adsAnalyzed: analyses.length,
    cached: false,
  };
}

/**
 * Aggregate multiple style analyses into a unified style profile
 * @param {Array} analyses - Array of individual ad analyses
 * @returns {Object} Aggregated style profile
 */
function aggregateStyleAnalyses(analyses) {
  // Extract common patterns
  const colorMoods = [];
  const typographyStyles = [];
  const layoutStructures = [];
  const photoStyles = [];
  const aesthetics = [];
  const primaryColors = [];
  const backgrounds = [];

  for (const { analysis } of analyses) {
    if (analysis.colorPalette) {
      if (analysis.colorPalette.mood) colorMoods.push(analysis.colorPalette.mood);
      if (analysis.colorPalette.primary) primaryColors.push(...analysis.colorPalette.primary);
      if (analysis.colorPalette.background) backgrounds.push(analysis.colorPalette.background);
    }
    if (analysis.typography?.style) typographyStyles.push(analysis.typography.style);
    if (analysis.layout?.structure) layoutStructures.push(analysis.layout.structure);
    if (analysis.visualElements?.photoStyle) photoStyles.push(analysis.visualElements.photoStyle);
    if (analysis.overallAesthetic) aesthetics.push(analysis.overallAesthetic);
  }

  // Find most common patterns
  const mostCommon = (arr) => {
    if (arr.length === 0) return null;
    const counts = {};
    arr.forEach(item => { counts[item] = (counts[item] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  };

  return {
    colorPalette: {
      primaryColors: [...new Set(primaryColors)].slice(0, 4),
      backgrounds: [...new Set(backgrounds)].slice(0, 2),
      mood: mostCommon(colorMoods) || 'neutral',
    },
    typography: mostCommon(typographyStyles) || 'bold sans-serif',
    layout: mostCommon(layoutStructures) || 'centered',
    photoStyle: mostCommon(photoStyles) || 'product photography',
    overallAesthetic: aesthetics[0] || 'modern minimal',
    // Generate a prompt-friendly summary
    promptDescription: generateStylePromptDescription({
      colorMoods,
      typographyStyles,
      layoutStructures,
      photoStyles,
      aesthetics,
      primaryColors,
      backgrounds,
    }),
  };
}

/**
 * Generate a prompt-friendly description of the brand's style
 * @param {Object} patterns - Extracted style patterns
 * @returns {string} Style description for use in prompts
 */
function generateStylePromptDescription(patterns) {
  const parts = [];

  if (patterns.colorMoods.length > 0) {
    const mood = patterns.colorMoods[0];
    parts.push(`${mood} color palette`);
  }

  if (patterns.primaryColors.length > 0) {
    const colors = [...new Set(patterns.primaryColors)].slice(0, 3).join(', ');
    parts.push(`using ${colors}`);
  }

  if (patterns.typographyStyles.length > 0) {
    parts.push(`${patterns.typographyStyles[0]} typography`);
  }

  if (patterns.layoutStructures.length > 0) {
    parts.push(`${patterns.layoutStructures[0]} layout`);
  }

  if (patterns.aesthetics.length > 0) {
    parts.push(`Overall: ${patterns.aesthetics[0]}`);
  }

  return parts.join('. ') || 'Modern, clean advertising style';
}

/**
 * Get style description for use in static generation prompts
 * @param {number} brandId
 * @returns {Promise<string>} Style description or empty string if not available
 */
async function getStylePromptForBrand(brandId) {
  try {
    const result = await analyzeBrandStaticStyle(brandId);
    if (result.success && result.style) {
      const style = result.style;
      let prompt = `\n\n=== BRAND STYLE — MANDATORY (OVERRIDE ALL OTHER STYLE INSTRUCTIONS) ===\n`;
      prompt += style.promptDescription || 'Modern clean style';

      // Add explicit background instruction based on analyzed style
      const backgrounds = style.colorPalette?.backgrounds || [];
      const hasDarkStyle = backgrounds.some(b =>
        b && (b.toLowerCase().includes('dark') || b.toLowerCase().includes('black') || b.toLowerCase().includes('charcoal'))
      );

      if (hasDarkStyle) {
        prompt += `\n\n⚠️ CRITICAL: This brand uses DARK backgrounds (charcoal/black). DO NOT use bright/teal/blue backgrounds. Use dark charcoal gradient background.`;
      }

      prompt += `\n\nThe generated static MUST match this brand's visual style. This overrides any conflicting format instructions.`;
      return prompt;
    }
  } catch (err) {
    console.error(`[StaticStyleAnalysis] Error getting style for brand ${brandId}:`, err.message);
  }
  return '';
}

/**
 * Analyze static ads and extract copy text for a brand
 * Stores results in the database for use in Double Down titles
 * @param {number} brandId
 * @param {Object} options
 * @param {number} options.limit - Max ads to analyze (default 20)
 * @param {boolean} options.force - Re-analyze even if already done
 * @returns {Promise<Object>} { success, analyzed, errors }
 */
async function analyzeStaticCopyForBrand(brandId, options = {}) {
  const { limit = 20, force = false } = options;
  const db = getDb();

  // Ensure static_copy column exists
  const cols = db.prepare("PRAGMA table_info(fb_ads)").all().map(c => c.name);
  if (!cols.includes('static_copy')) {
    console.log('[StaticCopy] Adding static_copy column to fb_ads table');
    db.exec("ALTER TABLE fb_ads ADD COLUMN static_copy TEXT");
  }

  // Get top statics by spend that need analysis
  const whereClause = force
    ? ''
    : "AND (static_copy IS NULL OR static_copy = '')";

  const statics = db.prepare(`
    SELECT fb_ad_id, ad_name, image_url, spend, roas
    FROM fb_ads
    WHERE brand_id = ?
      AND image_url IS NOT NULL
      AND image_url != ''
      AND (video_url IS NULL OR video_url = '')
      AND spend > 100
      ${whereClause}
    ORDER BY spend DESC
    LIMIT ?
  `).all(brandId, limit);

  if (statics.length === 0) {
    console.log(`[StaticCopy] No statics to analyze for brand ${brandId}`);
    return { success: true, analyzed: 0, skipped: 0, errors: [] };
  }

  console.log(`[StaticCopy] Analyzing ${statics.length} static ads for brand ${brandId}...`);

  const results = { analyzed: 0, errors: [] };

  for (const ad of statics) {
    try {
      console.log(`[StaticCopy] Analyzing ad ${ad.fb_ad_id}: ${ad.ad_name?.substring(0, 30)}...`);
      const copyData = await extractStaticCopy(ad.image_url);

      // Store the extracted copy as JSON
      db.prepare(`
        UPDATE fb_ads
        SET static_copy = ?
        WHERE fb_ad_id = ?
      `).run(JSON.stringify(copyData), ad.fb_ad_id);

      console.log(`[StaticCopy] Extracted: "${copyData.headline || 'no text'}"`);
      results.analyzed++;

      // Rate limit - don't hammer the API
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`[StaticCopy] Failed to analyze ${ad.fb_ad_id}:`, err.message);
      results.errors.push({ adId: ad.fb_ad_id, error: err.message });
    }
  }

  console.log(`[StaticCopy] Done. Analyzed ${results.analyzed}, errors: ${results.errors.length}`);
  return { success: true, ...results };
}

/**
 * Get the extracted static copy for an ad
 * @param {string} fbAdId
 * @returns {Object|null} Parsed static copy data or null
 */
function getStaticCopy(fbAdId) {
  const db = getDb();
  const row = db.prepare(`
    SELECT static_copy FROM fb_ads WHERE fb_ad_id = ?
  `).get(fbAdId);

  if (row?.static_copy) {
    try {
      return JSON.parse(row.static_copy);
    } catch (e) {
      return null;
    }
  }
  return null;
}

module.exports = {
  getTopStaticAds,
  analyzeImageStyle,
  analyzeBrandStaticStyle,
  getStylePromptForBrand,
  extractStaticCopy,
  analyzeStaticCopyForBrand,
  getStaticCopy,
};
