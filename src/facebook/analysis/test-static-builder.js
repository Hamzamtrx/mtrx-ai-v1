/**
 * Test Static Builder — Skill-based prompt generation for test statics
 * Combines test ideas with proper skill templates from the image generator
 * Can dynamically generate new format prompts using Claude
 */

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { generateAICopy } = require('./copy-generator');

// Paths to skill files
const SKILLS_BASE = path.join(__dirname, '../../../skills/mtrx-ai-v2/skills/apparel');
const CONFIG_PATH = path.join(__dirname, '../../../skills/mtrx-ai-v2/config/static-types.json');

// Map format names to skill types
const FORMAT_TO_SKILL = {
  'product_hero': 'type1',
  'meme': 'type2',
  'aesthetic': 'type3',
  'illustrated': 'type4',
  'vintage': 'type3', // Uses aesthetic template with vintage styling
  'ugc': 'type2', // Uses meme template with UGC styling
};

// Skill file names
const SKILL_FILES = {
  'type1': 'type1-product-hero.md',
  'type2': 'type2-meme.md',
  'type3': 'type3-aesthetic-offer.md',
  'type4': 'type4-animated-benefits.md',
};

/**
 * Load static types config
 */
function loadConfig() {
  try {
    const content = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error('[TestStaticBuilder] Could not load config:', err.message);
    return null;
  }
}

/**
 * Load and parse a skill template
 */
function loadSkillTemplate(skillType) {
  const filename = SKILL_FILES[skillType];
  if (!filename) return null;

  const filepath = path.join(SKILLS_BASE, filename);
  try {
    return fs.readFileSync(filepath, 'utf8');
  } catch (err) {
    console.error(`[TestStaticBuilder] Could not load skill ${skillType}:`, err.message);
    return null;
  }
}

/**
 * Extract the IMAGE PROMPT section from a skill template
 */
function extractPromptTemplate(skillContent) {
  // Find the IMAGE PROMPT section
  const promptMatch = skillContent.match(/## IMAGE PROMPT[^\n]*\n+```([^`]+)```/);
  if (promptMatch) {
    return promptMatch[1].trim();
  }

  // Fallback: find any large code block that looks like a prompt
  const codeBlocks = skillContent.match(/```([^`]{500,})```/g);
  if (codeBlocks && codeBlocks.length > 0) {
    return codeBlocks[0].replace(/```/g, '').trim();
  }

  return null;
}

/**
 * Extract EXAMPLE PROMPT from a skill template
 */
