/**
 * Test Static Builder — Skill-based prompt generation for test statics
 * Combines test ideas with proper skill templates from the image generator
 * Can dynamically generate new format prompts using Claude
 */

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { generateAICopy } = require('./copy-generator');
const { getStylePromptForBrand } = require('./static-style-analysis');
const { getDb } = require('../../database/db');

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
    case 'ugc_style':
      return {
        headline: generateUGCStoryHeadline(test),
        subheadline: hook,
        caption: hook,
        hashtag: '#' + (test.brandName || 'brand').replace(/\s+/g, ''),
      };

    case 'testimonial':
      return {
        testimonialStory: generateTestimonialStory(test),
        headline: generateUGCStoryHeadline(test),
        photoSetting: 'Cozy home environment — living room with natural light.',
        personDescription: test.persona?.description || 'Real-looking person, genuine smile, casual clothes.',
        productInteraction: 'Naturally holding or wearing the product.',
      };

    case 'news_editorial':
      return {
        headline: test.hook || 'The Man Who Refused To Sell A Shirt He Wouldn\'t Wear',
        subheadline: test.angle || 'If I won\'t wear it myself, I\'ve got no business selling it to you',
        newspaperName: 'The American Textile Record',
        newspaperDate: 'Thursday, March 12, 1931',
        photoCaption: 'A craftsman inspects his work',
        photoSubject: 'Weathered 1930s American craftsman, late 50s, grey stubble, work-worn hands',
        photoAction: 'Sitting at wooden workbench, looking down at fabric he is hand-inspecting',
        photoSetting: 'Small textile workshop, warm natural window light from left',
        photoEmotion: 'quiet private moment of craftsmanship and pride',
        ctaLine: 'THEY STOPPED MAKING THEM. WE DIDN\'T.',
      };

    case 'stat_stack':
    case 'stat_stack_hero':
    case 'stat_hero':
    case 'proof_story':
      return generateStatStackCopy(test);

    default:
      return { headline: hook };
  }
}

/**
 * Generate copy for Stat Stack Hero format
 * Stats + badges + social proof for proof story ads
 */
function generateStatStackCopy(test) {
  const hook = test.hook || '';
  const angle = test.hypothesis?.angle || test.angle || '';
  const persona = test.persona?.id || '';
  const personaDesc = test.persona?.description || '';

  // Determine hero subject based on persona/angle
  const brandName = test.brandName || 'the brand';
  let heroSubject = 'rugged professional, mid 40s, confident stance';
  let heroAction = 'in their natural work environment';
  let heroClothing = `the EXACT ${brandName} shirt from reference image, work pants`;
  let setting = 'authentic workplace, natural lighting, real environment';
  let socialProofName = 'Real Customer';
  let socialProofCredential = 'Wears it every single day';

  // Customize based on persona
  if (persona.includes('blue_collar') || angle.toLowerCase().includes('work') || angle.toLowerCase().includes('job')) {
    heroSubject = 'rugged construction worker, mid 30s, tanned weathered skin';
    heroAction = 'carrying lumber on an active construction site';
    setting = 'busy job site, sawdust in air, bright midday sun';
    socialProofName = 'Jake, 34';
    socialProofCredential = 'General contractor — same shirt, 14 job sites, 3 years';
  } else if (angle.toLowerCase().includes('paycheck') || angle.toLowerCase().includes('professional') || angle.toLowerCase().includes('meeting')) {
    heroSubject = 'confident business professional, early 40s, sharp but approachable';
    heroAction = 'walking into a modern office building';
    heroClothing = `the EXACT ${brandName} shirt from reference under open blazer, dress pants`;
    setting = 'glass office building entrance, morning light';
    socialProofName = 'Marcus, 41';
    socialProofCredential = 'VP of Sales — 47 client meetings, same shirt';
  } else if (angle.toLowerCase().includes('ranch') || angle.toLowerCase().includes('farm')) {
    heroSubject = 'rugged cattle rancher, mid 40s, sun-weathered face';
    heroAction = 'standing in a cattle field at golden hour, hand resting on fence post';
    setting = 'open range, cattle blurred in background, warm golden sunlight';
    socialProofName = 'Tom, 44';
    socialProofCredential = 'Cattle rancher — same shirt, 600 acres, every day';
  } else if (angle.toLowerCase().includes('mechanic') || angle.toLowerCase().includes('garage')) {
    heroSubject = 'auto mechanic, late 30s, grease-stained hands';
    heroAction = 'leaning into an engine bay';
    setting = 'garage interior, tool chest visible, fluorescent mixed with window light';
    socialProofName = 'Mike, 38';
    socialProofCredential = 'Auto mechanic — same shirt through 2,200 oil changes';
  }

  // Generate badges based on brand (Undrdog defaults)
  const badges = [
    '4x stronger than cotton',
    'Zero microplastics',
    'Hemp + bamboo blend',
    'Lifetime guarantee',
  ];

  return {
    stats: null, // Will be generated by generateProofStats
    badges,
    heroSubject,
    heroAction,
    heroClothing,
    setting,
    socialProof: {
      name: socialProofName,
      credential: socialProofCredential,
    },
  };
}

