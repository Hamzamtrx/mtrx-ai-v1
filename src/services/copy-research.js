/**
 * Copy Research Service
 *
 * Uses Claude to do deep research and generate custom copy for static ads.
 * Based on research-skill.md and copy-skill.md
 *
 * CRITICAL: Each static type has multiple angles/formats/compositions.
 * We generate MULTIPLE variants per type to ensure variety.
 */

const Anthropic = require('@anthropic-ai/sdk');

class CopyResearchService {
  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  /**
   * Do full research and generate copy for a product
   * @param {Object} options
   * @param {string} options.websiteUrl - Landing page URL
   * @param {string} options.websiteContent - Scraped page content
   * @param {string} options.brandName - Brand name
   * @param {string} options.productName - Product name
   * @param {string} options.category - Product category
   * @returns {Promise<Object>} - Research brief with custom copy variants
   */
  async researchAndGenerateCopy({ websiteUrl, websiteContent, brandName, productName, category, proposedAngle }) {
    console.log('🧠 Starting AI research and copy generation...');

    // Build angle-specific research instructions
    let angleResearch = '';
    if (proposedAngle && proposedAngle.trim()) {
      angleResearch = `
╔═══════════════════════════════════════════════════════════════╗
║  🎯 MANDATORY ANGLE: "${proposedAngle}"
║  ALL COPY MUST BE ABOUT THIS ANGLE. NO EXCEPTIONS.
╚═══════════════════════════════════════════════════════════════╝

STEP 1: RESEARCH "${proposedAngle}" SPECIFICALLY

Think about "${proposedAngle}" from the customer's perspective:
- What does "${proposedAngle}" mean to someone buying clothes?
- What situations involve "${proposedAngle}"?
- What emotions are tied to "${proposedAngle}"?
- What would someone search for related to "${proposedAngle}"?

For "${proposedAngle}", find:
- Reddit discussions about ${proposedAngle} + clothing/fashion
- Social media posts about ${proposedAngle}
- What people say when shopping for ${proposedAngle}
- Cultural references specific to ${proposedAngle}

STEP 2: GENERATE COPY USING YOUR "${proposedAngle}" RESEARCH

Every single headline, meme, and caption MUST relate to "${proposedAngle}".

Examples of what "${proposedAngle}" copy should look like:
- If angle is "valentines day": "SHE DESERVES BETTER THAN YOUR FADED TEE.", "look good. get lucky.", "date night armor that actually fits."
- If angle is "durability": "STOP BUYING SHIRTS THAT FALL APART.", "100 washes. still fits."
- If angle is "gym": "NO STINK. NO STRETCH. NO EXCUSES.", "built for the gym rats."

DO NOT USE generic durability/BIFL copy unless your angle IS durability/BIFL.
`;
    }

    const prompt = `You are an expert direct response copywriter and researcher.

${angleResearch}

═══════════════════════════════════════════════════════════════
PHASE 1: LANDING PAGE ANALYSIS (Tone & Benefits)
═══════════════════════════════════════════════════════════════

BRAND: ${brandName}
PRODUCT: ${productName}
CATEGORY: ${category}
WEBSITE: ${websiteUrl}

WEBSITE CONTENT:
${websiteContent?.substring(0, 8000) || 'No content available'}

Extract from the landing page ONLY:
- Brand tone (aggressive, nurturing, premium, rebellious)
- Specific product benefits with EXACT numbers
- Materials/composition with percentages
- Any guarantees or offers explicitly stated
- Target customer signals

---

═══════════════════════════════════════════════════════════════
PHASE 2: COPY GENERATION RULES
═══════════════════════════════════════════════════════════════

CRITICAL RULES:
1. NO GENERIC OFFERS - Only mention offers/guarantees EXPLICITLY on the landing page. If none, leave offer_line EMPTY.
2. COPY MUST MAKE LOGICAL SENSE - No meaningless buzzword combinations.
3. USE REAL NUMBERS from the page - "4x stronger" not made-up stats.
4. LOGO STYLE - White italic cursive script, slanted to the right like a signature.
${proposedAngle ? `
⚠️⚠️⚠️ CRITICAL: YOUR ANGLE IS "${proposedAngle}" ⚠️⚠️⚠️
DO NOT use generic references like cast iron, grandpa's tools, BIFL unless they relate to "${proposedAngle}".
EVERY headline, meme, and caption MUST be about "${proposedAngle}".
Research "${proposedAngle}" specifically and use THAT research in your copy.
` : `
CULTURAL REFERENCES TO USE (when no specific angle given):
- Cast iron pans (last forever)
- Grandpa's tools / workwear
- BIFL (Buy It For Life) movement
- Microplastics in bloodstream (health scare)
- Polyester = plastic on your skin
- Fast fashion = disposable garbage

VALIDATED HEADLINE PATTERNS:
- "[OLD QUALITY THING] LASTS FOREVER. YOUR SHIRT SHOULD TOO."
- "STOP BUYING [PROBLEM]."
- "BUILT LIKE [QUALITY REFERENCE]."
- "[MATERIAL] IS [BAD THING]. THIS ISN'T."
`}

Type 6 UGC (real guy voice - casual, lowercase):
- "100 washes. no fade. no sag. no stretch."
- "fit so good my wife asked if I've been working out."

STEP 1: BRAND VISUAL IDENTITY
Extract from website:
- Colors (background, text, accent)
- Logo style: casual white handwritten/script style
- Overall vibe

STEP 2: PRODUCT RESEARCH
Extract ONLY what's on the page:
- Key materials with EXACT percentages (e.g., "51% Hemp, 31% Bamboo")
- Specific claims WITH numbers from the page
- ONLY guarantees explicitly mentioned
- What makes it different

STEP 3: CULTURAL RESEARCH
- What frustration does this tap into?
- What has been LOST? (quality, craftsmanship)
- What tribe? (BIFL, anti-fast-fashion)

STEP 4: CUSTOMER LANGUAGE
How real customers talk:
- Exact frustrated phrases
- How they'd describe to a friend

STEP 5: GENERATE COPY VARIANTS

HEADLINE RULES:
- BE SPECIFIC: "4x stronger than cotton" not "stronger than ever"
- BE DIRECT: "Stop buying garbage shirts" not "Elevate your wardrobe journey"
- BE PROVOCATIVE: Challenge them, call them out
- NO FLUFF: Cut "meets", "elevate", "journey", "game-changer"

TYPE 1 - PRODUCT HERO (4 variants):
${proposedAngle ? `⚠️ ALL 4 headlines MUST be about "${proposedAngle}". NO generic durability copy.` : 'Angles: BIFL/Durability, Health/Toxicity, Fast Fashion Rebellion, Fed-Up Frustration'}
Headlines: 8-15 words, DIRECT, provocative.
offer_line: ONLY if explicitly on landing page, otherwise empty string ""

TYPE 2 - MEME STATIC (4 variants):
Formats: Drake, Gigachad, Fan vs Enjoyer
${proposedAngle ? `⚠️ ALL 4 memes MUST joke about "${proposedAngle}". NO generic references.` : ''}
Copy must be SHORT and PUNCHY. Real internet voice.

TYPE 3 - AESTHETIC OFFER (4 variants):
Compositions: Flat Lay, On-Body, Trash Can, Closet, Durability Demo
${proposedAngle ? `⚠️ ALL 4 headlines MUST relate to "${proposedAngle}".` : ''}
Headlines: 3-8 words MAX. MUST be PROVOCATIVE or SPECIFIC, never generic.
⚠️ DO NOT USE bland headlines like "BUILT TO LAST", "FITS LIKE IT SHOULD", "QUALITY THAT MATTERS"
✓ GOOD EXAMPLES: "YOUR CLOSET'S RETIREMENT HOME.", "100 WASHES. STILL PERFECT.", "THROW OUT THE REST.", "EVERY OTHER SHIRT IS A LIE.", "SHE'LL NOTICE."
✓ Use NUMBERS, COMPARISONS, or PROVOCATIVE statements
offer_line: ONLY if on landing page, otherwise ""

TYPE 4 - ILLUSTRATED (4 variants):
Compositions: Floating, Split Comparison, Action Demo, Warning
${proposedAngle ? `⚠️ ALL 4 variants MUST be about "${proposedAngle}".` : ''}
Headlines: PROBLEM-focused or DIRECT comparison
⚠️ CRITICAL: Benefits MUST directly support/prove the SPECIFIC headline above them.
Example: If headline is "VALENTINE'S DAY: EXPECTATION VS REALITY" then benefits should be:
  - "Look sharp, not sloppy"
  - "No awkward tugging"
  - "She'll notice the difference"
NOT generic benefits like "4x stronger" or "Lasts longer" that don't relate to the headline.

TYPE 5 - VINTAGE MAGAZINE (4 variants):
Settings: Gas Station, Workshop, Farm, Factory
${proposedAngle ? `⚠️ ALL 4 headlines MUST connect to "${proposedAngle}". Nostalgic but on-angle.` : 'Headlines: Nostalgic but SPECIFIC.'}

TYPE 6 - UGC CAPTION (4 variants):
Settings: Gym, Bathroom, Car, Bedroom
${proposedAngle ? `⚠️ ALL 4 captions MUST reference "${proposedAngle}". Real guy voice.` : ''}
Captions: How a REAL guy would text. Short sentences. Lowercase.

---

OUTPUT FORMAT (JSON):

{
  "brand_identity": {
    "colors": { "background": "", "text": "", "accent": "" },
    "typography_vibe": "",
    "logo_style": "white brush script font, italic, tilted right",
    "logo_text": "",
    "overall_vibe": ""
  },
  "product_info": {
    "key_materials": "",
    "composition": "",
    "main_claims": [],
    "guarantee": "",
    "differentiator": ""
  },
  "angle_research": {
    "reddit_phrases": ["exact phrases from Reddit"],
    "emotional_triggers": ["words that trigger response"],
    "cultural_references": ["analogies like cast iron, grandpa tools"],
    "avatar_description": "who cares most about this angle",
    "meme_hooks": ["viral hooks that work"]
  },
  "customer_language": {
    "phrases": [],
    "failed_solutions": [],
    "delights": []
  },
  "copy": {
    "type1_product_hero": [
      { "angle": "", "headline": "", "subheadline": "", "offer_line": "" },
      { "angle": "", "headline": "", "subheadline": "", "offer_line": "" },
      { "angle": "", "headline": "", "subheadline": "", "offer_line": "" },
      { "angle": "", "headline": "", "subheadline": "", "offer_line": "" }
    ],
    "type2_meme": [
      { "format": "drake", "top_panel": "", "bottom_panel": "", "cta": "" },
      { "format": "gigachad", "gratitude_text": "Thank you for changing my life", "product_text": "", "cta": "" },
      { "format": "fan_vs_enjoyer", "fan_text": "", "enjoyer_text": "", "cta": "" },
      { "format": "drake", "top_panel": "", "bottom_panel": "", "cta": "" }
    ],
    "type3_aesthetic": [
      { "composition": "", "headline": "", "offer_line": "" },
      { "composition": "", "headline": "", "offer_line": "" },
      { "composition": "", "headline": "", "offer_line": "" },
      { "composition": "", "headline": "", "offer_line": "" }
    ],
    "type4_illustrated": [
      { "composition": "", "headline": "", "benefits": ["MUST relate to headline", "MUST relate to headline", "MUST relate to headline"], "cta": "" },
      { "composition": "", "headline": "", "benefits": ["MUST relate to headline", "MUST relate to headline", "MUST relate to headline"], "cta": "" },
      { "composition": "", "headline": "", "benefits": ["MUST relate to headline", "MUST relate to headline", "MUST relate to headline"], "cta": "" },
      { "composition": "", "headline": "", "benefits": ["MUST relate to headline", "MUST relate to headline", "MUST relate to headline"], "cta": "" }
    ],
    "type5_vintage": [
      { "angle": "", "setting": "", "headline": "", "subheadline": "" },
      { "angle": "", "setting": "", "headline": "", "subheadline": "" },
      { "angle": "", "setting": "", "headline": "", "subheadline": "" },
      { "angle": "", "setting": "", "headline": "", "subheadline": "" }
    ],
    "type6_ugc": [
      { "setting": "gym", "caption_type": "", "caption": "" },
      { "setting": "bathroom", "caption_type": "", "caption": "" },
      { "setting": "car", "caption_type": "", "caption": "" },
      { "setting": "bedroom", "caption_type": "", "caption": "" }
    ]
  }
}

Return ONLY the JSON, no other text.`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [
          { role: 'user', content: prompt }
        ]
      });

      const content = response.content[0].text;

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const research = JSON.parse(jsonMatch[0]);
        console.log('   ✓ Research complete');
        console.log('   ✓ Cultural insight:', research.cultural_insights?.frustration?.substring(0, 50) + '...');
        console.log('   ✓ Generated copy variants for all 6 static types');

        // Log variant counts
        const copy = research.copy;
        if (copy) {
          console.log('   ✓ Type 1 variants:', Array.isArray(copy.type1_product_hero) ? copy.type1_product_hero.length : 1);
          console.log('   ✓ Type 2 variants:', Array.isArray(copy.type2_meme) ? copy.type2_meme.length : 1);
          console.log('   ✓ Type 3 variants:', Array.isArray(copy.type3_aesthetic) ? copy.type3_aesthetic.length : 1);
          console.log('   ✓ Type 4 variants:', Array.isArray(copy.type4_illustrated) ? copy.type4_illustrated.length : 1);
          console.log('   ✓ Type 5 variants:', Array.isArray(copy.type5_vintage) ? copy.type5_vintage.length : 1);
          console.log('   ✓ Type 6 variants:', Array.isArray(copy.type6_ugc) ? copy.type6_ugc.length : 1);
        }

        return research;
      } else {
        console.log('   ⚠ Could not parse research JSON');
        return null;
      }
    } catch (error) {
      console.error('   ✗ Research failed:', error.message);
      return null;
    }
  }

  /**
   * Get a specific variant for a static type
   * @param {string} staticType - type1, type2, etc.
   * @param {Object} research - Research results
   * @param {number} variantIndex - Which variant to use (0, 1, or 2)
   * @returns {Object} - The specific variant
   */
  getVariant(staticType, research, variantIndex = 0) {
    if (!research || !research.copy) return null;

    const copy = research.copy;
    const typeMap = {
      'type1': copy.type1_product_hero,
      'type2': copy.type2_meme,
      'type3': copy.type3_aesthetic,
      'type4': copy.type4_illustrated,
      'type5': copy.type5_vintage,
      'type6': copy.type6_ugc
    };

    const variants = typeMap[staticType];
    if (!variants) return null;

    // Handle both array and single object formats
    if (Array.isArray(variants)) {
      return variants[variantIndex % variants.length];
    }
    return variants;
  }

  /**
   * Build a COMPLETE prompt for a specific static type and variant
   * @param {string} staticType - type1, type2, etc.
   * @param {Object} research - Research results
   * @param {number} variantIndex - Which variant to use (0, 1, or 2)
   * @param {string} brandName - Brand name
   * @returns {string} - Complete prompt ready for image generation
   */
  buildCompletePrompt(staticType, research, variantIndex, brandName, logoUrl = null) {
    const variant = this.getVariant(staticType, research, variantIndex);
    const brand = research?.brand_identity || {};
    const product = research?.product_info || {};

    if (!variant) {
      console.log(`   ⚠ No variant found for ${staticType}, using default`);
      return null;
    }

    const accentColor = brand.colors?.accent || 'orange';
    const logoStyle = brand.logo_style || 'hand-drawn script';
    const guarantee = product.guarantee || 'Lifetime Guarantee';
    const materials = product.key_materials || product.composition || '';

    switch (staticType) {
      case 'type1':
        return this.buildType1Prompt(variant, brandName, accentColor, logoStyle, guarantee, logoUrl);
      case 'type2':
        return this.buildType2Prompt(variant, brandName, accentColor);
      case 'type3':
        return this.buildType3Prompt(variant, brandName, accentColor, logoStyle, guarantee, logoUrl);
      case 'type4':
        return this.buildType4Prompt(variant, brandName, accentColor);
      case 'type5':
        return this.buildType5Prompt(variant, brandName, materials, guarantee, logoUrl);
      case 'type6':
        return this.buildType6Prompt(variant, brandName);
      default:
        return null;
    }
  }

  buildType1Prompt(variant, brandName, accentColor, logoStyle, guarantee, logoUrl = null) {
    const headline = variant.headline || 'QUALITY THAT LASTS FOREVER.';
    // Only use offer if explicitly provided, otherwise skip the offer line entirely
    const offerLine = variant.offer_line && variant.offer_line.trim() !== '' ? variant.offer_line : null;

    let offerSection = '';
    if (offerLine) {
      offerSection = `\nBELOW HEADLINE: ${accentColor} checkmark icon + "${offerLine}" in ${accentColor} text`;
    }

    // Logo instruction - use uploaded image if available, otherwise describe style
    let logoInstruction = '';
    if (logoUrl) {
      logoInstruction = `TOP CENTER: Use the exact brand logo from this reference image: ${logoUrl}
(Reproduce the logo EXACTLY as shown - same font, style, colors, proportions)`;
    } else {
      logoInstruction = `TOP CENTER: "${brandName}" in white brush script font, italic, tilted 10 degrees right, casual handwritten style like Nike or Coca-Cola script logo`;
    }

    return `Static advertisement for product brand.

Dark charcoal gradient background.

Three black t-shirts arranged horizontally - center one larger and prominent, side ones smaller and slightly faded. Crew neck, curved hem.

Subtle reflection beneath shirts on dark surface.

${logoInstruction}

MAIN HEADLINE (large, bold condensed sans-serif, ALL CAPS, white, centered):
"${headline}"${offerSection}

BOTTOM CENTER: ${accentColor} rectangular button with white text "SHOP NOW"

Clean, premium, masculine energy. High contrast.

4:5 aspect ratio.`;
  }

  buildType2Prompt(variant, brandName, accentColor) {
    const format = variant.format || 'drake';

    if (format === 'gigachad') {
      const productText = variant.product_text || "I'm literally just a shirt that doesn't fall apart.";
      return `Meme-style static advertisement. Gigachad "Thank you for changing my life" format.

LAYOUT:
Top left: Wojak face (simple line drawing, GRATEFUL expression - slight smile, single happy tear, touched/moved emotion) - the CUSTOMER

Top right text: "Thank you for changing my life"

Bottom left: Gigachad face (black and white sketch, side profile, beard, calm/unbothered) - the PRODUCT

Bottom right: Black t-shirt product image

Bottom text below shirt: "${productText}"

Bottom center: ${accentColor} CTA button "${variant.cta || 'SHOP ' + brandName.toUpperCase()}"

STYLE:
Classic meme format. Black and white sketch characters. Clean white background. Wojak looks HAPPY and grateful, not sad. Simple, internet native.

4:5 aspect ratio.`;
    } else if (format === 'fan_vs_enjoyer') {
      return `Meme-style static advertisement. Average fan vs average enjoyer format.

LAYOUT:
Top left text: "Average ${variant.fan_text || 'polyester'} fan"
Top right text: "Average ${variant.enjoyer_text || 'hemp'} enjoyer"

Left side: Crying wojak (distressed, tears, upset)
Right side: Gigachad (confident, glowing, serene)

Bottom center: Black t-shirt product image
Bottom: ${accentColor} CTA button "${variant.cta || 'MAKE THE SWITCH'}"

STYLE:
Classic meme format. Left side slightly darker/sadder tone. Right side brighter/elevated. White background. Bold black text for labels.

4:5 aspect ratio.`;
    } else {
      // Drake format (default)
      return `Meme-style static advertisement. Drake approves/disapproves format.

LAYOUT:
Two stacked horizontal panels. Yellow background on left (Drake), white background on right (text/product).

TOP PANEL:
Left: Drake disgusted (hand up, looking away, orange jacket) on yellow background
Right: White background with black text: "${variant.top_panel || 'Buying shirts that fall apart'}"

BOTTOM PANEL:
Left: Drake approving (pointing, smiling, orange jacket) on yellow background
Right: White background with black t-shirt product image and text below: "${variant.bottom_panel || 'Buying once, wearing forever'}"

${accentColor} CTA button centered within the white space of the bottom panel (NOT on a separate bar outside the meme)

STYLE:
Classic Drake meme format. Consistent yellow on Drake's side, consistent white on text/product side. Bold black text. Clean layout. NO black bar at bottom.

4:5 aspect ratio.`;
    }
  }

  buildType3Prompt(variant, brandName, accentColor, logoStyle, guarantee, logoUrl = null) {
    const composition = variant.composition || 'flat_lay';
    const headline = variant.headline || 'BUILT TO LAST.';
    // Only use offer if explicitly provided
    const offerLine = variant.offer_line && variant.offer_line.trim() !== '' ? variant.offer_line : null;

    let sceneDescription = '';
    switch (composition) {
      case 'on_body':
      case 'on-body':
        sceneDescription = `Torso shot of athletic male body wearing the black t-shirt. No face - crop at neck. Dark grey studio background. Dramatic side light sculpting the body. Editorial fitness photography feel.`;
        break;
      case 'trash_can':
      case 'comparison':
        sceneDescription = `Man's hand holding fresh black t-shirt. Below/behind: trash can filled with worn-out, faded, shrunk cheap t-shirts. Clear contrast - quality vs. garbage. Clean natural light.`;
        break;
      case 'closet':
      case 'minimalist':
        sceneDescription = `Clean minimal wardrobe interior. Single black t-shirt hanging alone on wooden hanger. Empty space around it. Capsule wardrobe aesthetic. Soft even light. Scandinavian minimal feel.`;
        break;
      case 'durability':
      case 'stretch':
        sceneDescription = `Two hands stretching/pulling the black t-shirt fabric, demonstrating durability. Clean studio background. The fabric holds strong - no distortion or damage. Sharp detail on fabric texture under tension.`;
        break;
      default:
        // flat_lay
        sceneDescription = `Black t-shirt laid flat on weathered wooden surface. Warm workshop aesthetic. Tools and leather items as props around the edges. Golden hour warm light.`;
    }

    let offerSection = '';
    if (offerLine) {
      offerSection = `\nBelow headline:\n✓ ${offerLine} (white, smaller)`;
    }

    // Logo instruction - use uploaded image if available, otherwise describe style
    let logoInstruction = '';
    if (logoUrl) {
      logoInstruction = `Upper left:
Use the exact brand logo from this reference image: ${logoUrl}
(Reproduce the logo EXACTLY as shown - same font, style, colors, proportions)`;
    } else {
      logoInstruction = `Upper left:
"${brandName}" white brush script font, italic, tilted 10 degrees right, casual handwritten style like Nike or Coca-Cola script logo`;
    }

    return `Editorial product photography. Static advertisement.

SCENE:
${sceneDescription}

TEXT OVERLAID ON IMAGE:

${logoInstruction}

Center left:
"${headline}"
Bold condensed sans-serif, ALL CAPS, white, large${offerSection}

Bottom center:
${accentColor} rounded button "SHOP NOW"

4:5 aspect ratio.`;
  }

  buildType4Prompt(variant, brandName, accentColor) {
    const composition = variant.composition || 'floating';
    const headline = variant.headline || 'UPGRADE YOUR WARDROBE.';
    const benefits = variant.benefits || ['Stronger', 'Softer', 'Lasts longer'];
    const cta = variant.cta || 'MAKE THE SWITCH';

    let sceneDescription = '';
    switch (composition) {
      case 'split':
      case 'comparison':
      case 'before_after':
        sceneDescription = `Split panel composition. Left side: frustrated man in red-tinted bad environment with faded worn shirt. Right side: confident man in cool-tinted good environment wearing fresh black shirt. Clear contrast.`;
        break;
      case 'action':
      case 'demo':
      case 'proof':
        sceneDescription = `Black t-shirt being stretched by two cartoon hands, demonstrating strength. Action lines and energy effects around it. The fabric holds strong. "Try to break it" energy.`;
        break;
      case 'warning':
      case 'callout':
        sceneDescription = `Warning symbols and red flags around the problem (cheap polyester shirt with danger icons). Below, the solution: black hemp shirt with green checkmarks and safety glow.`;
        break;
      default:
        // floating
        sceneDescription = `Black t-shirt floating center with soft glow/sparkles effect. Two cartoon characters on sides looking up in amazement. "Behold, the solution" energy.`;
    }

    return `Illustrated advertisement in cartoon/comic style. Static ad.

STYLE:
2D cartoon illustration. Bold outlines. Flat colors. Confident and educational energy.

SCENE:
${sceneDescription}

PRODUCT:
Black t-shirt rendered in simple cartoon style.

TEXT LAYOUT:

TOP (bold cartoon font, black):
"${headline}"

MIDDLE (stacked benefit badges, white text on dark rounded rectangles):
"${benefits[0] || 'Benefit 1'}"
"${benefits[1] || 'Benefit 2'}"
"${benefits[2] || 'Benefit 3'}"

BOTTOM (CTA button, ${accentColor}):
"${cta}"

COLOR PALETTE:
High contrast, bold colors that support the message.

4:5 aspect ratio.`;
  }

  buildType5Prompt(variant, brandName, materials, guarantee, logoUrl = null) {
    const setting = variant.setting || 'gas_station';
    const headline = variant.headline || "THEY DON'T MAKE 'EM LIKE THEY USED TO.";
    // Use variant subheadline if provided, otherwise build from materials only (no fake guarantee)
    const subheadline = variant.subheadline || (materials ? `WE DO. ${materials}.` : 'WE DO.');

    let settingDescription = '';
    switch (setting) {
      case 'workshop':
      case 'garage':
        settingDescription = `Rugged handsome man (mid 30s, strong jaw, short hair) in garage workshop. Leaning against workbench covered with hand tools. Wearing fitted black crewneck t-shirt, worn jeans, work boots. Old American truck visible through open garage door. Warm tungsten lighting.`;
        break;
      case 'farm':
      case 'rural':
        settingDescription = `Rugged handsome man (early 30s, working class build) standing by wooden fence on American farmland. Wearing fitted black t-shirt, worn jeans. Pickup truck in background. Golden fields. Warm sunset light.`;
        break;
      case 'factory':
        settingDescription = `Rugged man (mid 30s, strong build) in front of brick factory wall with "MADE IN USA" painted signage. Wearing fitted black t-shirt. Industrial, working class pride. Warm afternoon light.`;
        break;
      case 'urban':
      case 'alley':
        settingDescription = `Rugged handsome man (late 20s, James Dean type) leaning against brick wall in urban alley. Painted vintage signage above. Wearing fitted black t-shirt, jeans, boots. Rebellious cool. Dramatic shadows.`;
        break;
      default:
        // gas_station
        settingDescription = `Rugged handsome man (early 30s, James Dean type) leaning against vintage motorcycle outside old gas station. Wearing fitted black crewneck t-shirt, worn blue jeans, leather boots. Classic 1950s American car in background. Golden hour warm light.`;
    }

    // Only include trust badge if guarantee is explicitly provided
    const trustBadge = guarantee && guarantee.trim() !== ''
      ? `\n\nBottom right corner: Circular trust badge with "${guarantee}"`
      : '';

    return `Vintage 1950s Americana magazine advertisement. Photorealistic editorial photography.

SCENE:
${settingDescription}

STYLE:
Photorealistic vintage magazine ad. 1950s Americana aesthetic. Film grain. Warm color grade - golden tones, slight fade. Editorial photography feel. Nostalgic but premium.

TEXT OVERLAY:

Top (bold condensed vintage headline font, cream/off-white with subtle shadow):
"${headline}"

Below headline (smaller serif font, same color):
"${subheadline}"

Hand-drawn style curved arrow pointing to the t-shirt${trustBadge}

4:5 aspect ratio.`;
  }

  buildType6Prompt(variant, brandName) {
    const setting = variant.setting || 'gym';
    const caption = variant.caption || '100 washes. no fade. no sag. no stretch.';

    let settingDescription = '';
    switch (setting) {
      case 'bathroom':
        settingDescription = `iPhone mirror selfie, home bathroom. Man mid 30s, athletic build, taking mirror selfie holding phone at chest level. Wearing fitted black t-shirt. Dark jeans. Casual confident expression, slight smirk. Normal home bathroom, white walls, basic mirror, toothbrush holder visible, towel hanging, natural daylight from window. Lived-in, not staged.`;
        break;
      case 'car':
        settingDescription = `iPhone selfie, driver seat of car. Man mid 30s, athletic build, wearing fitted black t-shirt. Seatbelt across chest. Parked car, natural daylight through windshield. Relaxed confident expression, slight head tilt. Normal sedan interior, steering wheel visible.`;
        break;
      case 'bedroom':
        settingDescription = `iPhone selfie, bedroom. Man mid 30s, athletic build, adjusting fitted black t-shirt - caught mid-action pulling shirt down. Standing near dresser. Morning light from window. Unmade bed edge visible, normal lived-in room.`;
        break;
      default:
        // gym
        settingDescription = `iPhone mirror selfie, gym locker room. Man mid 30s, athletic build, taking mirror selfie holding phone at chest level. Wearing fitted black t-shirt. Grey sweatpants. Post-workout, light sweat, confident smirk. Dirty mirror with smudges, harsh fluorescent lighting, worn wooden bench, beat-up metal lockers with dents, gym bag on floor.`;
    }

    return `${settingDescription}

SKIN: Real texture, visible pores, stubble, natural. NOT airbrushed.

iPhone camera quality, slight grain, natural phone selfie look.

TEXT OVERLAY:
Handwritten style text in white marker/paint pen, slightly messy and casual like someone drew on the photo. Text placed in upper portion of frame, angled slightly:
"${caption}"

4:5 aspect ratio. Authentic UGC aesthetic.`;
  }

  /**
   * Build a prompt with custom copy for a specific static type (legacy method)
   * @param {string} staticType - type1, type2, etc.
   * @param {Object} research - Research results
   * @param {string} basePrompt - Original skill prompt
   * @param {number} variantIndex - Which variant to use
   * @returns {string} - Customized prompt
   */
  buildCustomPrompt(staticType, research, basePrompt, variantIndex = 0) {
    if (!research || !research.copy) {
      return basePrompt;
    }

    const variant = this.getVariant(staticType, research, variantIndex);
    if (!variant) return basePrompt;

    let prompt = basePrompt;
    const brand = research.brand_identity;

    // Replace placeholders based on static type and variant
    switch (staticType) {
      case 'type1':
        if (variant.headline) {
          prompt = prompt.replace(/YOUR CAST IRON LASTS FOREVER\.[\s\S]*?YOUR SHIRT SHOULD TOO\./gi, variant.headline);
          prompt = prompt.replace(/Lifetime Guarantee/gi, variant.offer_line || 'Lifetime Guarantee');
        }
        break;

      case 'type2':
        if (variant.format === 'drake' && variant.top_panel) {
          prompt = prompt.replace(/Wearing just any t-shirt/gi, variant.top_panel);
          prompt = prompt.replace(/Wearing The.*Premium Tee/gi, variant.bottom_panel);
        }
        break;

      case 'type3':
        if (variant.headline) {
          prompt = prompt.replace(/NEVER BUY ANOTHER CHEAP T-SHIRT/gi, variant.headline);
        }
        break;

      case 'type4':
        if (variant.headline) {
          prompt = prompt.replace(/UNLEASH YOUR INNER CHAMPION/gi, variant.headline);
          if (variant.benefits?.length >= 3) {
            prompt = prompt.replace(/ADVANCED COMFORT/gi, variant.benefits[0]);
            prompt = prompt.replace(/DURABLE KNIT/gi, variant.benefits[1]);
            prompt = prompt.replace(/BOLD STYLE/gi, variant.benefits[2]);
          }
        }
        break;

      case 'type5':
        if (variant.headline) {
          prompt = prompt.replace(/WE MAKE 'EM LIKE THEY USED TO/gi, variant.headline);
        }
        break;

      case 'type6':
        if (variant.caption) {
          prompt = prompt.replace(/\[CAPTION\]/gi, variant.caption);
          prompt = prompt.replace(/Built to last\. Made to fit\./gi, variant.caption);
        }
        break;
    }

    // Replace brand colors if available
    if (brand?.colors?.accent) {
      prompt = prompt.replace(/\borange\b/gi, brand.colors.accent);
      prompt = prompt.replace(/#FF6B35/gi, brand.colors.accent);
    }

    return prompt;
  }
}

module.exports = CopyResearchService;