function extractExamplePrompt(skillContent) {
  const exampleMatch = skillContent.match(/## EXAMPLE PROMPT[^\n]*\n+```([^`]+)```/);
  if (exampleMatch) {
    return exampleMatch[1].trim();
  }
  return null;
}

/**
 * Generate dynamic copy based on test data, format type, and winning copy patterns
 */
function generateCopy(test, format, config) {
  const copyFrameworks = config?.copy_frameworks || {};
  const framework = copyFrameworks[FORMAT_TO_SKILL[format]] || {};

  const hook = test.hook || '';
  const angle = test.angle || '';

  // Use winning copy patterns if available for inspiration
  const winningCopy = test.winningCopy || [];
  const strategicContext = test.strategicContext || {};

  // Extract a winning headline pattern if available
  const topWinningHeadline = winningCopy.length > 0 ? winningCopy[0].headline : null;

  switch (format) {
    case 'product_hero':
      return {
        headline: hook.toUpperCase(),
        // Only show offer if we have a real benefit, not generic placeholder
        offerText: test.keyBenefit && test.keyBenefit !== 'high quality' ? '✓ ' + test.keyBenefit : '',
        ctaText: 'SHOP NOW',
      };

    case 'meme':
      return {
        topPanel: hook,
        bottomPanel: generateMemeResponse(test),
      };

    case 'aesthetic':
      return {
        productCode: generateProductCode(test),
        announcement: 'NOW AVAILABLE',
        badge: 'LIMITED EDITION',
      };

    case 'illustrated':
      return {
        headline1: hook.split('.')[0].toUpperCase() + '.',
        headline2: angle ? angle.toUpperCase() + '.' : '',
        benefits: extractBenefits(test),
        cta: 'SHOP NOW',
      };

    case 'vintage':
      return {
        headline: hook.toUpperCase(),
        subheadline: angle || '',
        badge: test.keyBenefit ? test.keyBenefit.toUpperCase() : '',
      };

    case 'ugc':
      return {
        caption: hook,
        hashtag: '#' + (test.brandName || 'brand').replace(/\s+/g, ''),
      };

    default:
      return { headline: hook };
  }
}

/**
 * Generate a meme-style humble product response
 */
function generateMemeResponse(test) {
  const productType = test.productType || 'shirt';
  const material = test.material || 'premium fabric';
  const useCases = test.useCases || ['wear to work', 'the gym', 'date night'];
  const benefit = test.keyBenefit || 'incredibly comfortable';

  return `I'm literally just a ${productType} made from ${material} that you can ${useCases.slice(0, 3).join(', ')} that's ${benefit}.`;
}

/**
 * Generate a product code for aesthetic format
 */
function generateProductCode(test) {
  const codes = ['001', '007', '042', '100'];
  const names = ['CLASSIC', 'CORE', 'ESSENTIAL', 'SIGNATURE'];
  const code = codes[Math.floor(Math.random() * codes.length)];
  const name = names[Math.floor(Math.random() * names.length)];
  return `${code}: ${name}`;
}

/**
 * Extract benefits from test data
 */
function extractBenefits(test) {
  // Try to extract from angle or copy direction
  const defaults = ['PREMIUM QUALITY', 'MADE TO LAST', 'SATISFACTION GUARANTEED'];

  if (test.benefits && Array.isArray(test.benefits)) {
    return test.benefits.slice(0, 3).map(b => b.toUpperCase());
  }

  // Try to parse from copy direction
  if (test.copyDirection) {
    const words = test.copyDirection.split(/[,;|]/).map(w => w.trim()).filter(Boolean);
    if (words.length >= 3) {
      return words.slice(0, 3).map(w => w.toUpperCase());
    }
  }

  return defaults;
}

/**
 * Build a Type 1 Product Hero prompt
 */
function buildType1Prompt({ test, copy, brandName, accentColor = 'orange' }) {
  return `Static advertisement for premium apparel brand.

LAYOUT:
Dark charcoal gradient background — darker at edges, slightly lighter in center.
Subtle vignette effect.

PRODUCT DISPLAY:
Three garments arranged horizontally:
- CENTER: Largest, fully visible, hero position, facing forward
- LEFT: Smaller (80% size), slightly faded, angled toward center
- RIGHT: Smaller (80% size), slightly faded, angled toward center

Clean product photography style — no wrinkles, perfect form.
Subtle reflection beneath each garment on dark surface.

TEXT ELEMENTS:
TOP CENTER: Brand logo "${brandName}" in white stylized script font

MAIN HEADLINE (largest text, center of attention):
"${copy.headline}"
- Large bold white sans-serif, ALL CAPS
- This is the PRIMARY message - should be immediately readable
- Position below logo, above product or overlaying upper portion
${copy.offerText ? `
BENEFIT LINE (below headline):
"${copy.offerText}" in ${accentColor}
- Smaller than headline
- Single line` : ''}

BOTTOM CENTER: Rectangular button with "${copy.ctaText}" — ${accentColor} background, dark text

TYPOGRAPHY:
- Brand: Stylized script font, white
- Headline: Bold sans-serif (like Montserrat Black), white, LARGEST text
- Offer line: Medium weight, ${accentColor}
- CTA: Bold, dark text on ${accentColor} button

STYLE:
Clean, premium, high-end apparel brand energy.
High contrast — dark background, white text, ${accentColor} accents.
Professional product photography aesthetic.
NOT cluttered. Breathing room between elements.

ASPECT RATIO: 4:5

=== CRITICAL - DO NOT INCLUDE ===
- Do NOT add subtitles like "Product Hero" or format type names
- Do NOT add any text that isn't specified above
- The ONLY text should be: brand name, headline, offer line (if provided), and CTA
- NO extra descriptive labels or categories

NOT: Busy backgrounds, multiple fonts, cluttered layout, low contrast, cheap looking.`;
}

/**
 * Build a Type 2 Meme prompt
 */
function buildType2Prompt({ test, copy, brandName }) {
  return `Static meme advertisement for apparel brand. Two-panel comic/meme format.

STYLE:
Clean white/off-white background.
Simple flat illustration style like popular internet memes.
Chad/Nordic Gamer meme aesthetic.

TOP PANEL:
Left side: Simplified illustration of a person in profile view.
- Full beard, strong jawline
- Black turtleneck sweater
- "Chad" or "Nordic Gamer" meme style
- Looking toward the right
- Peaceful, appreciative expression

Right side of top panel: Black text, casual handwritten-style font:
"${copy.topPanel}"

DIVIDING LINE:
Clear visual break between panels.

BOTTOM PANEL:
Left side: Black text, same casual font:
"${copy.bottomPanel}"

Right side of bottom panel: Clean product image
- Premium apparel product
- Floating on white background
- Professional product photography style

TYPOGRAPHY:
- Casual, slightly hand-drawn looking font
- Black text on white
- Medium weight

OVERALL:
Meme format — looks organic and shareable.
Self-aware, humble humor.
NOT salesy. NOT corporate.

ASPECT RATIO: 1:1

NOT: Professional ad look, gradients, fancy typography, stock photos, corporate polish.`;
}

/**
 * Build a Type 3 Aesthetic + Offer prompt
 */
function buildType3Prompt({ test, copy, brandName, accentColor = 'orange' }) {
  return `Static advertisement for premium apparel brand. Aesthetic product photography with text overlay.

PRODUCT PHOTOGRAPHY:
Folded stack arrangement.

PRODUCT:
Multiple garments stacked neatly.
Premium fabric texture visible.
Brand tag visible on top item.
Natural shadows and depth.
NOT floating — sitting ON a real surface.

SURFACE/BACKGROUND:
Dark weathered wood grain texture.
Real texture, NOT flat color.
Moody, premium feel.
Subtle vignette darkening at edges.

LIGHTING:
Soft directional light from upper left.
Natural shadows.
Highlights on fabric folds.
NOT flat lighting. NOT harsh.

TEXT OVERLAY:
SMALL TEXT (top area): "${brandName}"
- Small, subtle
- White

PRODUCT CODE (above main headline):
"${copy.productCode}"
- ${accentColor}
- ALL CAPS
- Medium size

MAIN HEADLINE (center-bottom area):
"${copy.announcement}"
- WHITE
- BOLD
- HUGE — dominant element
- ALL CAPS

BADGE (below headline):
Rectangular badge shape
"${copy.badge}"
- ${accentColor} background
- Dark text
- ALL CAPS

TYPOGRAPHY:
- Clean sans-serif (like Bebas Neue, Oswald)
- High contrast against dark background
- Clear hierarchy: small → medium → HUGE → badge

OVERALL:
Premium streetwear/DTC brand aesthetic.
Moody but not dark.
Texture-rich.
Creates desire and urgency.

ASPECT RATIO: 4:5

NOT: Flat backgrounds, cheap lighting, stock photo style, cluttered, low contrast text.`;
}

/**
 * Build a Type 4 Illustrated Benefits prompt
 */
function buildType4Prompt({ test, copy, brandName, accentColor = 'orange' }) {
  const benefits = copy.benefits || ['PREMIUM QUALITY', 'MADE TO LAST', 'GUARANTEED'];

  return `Static illustrated advertisement for apparel brand. Cartoon/animated style with benefit callouts.

STYLE:
Cartoon illustration style — modern animated ad aesthetic.
Clean lines, flat colors with subtle shading.
Fun, approachable, adult audience.

SCENE:
Backyard setting:
- Wooden fence across background
- Green grass at bottom
- Blue sky with stylized sun rays bursting from behind product
- Warm, friendly, everyday environment

PRODUCT (CENTER HERO):
Folded apparel stack floating in center of frame.
Elevated above the grass, hero positioning.
White sparkle/star effects around product — magical reveal moment.
Product rendered as slightly 3D illustration, clean and premium looking.

HEADLINE (TOP):
"${copy.headline || copy.headline1 || ''}"
${copy.subheadline || copy.headline2 ? `"${copy.subheadline || copy.headline2}"` : ''}
- Bold black text
- ALL CAPS
- Strong sans-serif font
- Stacked, left-aligned

BENEFIT BADGES (BELOW PRODUCT):
Three pill-shaped badges in a row:
"${benefits[0]}" | "${benefits[1]}" | "${benefits[2]}"
- Cream/tan colored badges with subtle shadow
- Dark text
- ALL CAPS
- Rounded rectangle shape

CHARACTERS:
LEFT: Two regular people standing together, skeptical/curious expressions, looking at product
RIGHT: Authority figure (doctor in white lab coat OR scientist OR expert) gesturing toward product with confidence, explaining/presenting

The right character should clearly look like an EXPERT or AUTHORITY — white coat, professional appearance, confident posture.
All characters in simple cartoon style — adult, not childish.

CTA (BOTTOM):
${accentColor} banner spanning width:
"${copy.ctaText || copy.cta || 'SHOP NOW'}"
- Bold text
- ALL CAPS
- Slight rounded corners

COLORS:
Background: Blue sky, green grass, brown fence
Product: Reference product colors
Text: Black
Badges: Cream/tan
CTA: ${accentColor} banner

OVERALL:
Fun, shareable, educational.
Clear messaging.
Product is hero moment.
Feels native to social feed.

ASPECT RATIO: 4:5

NOT: Realistic photo, corporate, cluttered, childish, low quality illustration.`;
}

/**
 * Build a Vintage Magazine style prompt
 */
function buildVintagePrompt({ test, copy, brandName, accentColor = 'gold' }) {
  return `Static advertisement in vintage magazine editorial style.

STYLE:
Retro 1960s-70s magazine advertisement aesthetic.
Warm, slightly faded color palette.
Classic editorial layout with bold typography.
Nostalgic, premium, timeless.

LAYOUT:
Vertical magazine ad format.
Product prominently featured in center/upper area.
Large headline text below or above product.
Editorial grid structure.

PRODUCT:
Premium apparel product displayed elegantly.
Styled like vintage fashion photography.
Soft lighting, slight warmth to colors.
Product clearly visible and appealing.

TEXT ELEMENTS:
HEADLINE: "${copy.headline || 'PREMIUM QUALITY'}"
- Classic serif or bold sans-serif font
- Vintage advertising typography
- Large, commanding
${copy.subheadline ? `
SUBHEADLINE: "${copy.subheadline}"
- Smaller, supporting text
- Elegant script or clean sans-serif
` : ''}
${copy.badge || copy.offerText ? `
BADGE: "${copy.badge || copy.offerText || ''}"
- Retro badge or stamp style
- ${accentColor} accent
` : ''}

BRAND: "${brandName}"
- Classic logo placement
- Top or bottom of frame

COLORS:
Warm, slightly desaturated palette.
Cream, tan, warm grays.
${accentColor} accents.
Vintage paper texture feeling.

OVERALL:
Feels like a rediscovered classic ad.
Premium, timeless quality.
Would fit in a 1960s Esquire or GQ.
NOT modern, NOT digital-first.

ASPECT RATIO: 4:5

NOT: Modern minimalism, harsh colors, digital aesthetic, cheap or DIY looking.`;
}

/**
 * Build a UGC Caption style prompt
 */
function buildUGCPrompt({ test, copy, brandName }) {
  return `Static advertisement in authentic UGC (user-generated content) style.

STYLE:
Looks like a real person showing off the product.
iPhone photo aesthetic — natural, slightly imperfect.
Bold text overlay for the headline.
Authentic, relatable, not overly polished.

SCENE:
Real-life setting — living room, kitchen counter, or casual indoor space.
Natural lighting (window light, daylight).
Casual environment that feels genuine.

SUBJECT:
Person naturally presenting or wearing the product.
Candid, natural pose — friendly and approachable.
Genuine expression (smile, satisfaction).
The person should look like a real customer, not a model.

PRODUCT:
Apparel product clearly visible and prominent.
Should match the reference product image exactly.
Multiple items of the product visible if possible.

TEXT OVERLAY (BELOW IMAGE):
Main headline in bold dark font:
"${copy.headline || copy.caption}"

Subtext in smaller gray font:
"${copy.subheadline || copy.caption}"

CTA link in ${brandName} accent color:
"Shop ${brandName}"

LAYOUT:
- Top portion: Photo of person with product (square or slightly tall crop)
- Bottom portion: White/light background with text

=== CRITICAL - DO NOT INCLUDE ===
- Do NOT add fake social media handles like "@real_customer_name" or "@username"
- Do NOT add fake engagement metrics (likes, comments, shares)
- Do NOT add Instagram/TikTok UI elements
- Do NOT add placeholder text of any kind
- The ONLY text should be: headline, subtext, and shop CTA

ASPECT RATIO: 4:5

NOT: Fake usernames, social media UI, placeholder text, stock photo look, overly polished production.`;
}

/**
 * Build a Comparison (side-by-side) prompt
 * Modern minimal style like Huel ads - clean, bright, simple
 */
function buildComparisonPrompt({ test, copy, brandName, accentColor = 'orange' }) {
  const leftLabel = copy.leftLabel || 'Regular Shirts';
  const rightLabel = copy.rightLabel || brandName;

  return `Static advertisement. Modern minimal comparison format.

STYLE REFERENCE: Clean, modern like Huel comparison ads. Bright, minimal, easy to read.

BACKGROUND:
Solid bright color - bright yellow, coral orange, or vibrant teal.
NOT white, NOT gray, NOT dark.
Single flat color, no gradients.

LAYOUT (TOP TO BOTTOM):
1. HEADLINE at top
2. Two products side by side
3. Simple comparison grid/table
4. Brand name at bottom

HEADLINE (TOP):
"${copy.headline || 'No time for bad shirts? No problem.'}"
- Bold black sans-serif text
- Conversational, not shouty
- Can be a question format

PRODUCT COMPARISON (MIDDLE):
LEFT SIDE:
- Small label: "${leftLabel}" in simple text
- Product image: Generic faded shirt or pile of cheap shirts
- Should look obviously worse/boring

"vs" text between them (lowercase, simple)

RIGHT SIDE:
- Small label: "${rightLabel}" in simple text
- Product image: The premium product from reference - clean, crisp
- Should look obviously better/premium

COMPARISON TABLE (BELOW PRODUCTS):
Simple 2-column comparison with 3-4 rows:
| ${leftLabel} | ${rightLabel} |
| Lasts 15 washes | Lasts 200+ washes |
| $1/wear | $0.20/wear |
| Synthetic | Natural Hemp |

Use simple text, no fancy icons.
Green checkmarks or text for the winning side.

BOTTOM:
"${copy.ctaText || 'Try it'}" - simple text link or small button
Brand name: "${brandName}" in clean font

TYPOGRAPHY:
- Bold sans-serif for headline (like Poppins, Inter)
- Clean readable font for comparison table
- High contrast (black text on bright background)

OVERALL VIBE:
- MODERN and MINIMAL - like a tech company ad
- Bright and cheerful, not corporate
- Easy to understand in 2 seconds
- Looks like it belongs on Instagram in 2024

ASPECT RATIO: 4:5

=== CRITICAL ===
- Use ONLY USD currency ($) - no euros, no pounds
- Keep it SIMPLE - not cluttered
- Bright solid background color is KEY
- NO fake reviews, NO star ratings, NO customer quotes
- NO chemical structures or scientific imagery`;
}

/**
 * Build a Before/After transformation prompt
 * Modern minimal style - clean, bright, simple like Huel
 */
function buildBeforeAfterPrompt({ test, copy, brandName, accentColor = 'orange' }) {
  return `Static advertisement. Modern minimal before/after format.

STYLE REFERENCE: Clean, modern, bright. Like a tech startup ad.

BACKGROUND:
Solid bright color - mint green, soft coral, or light blue.
Single flat color throughout.
NOT white, NOT dark.

LAYOUT (TOP TO BOTTOM):
1. Headline at top
2. Before/After comparison in middle
3. Simple CTA at bottom

HEADLINE (TOP):
"${copy.headline || 'Your closet, simplified.'}"
- Bold black sans-serif text
- Short, punchy, modern
- Centered

BEFORE/AFTER COMPARISON (MIDDLE):
Split into two columns with simple arrow or "→" between

LEFT - "Before":
- Small "Before" label in gray
- Image: Messy pile of 5-6 different shirts, cluttered
- Looks chaotic and overwhelming

RIGHT - "After":
- Small "After" label in gray
- Image: Single clean premium shirt (from reference)
- Clean, minimal, premium
- Maybe on a simple hanger or folded neatly

Arrow or "→" symbol between the two sides

BENEFITS (BELOW COMPARISON):
Simple one-line text:
"${copy.subheadline || 'One shirt. Work, weekend, date night.'}"
- Small, clean font
- Centered

BOTTOM:
Brand name: "${brandName}" in clean modern font
Small CTA: "${copy.ctaText || 'Shop now'}"

TYPOGRAPHY:
- Modern sans-serif (like Inter, Poppins)
- Clean and readable
- Black text on bright background

OVERALL VIBE:
- MINIMAL - lots of breathing room
- Bright and fresh
- Modern startup aesthetic
- Easy to understand instantly

ASPECT RATIO: 4:5

=== CRITICAL ===
- Use ONLY USD ($) if showing prices
- Keep it EXTREMELY simple
- Bright solid background is KEY
- NO cluttered elements
- NO fake timestamps or social media UI`;
}

/**
 * Main function: Build a test static prompt using skill templates
 */
function buildTestStaticPrompt({ test, format, brandName, accentColor = 'orange' }) {
  const config = loadConfig();
  const copy = generateCopy(test, format, config);

  const params = { test, copy, brandName, accentColor };

  switch (format) {
    case 'product_hero':
      return buildType1Prompt(params);

    case 'meme':
      return buildType2Prompt(params);

    case 'aesthetic':
      return buildType3Prompt(params);

    case 'illustrated':
      return buildType4Prompt(params);

    case 'vintage':
      return buildVintagePrompt(params);

    case 'ugc':
      return buildUGCPrompt(params);

    case 'comparison':
      return buildComparisonPrompt(params);

    case 'before_after':
      return buildBeforeAfterPrompt(params);

    default:
      // Fallback to Type 1
      return buildType1Prompt(params);
  }
}

/**
 * Get all available format types with their descriptions
 */
function getAvailableFormats() {
  return {
    'product_hero': {
      name: 'Product Hero',
      description: 'Clean product display with bold headline and offer',
      aspectRatio: '4:5',
      bestFor: ['launches', 'retargeting', 'brand awareness'],
    },
    'meme': {
      name: 'Meme Style',
      description: 'Internet meme format with humble product response',
      aspectRatio: '1:1',
      bestFor: ['TOF awareness', 'viral potential', 'younger audiences'],
    },
    'aesthetic': {
      name: 'Aesthetic + Offer',
      description: 'Premium product photography with announcement overlay',
      aspectRatio: '4:5',
      bestFor: ['drops', 'limited editions', 'restocks'],
    },
    'illustrated': {
      name: 'Illustrated Benefits',
      description: 'Cartoon style with benefit callouts',
      aspectRatio: '4:5',
      bestFor: ['education', 'comparison', 'shareable content'],
    },
    'vintage': {
      name: 'Vintage Magazine',
      description: 'Retro editorial magazine ad style',
      aspectRatio: '4:5',
      bestFor: ['premium positioning', 'nostalgia', 'differentiation'],
    },
    'ugc': {
      name: 'UGC Caption',
      description: 'Authentic user-generated content style',
      aspectRatio: '4:5',
      bestFor: ['social proof', 'authenticity', 'TOF'],
    },
    'comparison': {
      name: 'Comparison',
      description: 'Side-by-side comparison showing problem vs solution',
      aspectRatio: '4:5',
      bestFor: ['differentiation', 'competitor positioning', 'education'],
    },
  };
}

/**
 * Dynamically generate a prompt for a new/unknown format using Claude
 */
async function generateDynamicFormatPrompt({ formatName, test, brandName, accentColor = 'orange' }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[TestStaticBuilder] No ANTHROPIC_API_KEY, falling back to product_hero');
    return buildType1Prompt({ test, copy: generateCopy(test, 'product_hero', null), brandName, accentColor });
  }

  const client = new Anthropic();

  // Example prompts for reference
  const exampleProductHero = buildType1Prompt({
    test: { hook: 'EXAMPLE HOOK' },
    copy: { headline: 'EXAMPLE HEADLINE', offerText: '✓ Example Offer', ctaText: 'SHOP NOW' },
    brandName: 'ExampleBrand',
    accentColor: 'orange'
  });

  const exampleMeme = buildType2Prompt({
    test: { hook: 'Example hook' },
    copy: { topPanel: 'Thank you for changing my life', bottomPanel: "I'm literally just a shirt..." },
    brandName: 'ExampleBrand'
  });

  const systemPrompt = `You are an expert at writing image generation prompts for advertising static images.
You create detailed, structured prompts that AI image generators can follow to create high-quality ad creatives.

Your prompts should include:
- STYLE section (overall aesthetic)
- LAYOUT section (composition and arrangement)
- PRODUCT section (how the product appears)
- TEXT ELEMENTS section (headlines, copy, CTAs with exact text)
- TYPOGRAPHY section (font styles, sizes)
- COLORS section
- OVERALL section (mood, feel)
- ASPECT RATIO
- NOT section (what to avoid)

Here are two example prompts for reference:

EXAMPLE 1 - Product Hero format:
${exampleProductHero.substring(0, 1500)}...

EXAMPLE 2 - Meme format:
${exampleMeme.substring(0, 1500)}...`;

  const userPrompt = `Create an image generation prompt for a "${formatName}" style static ad.

Brand: ${brandName}
Hook/Headline: "${test.hook || 'Premium Quality'}"
Angle: ${test.angle || 'Quality and value'}
Copy Direction: ${test.copyDirection || 'Bold and confident'}
Visual Direction: ${test.visualDirection || 'Clean and professional'}
Accent Color: ${accentColor}

The "${formatName}" format should be interpreted based on its name. For example:
- "news_editorial" = newspaper/magazine editorial style with bold headlines
- "comparison" = side-by-side or A vs B comparison (left=problem, right=solution)
- "before_after" = transformation visual showing change
- "infographic" = data/stats visualization with icons
- "minimalist" = ultra-clean, whitespace-heavy design
- "bold_typography" = text-dominant design with impactful fonts
- "social_proof" = reviews/testimonials focus with star ratings
- "scientific" = clinical/lab aesthetic with data points
- "lifestyle" = product in real-world context
- "premium" = luxury/high-end aesthetic

Generate a complete, detailed image generation prompt for this format. Include the actual headline text "${test.hook || 'YOUR HEADLINE HERE'}" in the TEXT ELEMENTS section.

CRITICAL: The prompt MUST end with this exact section:

PRODUCT REFERENCE — CRITICAL:
• The product in the image MUST match the reference image EXACTLY
• Same product design, colors, labels, and details
• Do NOT substitute with a different product`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      system: systemPrompt,
    });

    let generatedPrompt = response.content[0].text;

    // Ensure product reference instruction is always included
    if (!generatedPrompt.includes('PRODUCT REFERENCE')) {
      generatedPrompt += `\n\nPRODUCT REFERENCE — CRITICAL:\n• The product in the image MUST match the reference image EXACTLY\n• Same product design, colors, labels, and details\n• Do NOT substitute with a different product`;
    }

    console.log(`[TestStaticBuilder] Generated dynamic prompt for "${formatName}" format`);
    return generatedPrompt;
  } catch (err) {
    console.error('[TestStaticBuilder] Claude generation failed:', err.message);
    // Fallback to product hero
    return buildType1Prompt({ test, copy: generateCopy(test, 'product_hero', null), brandName, accentColor });
  }
}