/**
 * Generate a story-driven UGC headline that sounds personal and authentic
 * Based on examples like: "This best-selling Korean brand gave me maximum fullness"
 */
function generateUGCStoryHeadline(test) {
  const hook = test.hook || '';
  const angle = test.hypothesis?.angle || test.angle || '';
  const brandName = test.brandName || 'this brand';
  const benefit = test.keyBenefit || 'changed everything';

  // Story-driven headline templates that sound personal
  const templates = [
    `${brandName} ${benefit.toLowerCase().includes('my') ? benefit : 'gave me ' + benefit}`,
    `I was honestly skeptical, but after a month with ${brandName}...`,
    `Finally found ${angle.toLowerCase() || 'what I was looking for'}`,
    `${hook.replace(/\.$/, '')} — and I'm obsessed`,
    `After trying everything, ${brandName} actually worked`,
  ];

  // If the hook already sounds personal (starts with "I", "My", "After", "Finally"), use it
  if (/^(I |My |After |Finally |This |When )/i.test(hook)) {
    return hook;
  }

  // Otherwise pick a template and make it sound authentic
  const template = templates[Math.floor(Math.random() * templates.length)];
  return template;
}

/**
 * Generate a longer personal testimonial story
 * Based on examples with longer narrative text
 */
function generateTestimonialStory(test) {
  const hook = test.hook || '';
  const angle = test.hypothesis?.angle || test.angle || '';
  const brandName = test.brandName || 'this';
  const benefit = test.keyBenefit || '';
  const persona = test.persona?.description || '';

  // Build a personal story based on the test data
  const starters = [
    `I was honestly skeptical at first, but after using ${brandName} for a month`,
    `After years of trying different options, I finally found ${brandName}`,
    `My ${persona.includes('husband') || persona.includes('wife') ? 'partner' : 'friend'} kept recommending ${brandName}`,
    `I almost didn't buy it, but I'm so glad I did`,
  ];

  const middles = [
    benefit ? `and the ${benefit.toLowerCase()} is incredible` : 'I can\'t believe the difference',
    `now I can\'t imagine going back`,
    `and it\'s been a game changer`,
  ];

  const endings = [
    `I\'m obsessed 🙌`,
    `10/10 would recommend`,
    `Why didn't I find this sooner?`,
    `Finally! 😭`,
  ];

  const starter = starters[Math.floor(Math.random() * starters.length)];
  const middle = middles[Math.floor(Math.random() * middles.length)];
  const ending = endings[Math.floor(Math.random() * endings.length)];

  return `${starter}, ${middle}. ${ending}`;
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
- NO dashboards, analytics screens, charts, or graphs
- NO UI elements, app screenshots, or floating windows
- NO overlaid graphics or data visualizations
- JUST the product, headline, and CTA - KEEP IT CLEAN AND MINIMAL

NOT: Busy backgrounds, multiple fonts, cluttered layout, low contrast, cheap looking, dashboard graphics, analytics UI, floating screens.`;
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
 * Shows product in an environment that showcases its benefits
 */
function buildType3Prompt({ test, copy, brandName, accentColor = 'orange' }) {
  // Map copy fields (copy generator uses headline/subheadline/offerText)
  const productCode = copy.productCode || copy.subheadline || '001: SIGNATURE';
  const announcement = copy.announcement || copy.headline || 'BUILT TO LAST';
  const badge = copy.badge || copy.offerText || 'NOW AVAILABLE';

  // Determine the best environment based on the angle/hook
  const hook = (copy.visualDirection || test?.hook || '').toLowerCase();
  let environment = '';
  let environmentDesc = '';

  if (hook.includes('heat') || hook.includes('sweat') || hook.includes('cool') || hook.includes('breathe')) {
    environment = 'desert';
    environmentDesc = 'Vast golden sand dunes at golden hour, heat waves visible in the air, completely dry arid landscape';
  } else if (hook.includes('rain') || hook.includes('water') || hook.includes('wet')) {
    environment = 'rain';
    environmentDesc = 'Dramatic rainfall scene, water droplets in air, moody grey sky';
  } else if (hook.includes('work') || hook.includes('tough') || hook.includes('durable')) {
    environment = 'industrial';
    environmentDesc = 'Rugged industrial setting, concrete and steel, worksite environment';
  } else if (hook.includes('nature') || hook.includes('outdoor') || hook.includes('adventure')) {
    environment = 'mountain';
    environmentDesc = 'Epic mountain landscape at sunrise, misty valleys, adventure vibes';
  } else {
    environment = 'desert';
    environmentDesc = 'Vast golden sand dunes at golden hour, completely dry arid landscape, showcasing breathability';
  }

  return `Static advertisement for premium apparel brand. Product showcased in dramatic environment.

HERO SHOT:
The ${brandName} product (shirt from reference image) displayed in a dramatic ${environment} environment.
${environmentDesc}

PRODUCT PLACEMENT:
- Single product prominently displayed
- Could be worn by a person OR artfully placed in the environment
- The environment should CONTRAST with the product to highlight its benefits
- Product must match the reference image EXACTLY

COMPOSITION:
- Dramatic wide shot showing both product and environment
- Product is the clear focal point
- Environment tells the story (e.g., desert = stays cool/breathable, rain = handles anything)

TEXT OVERLAY:
SMALL TEXT (top area): "${brandName}"
- Small, subtle
- White

PRODUCT CODE (above main headline):
"${productCode}"
- ${accentColor}
- ALL CAPS
- Medium size

MAIN HEADLINE (center-bottom area):
"${announcement}"
- WHITE
- BOLD
- HUGE — dominant element
- ALL CAPS

BADGE (below headline):
Rectangular badge shape
"${badge}"
- ${accentColor} background
- Dark text
- ALL CAPS

TYPOGRAPHY:
- Clean sans-serif (like Bebas Neue, Oswald)
- High contrast - text must be readable against environment
- Clear hierarchy: small → medium → HUGE → badge
- Add subtle text shadow if needed for readability

OVERALL:
Premium adventure/lifestyle brand aesthetic.
Epic, cinematic feel.
Environment tells the product story.
Creates desire through context.

ASPECT RATIO: 4:5

=== CRITICAL ===
- The environment should SHOWCASE the product benefit (desert = breathable, rain = tough, etc.)
- Product must be clearly visible and match reference image
- This is NOT just product on a surface — it's product IN an environment
- Cinematic, editorial quality photography

NOT: Flat studio backgrounds, cheap lighting, stock photo style, product floating in space.`;
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
 * Build a Testimonial style prompt — personal story with product
 * Based on examples: mom holding baby, woman in casual setting, authentic lifestyle shots
 */
function buildTestimonialPrompt({ test, copy, brandName }) {
  // Create a personal, story-driven testimonial
  const testimonialStory = copy.testimonialStory || copy.headline ||
    `I was honestly skeptical at first, but after using it for a month I can\'t believe the difference.`;

  return `Static advertisement in authentic customer testimonial style.

STYLE:
Real customer photo with their personal story overlaid.
iPhone photo aesthetic — genuine, warm, relatable.
Bold personal testimonial text as the main visual element.
Feels like a real person sharing their experience.

PHOTO SCENE:
${copy.photoSetting || 'Casual home environment — living room, kitchen, or cozy indoor space.'}
Natural lighting — soft daylight from windows.
Warm, inviting atmosphere.
${copy.photoContext || 'Person in their everyday life, feeling comfortable and happy.'}

SUBJECT:
${copy.personDescription || 'Real-looking person (woman or man, 25-45), genuine smile, approachable.'}
Natural casual pose — not model-like.
Looking at camera OR product OR candid moment.
Should feel like a REAL customer, not a photoshoot.
${copy.productInteraction || 'Holding or wearing the product naturally.'}

PRODUCT:
Product clearly visible and matches reference exactly.
Held naturally or worn authentically.
Product is secondary to the person — this is about their story.

TEXT OVERLAY:
Large white box/card overlaid on lower portion of image with personal testimonial:

"${testimonialStory}"

- Text should read like a real person writing (casual, emojis optional)
- First-person narrative ("I was..." "My..." "After using...")
- Include specific details that feel authentic
- Can mention time period ("after a month", "for years")
- End with genuine reaction ("I'm obsessed", "game changer", "can't believe")

Small CTA at bottom:
"Shop ${brandName}" or simple brand name

LAYOUT:
- Upper 60%: Photo of person with product
- Lower 40%: White/cream card with testimonial text overlaid on photo
- Text box can have slight transparency or drop shadow for readability

TYPOGRAPHY:
- Testimonial: Clean sans-serif, readable, dark gray or black text
- Medium weight, not too thin
- Line spacing for easy reading
- CTA: Brand accent color, smaller font

=== CRITICAL - DO NOT INCLUDE ===
- Do NOT add fake social media handles
- Do NOT add fake engagement metrics
- Do NOT add star ratings
- Do NOT add "Verified Buyer" or review UI elements
- The testimonial should feel personal, not like a review site

ASPECT RATIO: 4:5

NOT: Stock photo aesthetic, overly polished, fake review UI, star ratings, verified badges.`;
}