/**
 * Main function: Build a test static prompt using skill templates
 * Now supports dynamic format generation for unknown formats
 * Uses AI to generate copy based on test angle
 */
async function buildTestStaticPromptAsync({ test, format, brandName, logoUrl, accentColor = 'orange' }) {
  const config = loadConfig();
  const knownFormats = ['product_hero', 'meme', 'aesthetic', 'illustrated', 'vintage', 'ugc', 'comparison', 'before_after'];

  // Generate AI copy for known formats
  if (knownFormats.includes(format)) {
    try {
      // Use AI to generate copy based on test angle
      const aiCopy = await generateAICopy({
        format,
        test,
        brandName,
        winningCopy: test.winningCopy || [],
        strategicContext: test.strategicContext || {},
      });

      // Build prompt with AI-generated copy
      return buildPromptWithCopy({ format, copy: aiCopy, brandName, logoUrl, accentColor });
    } catch (err) {
      console.error('[TestStaticBuilder] AI copy failed, using fallback:', err.message);
      return buildTestStaticPrompt({ test, format, brandName, accentColor });
    }
  }

  // Otherwise, dynamically generate a prompt for this new format
  console.log(`[TestStaticBuilder] Unknown format "${format}" - generating dynamic prompt`);
  return generateDynamicFormatPrompt({ formatName: format, test, brandName, accentColor });
}

/**
 * Build prompt with pre-generated copy (AI or fallback)
 * Now includes visual direction from AI to match test angle
 */
function buildPromptWithCopy({ format, copy, brandName, logoUrl, accentColor }) {
  const params = { copy, brandName, accentColor };

  // Get the base prompt
  let basePrompt;
  switch (format) {
    case 'product_hero':
      basePrompt = buildType1Prompt({ ...params, test: {} });
      break;
    case 'meme':
      basePrompt = buildType2Prompt({ ...params, test: {} });
      break;
    case 'aesthetic':
      basePrompt = buildType3Prompt({ ...params, test: {} });
      break;
    case 'illustrated':
      basePrompt = buildType4Prompt({ ...params, test: {} });
      break;
    case 'vintage':
      basePrompt = buildVintagePrompt({ ...params, test: {} });
      break;
    case 'ugc':
      basePrompt = buildUGCPrompt({ ...params, test: {} });
      break;
    case 'comparison':
      basePrompt = buildComparisonPrompt({ ...params, test: {} });
      break;
    case 'before_after':
      basePrompt = buildBeforeAfterPrompt({ ...params, test: {} });
      break;
    default:
      basePrompt = buildType1Prompt({ ...params, test: {} });
  }

  // Add visual direction from AI - THIS IS CRITICAL for matching the test
  if (copy.visualDirection) {
    basePrompt += `\n\n=== TEST VISUAL DIRECTION — MANDATORY ===
${copy.visualDirection}

THIS IS NOT OPTIONAL. The image MUST include this visual element to properly test the hypothesis.
If the test is about "Expert Authority" → show a doctor/scientist/expert in the image
If the test is about "Founder" → show an entrepreneur/founder figure
If the test is about "Comparison" → show side-by-side contrast
The visual direction above tells you EXACTLY what to show.`;
  }

  // Add strong product reference instruction
  basePrompt += `\n\nPRODUCT REFERENCE — CRITICAL:\n• The product in the image MUST match the reference image EXACTLY\n• Same product design, colors, labels, and details\n• Do NOT substitute with a different product`;

  // Add brand name instruction - use text styling, not logo graphics
  basePrompt += `\n\n=== BRAND NAME — CRITICAL ===
• Brand name is "${brandName}" - spell EXACTLY as shown: ${brandName.split('').join('-')}
• Render brand name as CLEAN TEXT only - stylized script font or bold sans-serif
• Do NOT attempt to create a logo graphic or icon
• Do NOT add any symbol, emblem, or graphic next to the brand name
• Just clean, well-styled text that reads "${brandName}"
• Position: Top center of image (above headline) in white or brand-appropriate color
• If the AI cannot render the brand name perfectly, LEAVE THAT SPACE BLANK - do not attempt to render it badly`;

  return basePrompt;
}

module.exports = {
  buildTestStaticPrompt,
  buildTestStaticPromptAsync,
  generateDynamicFormatPrompt,
  getAvailableFormats,
  generateCopy,
  loadConfig,
};