/**
 * Build a Comparison (side-by-side) prompt
 * Modern minimal style like Huel ads - clean, bright, simple
 */
function buildComparisonPrompt({ test, copy, brandName, accentColor = 'orange' }) {
  const leftLabel = copy.leftLabel || 'Regular Shirts';
  const rightLabel = copy.rightLabel || brandName;

  return `Static advertisement. Modern minimal comparison format.

STYLE REFERENCE: Clean, modern comparison ad. Minimal, easy to read.

BACKGROUND:
Use dark charcoal/black background if brand uses dark aesthetics.
Otherwise solid bright color.
Single flat color, no gradients.

LAYOUT (TOP TO BOTTOM):
1. HEADLINE at top
2. Two products side by side
3. Simple comparison grid/table
4. Brand name at bottom

HEADLINE (TOP):
"${copy.headline || 'No time for bad shirts? No problem.'}"
- Bold sans-serif text (white on dark, black on light)
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
| Falls apart | Lifetime Guarantee |
| Shrinks & fades | Built to last |
| Synthetic | Premium materials |

Use simple text, no fancy icons.
Checkmarks or highlight for the winning side.

BOTTOM:
"${copy.ctaText || 'Try it'}" - simple text link or small button
Brand name: "${brandName}" in clean font

TYPOGRAPHY:
- Bold sans-serif for headline (like Poppins, Inter)
- Clean readable font for comparison table
- High contrast

OVERALL VIBE:
- MODERN and MINIMAL
- Easy to understand in 2 seconds
- Clean professional aesthetic

ASPECT RATIO: 4:5

=== CRITICAL ===
- Use ONLY USD currency ($) - no euros, no pounds
- Keep it SIMPLE - not cluttered
- NO made-up statistics like "200 washes" or cost-per-wear numbers
- Use only generic claims: "Lifetime Guarantee", "Built to last"
- NO fake reviews, NO star ratings, NO customer quotes
- NO chemical structures or scientific imagery

=== PRODUCT ON RIGHT SIDE — MANDATORY ===
The RIGHT SIDE product MUST be an EXACT copy of the reference image:
- SAME shirt design, SAME color, SAME fit
- SAME label/tag placement if visible
- SAME fabric texture and appearance
- Do NOT invent a different shirt — use the reference EXACTLY
- The reference image IS the ${brandName} product — copy it precisely`;
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
- Image: Person looking frustrated/uncomfortable in ill-fitting cheap shirt
- OR: Messy pile of 5-6 different faded shirts, cluttered closet
- Looks chaotic, uncomfortable, or overwhelming

RIGHT - "After":
- Small "After" label in gray
- Image: SAME PERSON (or similar) confidently wearing the ${brandName} shirt from reference
- Person should look confident, comfortable, happy
- The shirt must match the reference image EXACTLY
- Clean, minimal background behind the person
- Show the TRANSFORMATION - same person, better shirt, better confidence

Arrow or "→" symbol between the two sides

IMPORTANT: The "After" side should show a PERSON wearing the shirt, not just the shirt alone.
This shows the real transformation and helps the viewer see themselves in the product.

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
- NO fake timestamps or social media UI

=== "AFTER" PRODUCT — MANDATORY ===
The "AFTER" side MUST show an EXACT copy of the reference image product:
- SAME shirt design, SAME color, SAME fit, SAME details
- SAME label/tag placement if visible in reference
- Do NOT create a generic black shirt — use the EXACT reference product
- The reference image IS the ${brandName} product — replicate it precisely
- This is the hero product — it must match the reference EXACTLY`;
}

/**
 * Build vintage newspaper style prompt - 1930s newspaper clipping aesthetic
 * Based on high-converting vintage newspaper ad skill
 */
function buildNewsEditorialPrompt({ test, copy, brandName, accentColor = 'orange' }) {
  // Generate appropriate newspaper name based on category
  const newspaperName = copy.newspaperName || 'The American Textile Record';
  const newspaperDate = copy.newspaperDate || 'Thursday, March 12, 1931';

  return `Scanned vintage newspaper clipping from the 1930s, aged yellowed newsprint paper with coffee stains and creases.

NEWSPAPER MASTHEAD at top: "${newspaperName}"
Small subtitle under masthead: "Established 1847 · The Voice of American Manufacturing"
Date line: "${newspaperDate}"

LARGE BOLD HEADLINE in black serif font (like Playfair Display or Old Standard):
"${copy.headline || 'The Man Who Refused To Sell A Shirt He Wouldn\'t Wear'}"
- This is the PRIMARY attention grabber
- Values-level storytelling, NOT product features
- Should read like a real 1930s newspaper article headline

Below headline: Black and white photograph.
${copy.photoSubject || 'Weathered 1930s American craftsman, late 50s, grey stubble, work-worn hands'}
${copy.photoAction || 'Sitting at wooden workbench, looking down at fabric he is hand-inspecting with calloused hands'}
${copy.photoSetting || 'Small textile workshop, warm natural window light from left, dust particles in air'}
Caught in a ${copy.photoEmotion || 'quiet private moment of craftsmanship and pride'}.
NOT looking at camera, NOT posing.
Authentic 1920s silver gelatin photography style - heavy grain, soft contrast, sepia tone.
Feels like a REAL discovered photograph, not a photoshoot.

Small italic caption below photo: "${copy.photoCaption || 'Walter Briggs has worn the same hemp shirt for over a decade'}"

SUBHEADLINE below caption in smaller bold text:
"${copy.subheadline || 'Kentucky craftsman: If I won\'t wear it myself, I\'ve got no business selling it to you'}"

Two columns of small newspaper body text below the subheadline:
- Text should be BLURRED/OUT OF FOCUS so it's not readable
- Do NOT write "Lorem ipsum" or any placeholder text
- The blur effect makes it look like authentic small newspaper print that's too small to read
- This is background texture only - the headline and subheadline are the readable text

BLACK BAR at bottom spanning full width with white text:
"${copy.ctaLine || 'THEY STOPPED MAKING THEM. WE DIDN\'T.'}" — ${brandName.toUpperCase()}.COM

OVERALL AESTHETIC:
- Aged yellowed newsprint paper
- Coffee stains and fold marks
- Worn edges, slight tears
- Vintage newspaper scan look
- Authentic 1930s American aesthetic
- Sepia/warm aged tones

ASPECT RATIO: 4:5

=== CRITICAL ===
- Photo subject must NOT look at camera - candid moment feel
- Headline should tell a VALUES story, not product features
- Paper aging must look authentic (stains, creases, yellowing)
- Black CTA bar at bottom is essential
- NO modern elements, NO color photos, NO digital feel
- This should look like a REAL scanned newspaper clipping from the 1930s`;
}

/**
 * Build a Stat Stack Hero prompt — editorial-style ad with proof story
 * Based on Huel x Hardest Geezer format. Real person doing impressive thing + stat badges.
 */
function buildStatStackHeroPrompt({ test, copy, brandName }) {
  // Generate stats based on the angle/hook
  const stats = copy.stats || generateProofStats(test);
  const badges = copy.badges || [
    'Lifetime Guarantee',
    'Premium materials',
    'Built to last',
    'Zero compromises',
  ];

  const heroSubject = copy.heroSubject || 'rugged working professional, mid 40s';
  const heroAction = copy.heroAction || 'standing confidently in their work environment';
  const heroClothing = copy.heroClothing || `the EXACT ${brandName} shirt from reference image, work pants`;
  const setting = copy.setting || 'authentic workplace, natural lighting';
  const socialProof = copy.socialProof || { name: 'Real Customer', credential: 'Wears it every single day' };

  return `Modern performance marketing static ad, clean editorial style with stat overlays.

HERO PHOTOGRAPH (full frame, edge to edge):
Documentary photograph of ${heroSubject}, ${heroAction}. Wearing ${heroClothing}. ${setting}. Mid-action, NOT posing, NOT looking at camera. Natural light, candid energy. NOT a brand photoshoot.
The photograph should fill the ENTIRE frame with no dark bars or crops at top/bottom.

TOP LEFT (overlaid directly on photo):
Bold white text with subtle drop shadow for readability:
"${stats.stat1} | ${stats.stat2} | ${stats.stat3}"
Larger text below: "${stats.punchline}"

LEFT SIDE (overlaid on photo):
White rounded rectangle badges stacked vertically:
"${badges[0]}"
"${badges[1]}"
"${badges[2]}"
"${badges[3]}"

BOTTOM RIGHT (overlaid on photo):
Small white text with arrow pointing to person:
"${socialProof.name}"
"${socialProof.credential}"

BOTTOM CENTER (overlaid on photo):
Bold white text: "${brandName.toUpperCase()}.COM"
Use drop shadow or subtle dark gradient only behind text for readability, NOT a full-width dark bar.

Clean modern ad layout. Professional typography. 4:5 vertical format.
NO dark bars spanning the full width at top or bottom — photo extends edge to edge.

=== CRITICAL ===
- SINGLE PERSON ONLY — show exactly ONE person, NOT a group, NOT multiple people
- Hero must be MID-ACTION, NOT posing, NOT looking at camera
- Stats must be SPECIFIC numbers, not vague
- Badges must be 4 words max each
- This should look like EDITORIAL CONTENT, not advertising
- Natural candid photography style, real environment
- The social proof names ONE person (e.g. "Marcus, 31") so the image must show ONLY that one person

=== PRODUCT/SHIRT — MANDATORY ===
The person MUST be wearing the EXACT shirt from the reference image:
- SAME shirt design, color, fit as reference
- SAME label/tag if visible in reference
- Do NOT invent a generic black t-shirt with random logo
- The reference image shows the ${brandName} product — the person wears THIS EXACT shirt
- NO made-up logos, NO random brand marks — only what's in the reference`;
}

/**
 * Generate proof stats based on the test angle
 */
function generateProofStats(test) {
  const angle = test.hypothesis?.angle || test.angle || '';
  const hook = test.hook || '';
  const persona = test.persona?.id || '';

  // Default stats that work for most angles
  const defaultStats = {
    stat1: '365 days',
    stat2: '12 hour shifts',
    stat3: '1 shirt',
    punchline: 'Still going strong',
  };

  // Persona-specific stats
  if (persona.includes('durability') || angle.toLowerCase().includes('last')) {
    return {
      stat1: '3 years',
      stat2: '500+ washes',
      stat3: '0 replacements',
      punchline: '1 shirt that actually lasts',
    };
  }

  if (persona.includes('blue_collar') || angle.toLowerCase().includes('work')) {
    return {
      stat1: '14 job sites',
      stat2: '3 years',
      stat3: '1,460 days of sweat',
      punchline: '1 shirt',
    };
  }

  if (angle.toLowerCase().includes('paycheck') || angle.toLowerCase().includes('professional')) {
    return {
      stat1: '47 client meetings',
      stat2: '12 presentations',
      stat3: '1 shirt',
      punchline: 'They noticed the confidence, not the brand',
    };
  }

  return defaultStats;
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

    case 'news_editorial':
      return buildNewsEditorialPrompt(params);

    case 'testimonial':
      return buildTestimonialPrompt(params);

    case 'ugc_style':
      return buildUGCPrompt(params);

    case 'stat_stack':
    case 'stat_stack_hero':
    case 'stat_hero':
    case 'proof_story':
      return buildStatStackHeroPrompt(params);

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
    'news_editorial': {
      name: 'News Editorial',
      description: 'Vintage 1930s newspaper clipping style',
      aspectRatio: '4:5',
      bestFor: ['authority', 'founder story', 'credibility', 'values messaging'],
    },
    'testimonial': {
      name: 'Testimonial',
      description: 'Personal customer story with product photo',
      aspectRatio: '4:5',
      bestFor: ['social proof', 'authenticity', 'relatability', 'MOF/BOF'],
    },
    'before_after': {
      name: 'Before/After',
      description: 'Transformation comparison showing improvement',
      aspectRatio: '4:5',
      bestFor: ['transformation', 'problem-solution', 'visual proof'],
    },
    'stat_stack_hero': {
      name: 'Stat Stack Hero',
      description: 'Editorial proof story with real person + stat badges',
      aspectRatio: '4:5',
      bestFor: ['proof stories', 'credibility', 'durability claims', 'professional use cases'],
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
async function buildTestStaticPromptAsync({ test, format, brandName, brandId, logoUrl, accentColor = 'orange' }) {
  const config = loadConfig();
  const knownFormats = ['product_hero', 'meme', 'aesthetic', 'illustrated', 'vintage', 'ugc', 'comparison', 'before_after', 'news_editorial', 'testimonial', 'stat_stack_hero'];

  // Fetch brand style analysis and brand facts if brandId is provided
  let brandStyleDescription = '';
  let brandFacts = '';
  if (brandId) {
    try {
      brandStyleDescription = await getStylePromptForBrand(brandId);
    } catch (err) {
      console.log(`[TestStaticBuilder] Could not get brand style: ${err.message}`);
    }

    // Fetch verified brand facts from database
    try {
      const db = getDb();
      const brand = db.prepare('SELECT brand_facts FROM brands WHERE id = ?').get(brandId);
      if (brand && brand.brand_facts) {
        brandFacts = brand.brand_facts;
        console.log(`[TestStaticBuilder] Using brand facts: ${brandFacts}`);
      }
    } catch (err) {
      console.log(`[TestStaticBuilder] Could not get brand facts: ${err.message}`);
    }
  }

  // Generate AI copy for known formats
  if (knownFormats.includes(format)) {
    try {
      // Map formats to specific frameworks to ensure variety between formats
      const formatVariationMap = {
        'product_hero': 'problem_solution',
        'meme': 'short_punchy',
        'aesthetic': 'direct_command',
        'illustrated': 'comparison',
        'vintage': 'stat_implication',
        'ugc': 'question',
        'comparison': 'comparison',
        'before_after': 'problem_solution',
        'news_editorial': 'stat_implication',
        'testimonial': 'short_punchy',       // Personal, authentic feel
        'stat_stack_hero': 'stat_implication', // Stats and proof-focused
      };

      // Use AI to generate copy based on test angle
      const aiCopy = await generateAICopy({
        format,
        test,
        brandName,
        winningCopy: test.winningCopy || [],
        strategicContext: test.strategicContext || {},
        variationHint: formatVariationMap[format] || null,
        brandFacts,
      });

      // Build prompt with AI-generated copy and brand style
      return buildPromptWithCopy({ format, copy: aiCopy, brandName, logoUrl, accentColor, brandStyleDescription });
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
 * Also includes brand style description if available
 */
function buildPromptWithCopy({ format, copy, brandName, logoUrl, accentColor, brandStyleDescription = '' }) {
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
    case 'news_editorial':
      basePrompt = buildNewsEditorialPrompt({ ...params, test: {} });
      break;
    case 'testimonial':
      basePrompt = buildTestimonialPrompt({ ...params, test: {} });
      break;
    case 'stat_stack_hero':
      basePrompt = buildStatStackHeroPrompt({ ...params, test: {} });
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
  basePrompt += `\n\n=== PRODUCT REFERENCE — CRITICAL — READ THIS ===
• The reference image shows the EXACT ${brandName} product
• You MUST replicate this product EXACTLY in the generated image
• SAME shirt design, SAME color, SAME fit, SAME neckline
• SAME label/tag placement and appearance
• SAME fabric texture and finish
• Do NOT create a generic black t-shirt
• Do NOT invent a different product design
• Do NOT add random logos or brand marks that aren't in the reference
• The reference IS the product — copy it PRECISELY
• If showing the product, it must be IDENTICAL to the reference image`;

  // Add brand name instruction - use text styling, not logo graphics
  basePrompt += `\n\n=== BRAND NAME & LOGO — CRITICAL ===
• Brand name is "${brandName}" - spell EXACTLY as shown: ${brandName.split('').join('-')}
• A logo reference image has been provided - use THIS EXACT LOGO on the product
• The logo reference shows the ACTUAL ${brandName} logo - copy it PRECISELY
• Do NOT invent a different logo, symbol, or icon
• Do NOT create a generic "U" or abstract mark - use the EXACT logo from reference
• The product should show the SAME logo/tag as seen in the reference images
• For brand text in the ad: use clean text that reads "${brandName}" in white or brand color
• Position brand text: Top center or bottom of image
• If showing the product, the logo/tag on the product MUST match the reference EXACTLY`;


  // Add brand style description if available
  if (brandStyleDescription) {
    basePrompt += brandStyleDescription;
  }

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
