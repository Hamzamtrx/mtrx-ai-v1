/**
 * AI Copy Generator — Uses Claude + copy-skill frameworks to generate ad copy
 * Analyzes winning ad patterns and generates headlines following proven frameworks
 */

const Anthropic = require('@anthropic-ai/sdk');

/**
 * Generate copy for a static ad using AI and winning patterns
 * @param {Object} params
 * @param {string} params.format - Static format type (product_hero, meme, etc.)
 * @param {Object} params.test - Test data (hook, angle, copyDirection)
 * @param {string} params.brandName - Brand name
 * @param {Array} params.winningCopy - Array of winning ad copy patterns
 * @param {Object} params.strategicContext - Strategic insights summary
 * @returns {Promise<Object>} Generated copy for the format
 */
async function generateAICopy({ format, test, brandName, winningCopy = [], strategicContext = {}, variationHint = null }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[CopyGenerator] No API key, using fallback copy');
    return generateFallbackCopy(format, test, brandName);
  }

  const client = new Anthropic();

  // Build context from winning ads
  const winningPatterns = winningCopy.slice(0, 5).map((ad, i) =>
    `${i + 1}. Headline: "${ad.headline || 'N/A'}" | Body: "${ad.body || 'N/A'}" | ROAS: ${ad.roas?.toFixed(2) || 'N/A'}`
  ).join('\n');

  // Random framework hint for variation
  const frameworks = ['comparison', 'problem_solution', 'direct_command', 'stat_implication', 'short_punchy', 'question'];
  const selectedFramework = variationHint || frameworks[Math.floor(Math.random() * frameworks.length)];

  const systemPrompt = `You are an expert direct response copywriter. You TRANSFORM raw test hooks into polished headlines using proven frameworks.

=== CRITICAL RULES ===
1. ONLY use USD ($) currency - NEVER euros (€) or pounds (£)
2. Keep prices realistic for apparel ($15-$60 range typically)
3. Each format should get a DIFFERENT headline approach - don't repeat the same headline

=== HEADLINE FRAMEWORKS (USE THESE) ===

**A) Comparison Hook** (8-15 words)
"[FAMILIAR DURABLE THING] LASTS FOREVER. [YOUR PRODUCT] SHOULD TOO."
Example: "YOUR CAST IRON LASTS FOREVER. YOUR SHIRT SHOULD TOO."

**B) Problem → Solution** (8-15 words)
"[PROBLEM STATEMENT]. [WE FIXED IT / THIS ONE DOESN'T]."
Example: "POLYESTER IS LINKED TO LOW TESTOSTERONE. WE DON'T USE IT."

**C) Direct Command** (5-10 words)
"STOP [PAINFUL BEHAVIOR]."
Example: "STOP BUYING SHIRTS THAT FALL APART."

**D) Stat + Implication** (10-15 words)
"[SHOCKING STAT]. [WHAT THIS MEANS]."
Example: "THE AVERAGE MAN SPENDS $180/YEAR REPLACING SHIRTS. THIS ONE LASTS 30 YEARS."

**E) Short Punchy** (3-8 words)
"[BENEFIT STATEMENT]." or "NO [BAD]. NO [BAD]."
Examples: "BUILT LIKE CAST IRON." / "NO SAG. NO STINK." / "30 YEARS. ONE SHIRT."

**F) Question Hook** (5-10 words)
"[PROVOCATIVE QUESTION]?"
Examples: "Why does your $15 shirt cost $1/wear?" / "What's really in your shirt?"

=== YOUR JOB ===
Take the raw "test hook" (which may be awkward/incomplete) and TRANSFORM it into a proper headline using one of the frameworks above.

Example transformation:
- Raw hook: "Your shirt is a chemical exposure"
- Transformed: "YOUR SHIRT IS SLOWLY POISONING YOU. OURS ISN'T." (Problem → Solution framework)
- Or: "WHAT'S REALLY IN YOUR SHIRT? CHEMICALS YOU CAN'T PRONOUNCE." (Stat + Implication)

=== SPECIAL CASE: EXPERT AUTHORITY TESTS ===
If the test title mentions "Expert Authority" or "Doctor" or "Scientist":
- The headline should sound like it's FROM an expert, not just about the product
- Use authority-driven frameworks like:
  - "MY DOCTOR TOLD ME TO STOP WEARING POLYESTER."
  - "DERMATOLOGISTS WARN: YOUR SHIRT MAY BE IRRITATING YOUR SKIN."
  - "WHAT YOUR DOCTOR KNOWS ABOUT SYNTHETIC FABRICS."
  - "9 OUT OF 10 DERMATOLOGISTS RECOMMEND NATURAL FIBERS."
- The authority claim should be IN THE HEADLINE, not just implied by visuals

=== RED FLAGS (NEVER WRITE THESE) ===
- "High-quality materials" (too generic)
- "The best X you'll ever own" (unsubstantiated)
- "Revolutionary" / "Game-changing" (corporate speak)
- "Introducing..." (no one cares)
- ANY competitor brand names (Amazon, Nike, Hanes, etc.) - LEGAL RISK!
- Use generic terms instead: "regular shirts", "polyester brands", "fast fashion"

=== GREEN FLAGS ===
- Specific numbers ("30 years", "100+ washes")
- Familiar comparisons ("cast iron", "grandpa's tools")
- Direct frustration language ("fall apart", "shrink", "stink")
- Unexpected claims that create curiosity

=== VISUAL DIRECTION ===
- "Expert Authority" in test → show doctor/scientist in lab coat
- "Founder" in test → show founder/entrepreneur figure
- "Comparison" in test → side-by-side contrast
- "Health" in test → medical/scientific imagery`;

  const formatInstructions = getCopyFormatInstructions(format);

  const userPrompt = `Generate ad copy for a ${format.replace('_', ' ')} static ad.

BRAND NAME: "${brandName}"
⚠️⚠️⚠️ CRITICAL SPELLING WARNING ⚠️⚠️⚠️
The brand name is spelled EXACTLY as: "${brandName}"
- If the brand is "Undrdog" do NOT write "Underdog" or "UnderDog" or "Undordog"
- Copy the brand name character-by-character: ${brandName.split('').join('-')}
- Any misspelling is a FAILURE

=== THIS IS THE TEST WE'RE RUNNING ===
TEST TITLE: "${test.title || ''}"
RAW HOOK (transform this into a proper headline): "${test.hook || 'Premium quality product'}"
ANGLE TO EMPHASIZE: "${test.angle || ''}"

⚠️ IMPORTANT: The raw hook above may be awkwardly worded. Your job is to TRANSFORM it into a polished headline using one of the frameworks from the system prompt. Do NOT use the raw hook verbatim if it sounds awkward.
COPY DIRECTION: "${test.copyDirection || ''}"
VISUAL DIRECTION: "${test.visualDirection || ''}"

CRITICAL INSTRUCTIONS:
1. Read the TEST TITLE carefully - it tells you what variable we're testing
2. The HOOK "${test.hook}" should be the central message/headline
3. If the title mentions "Expert Authority" - the copy should sound like it's from a doctor/scientist/expert
4. If the title mentions "Founder" - the copy should sound personal, entrepreneurial
5. If the title mentions "Comparison" - use vs. language and contrast
6. Do NOT generate generic copy - make it specific to this exact test
7. USE ONLY USD ($) - never euros or pounds
8. PREFERRED FRAMEWORK FOR THIS VARIATION: ${selectedFramework.toUpperCase()} - try to use this headline style

VISUAL DIRECTION IS CRITICAL - Based on the test title, you MUST specify what the image should show:
- "Expert Authority" in title → visualDirection MUST say "Show a doctor in white lab coat" or "scientist presenting data"
- "Founder" in title → visualDirection MUST say "Show founder/entrepreneur figure, personal and authentic"
- "Social Proof" in title → visualDirection MUST say "Show customer testimonials, star ratings, review quotes"
- "Comparison" in title → visualDirection MUST say "Side-by-side split showing problem vs solution"
- "Health" in title → visualDirection MUST say "Medical/scientific imagery, health-focused visuals"

The visualDirection field is MANDATORY and must clearly describe WHO or WHAT should appear in the image to match this test.

WINNING AD PATTERNS FROM THIS BRAND (for tone/style reference only):
${winningPatterns || 'No winning patterns available.'}

STRATEGIC CONTEXT:
${strategicContext.winningAngles ? `- Winning angles: ${strategicContext.winningAngles}` : ''}
${strategicContext.copyPatterns ? `- Copy patterns: ${strategicContext.copyPatterns}` : ''}
${strategicContext.audienceSignals ? `- Audience: ${strategicContext.audienceSignals}` : ''}

${formatInstructions}

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "headline": "THE MAIN HEADLINE IN ALL CAPS",
  "subheadline": "Optional secondary text",
  "offerText": "✓ Main benefit or offer",
  "ctaText": "CTA BUTTON TEXT - related to the test angle",
  "topPanel": "For meme format - top panel text",
  "bottomPanel": "For meme format - bottom panel humble response",
  "benefits": ["BENEFIT 1", "BENEFIT 2", "BENEFIT 3"],
  "caption": "For UGC format - casual caption",
  "visualDirection": "MANDATORY: Describe exactly WHO/WHAT should appear in the image based on the test title. Be specific: 'doctor in white lab coat presenting the product' or 'founder holding product, authentic setting'"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    const text = response.content[0].text.trim();

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`[CopyGenerator] Generated AI copy for ${format}:`);
      console.log(`   Headline: ${parsed.headline || parsed.topPanel || 'N/A'}`);
      console.log(`   Visual: ${parsed.visualDirection || 'N/A'}`);
      return parsed;
    }

    throw new Error('Could not parse AI response');
  } catch (err) {
    console.error('[CopyGenerator] AI generation failed:', err.message);
    return generateFallbackCopy(format, test, brandName);
  }
}

/**
 * Get format-specific copy instructions
 */
function getCopyFormatInstructions(format) {
  switch (format) {
    case 'product_hero':
      return `FORMAT: Type 1 Product Hero (CLEAN, BOLD, PRODUCT-FOCUSED)
This format is about the PRODUCT as hero. Clean, minimal, bold.
Generate:
- headline: 8-15 words, explanatory, angle-driven. Structure options:
  A) "[FAMILIAR DURABLE THING] LASTS FOREVER. [YOUR PRODUCT] SHOULD TOO."
  B) "[PROBLEM STATEMENT]. [WE FIXED IT]."
  C) "STOP [PAINFUL BEHAVIOR]."
  D) "[SHOCKING STAT]. [WHAT THIS MEANS]."
- offerText: Single trust signal like "✓ Lifetime Guarantee" or "✓ Free Shipping"
- ctaText: Direct action like "SHOP NOW" or "GET YOURS"
TONE: Bold, confident, direct. No fluff.`;

    case 'meme':
      return `FORMAT: Type 2 Meme Style
Generate:
- topPanel: Emotional overreaction, 5-12 words. Example: "Thank you for changing my life"
- bottomPanel: Humble product response. Structure:
  "I'm literally just a [product] made from [material] that you can [use case 1], [use case 2], [use case 3] that's [benefit]."
  Keep it self-aware and funny.`;

    case 'aesthetic':
      return `FORMAT: Type 3 Aesthetic + Offer
Generate:
- headline: 3-8 words, punchy, assumptive. Examples: "BUILT TO LAST 30 YEARS." / "NO SAG. NO STINK."
- subheadline: Product code style like "001: CLASSIC" or "SIGNATURE EDITION"
- offerText: "NOW AVAILABLE" or "LIMITED EDITION"`;

    case 'illustrated':
      return `FORMAT: Type 4 Illustrated Benefits
Generate:
- headline: Short, punchy. "[PRODUCT]. [COMPARISON]." Example: "HEMP T-SHIRT. HEMP > POLYESTER."
- benefits: Array of 3 short benefit badges, 2-3 words each. Example: ["ALL NATURAL", "ZERO MICROPLASTICS", "LIFETIME GUARANTEE"]
- ctaText: Action + brand identity`;

    case 'vintage':
      return `FORMAT: Type 5 Vintage Magazine (EDITORIAL, AUTHORITATIVE, CLASSIC)
This format mimics 1960s magazine ads. Think Esquire, GQ editorial.
Generate:
- headline: 8-15 words, editorial style, makes a bold authoritative claim. Sound like a magazine article title.
- subheadline: Supporting fact or proof point, journalistic style
- offerText: Badge text like "SINCE 2020" or "DOCTOR RECOMMENDED" or "CLINICALLY PROVEN"
TONE: Authoritative, editorial, classic. Like a trusted magazine endorsement.
DIFFERENT FROM product_hero: More editorial/journalistic, less sales-y.`;

    case 'ugc':
      return `FORMAT: Type 6 UGC Caption
Generate:
- caption: Casual, authentic, like a real customer would write. 10-20 words. First person.
- headline: Optional short callout like "obsessed" or "finally found it"`;

    case 'comparison':
      return `FORMAT: Comparison (MATERIAL VS MATERIAL - like "Hemp vs Polyester")
This format compares BAD MATERIAL vs GOOD MATERIAL in a split-screen.
Based on winning "Hemp vs Polyester" style comparison ads.
Generate:
- headline: 5-10 words, material-focused. Examples: "WHAT'S REALLY IN YOUR SHIRT?" / "POLYESTER IS PLASTIC. WE USE HEMP." / "YOUR SHIRT SHOULDN'T BE MADE OF PLASTIC."
- leftLabel: The BAD material (e.g., "POLYESTER", "SYNTHETIC", "PLASTIC")
- rightLabel: The GOOD material (e.g., "HEMP", "NATURAL FIBERS", "ORGANIC")
- ctaText: Choice-oriented CTA like "CHOOSE NATURAL" or "DITCH THE PLASTIC"
TONE: Educational, health-conscious, eye-opening.
KEY: This is about MATERIALS/INGREDIENTS, not generic problem/solution.`;

    case 'before_after':
      return `FORMAT: Before/After Transformation (WARDROBE SIMPLIFICATION)
This format shows the messy "before" (multiple bad shirts) vs clean "after" (one great shirt).
Generate:
- headline: 8-15 words showing the transformation. Examples: "YOU OWN 3 SHIRTS. THIS REPLACES ALL OF THEM." / "STOP BUYING MEDIOCRE SHIRTS." / "ONE SHIRT. EVERY OCCASION."
- subheadline: 3-5 use cases separated by checkmarks. Example: "✓ Work ✓ Weekend ✓ Date Night"
- ctaText: Upgrade-focused CTA like "UPGRADE NOW" or "SIMPLIFY YOUR WARDROBE"
TONE: Simplification, upgrade, life improvement.
KEY: Show the transformation from cluttered/mediocre to simple/premium.`;

    default:
      return `Generate headline, subheadline, offerText, and ctaText appropriate for the format.`;
  }
}

/**
 * Generate fallback copy without AI
 */
function generateFallbackCopy(format, test, brandName) {
  const hook = test.hook || 'Premium Quality';
  const angle = test.angle || '';

  switch (format) {
    case 'product_hero':
      return {
        headline: hook.toUpperCase(),
        subheadline: angle,
        offerText: '',
        ctaText: 'SHOP NOW',
      };

    case 'meme':
      return {
        topPanel: 'Thank you for changing my life',
        bottomPanel: `I'm literally just a product from ${brandName} that ${hook.toLowerCase()}.`,
      };

    case 'aesthetic':
      return {
        headline: hook.split('.')[0].toUpperCase(),
        subheadline: '001: SIGNATURE',
        offerText: 'NOW AVAILABLE',
      };

    case 'illustrated':
      return {
        headline: hook.toUpperCase(),
        benefits: ['PREMIUM QUALITY', 'BUILT TO LAST', 'GUARANTEED'],
        ctaText: 'SHOP NOW',
      };

    case 'vintage':
      return {
        headline: hook.toUpperCase(),
        subheadline: angle,
        offerText: '',
      };

    case 'ugc':
      return {
        caption: `Finally found ${brandName}. ${hook}`,
        headline: 'obsessed',
      };

    case 'comparison':
      return {
        headline: 'THE DIFFERENCE IS CLEAR',
        leftLabel: 'REGULAR SHIRTS',
        rightLabel: brandName.toUpperCase(),
        ctaText: 'MAKE THE SWITCH',
      };

    case 'before_after':
      return {
        headline: hook.toUpperCase() || 'ONE SHIRT. EVERY OCCASION.',
        subheadline: '✓ Work  ✓ Weekend  ✓ Date Night',
        ctaText: 'UPGRADE NOW',
      };

    default:
      return {
        headline: hook.toUpperCase(),
        ctaText: 'SHOP NOW',
      };
  }
}

/**
 * Generate copy for multiple formats in parallel
 */
async function generateCopyBatch({ formats, test, brandName, winningCopy, strategicContext }) {
  const results = await Promise.all(
    formats.map(format =>
      generateAICopy({ format, test, brandName, winningCopy, strategicContext })
        .then(copy => ({ format, copy, success: true }))
        .catch(err => ({ format, copy: generateFallbackCopy(format, test, brandName), success: false, error: err.message }))
    )
  );

  return results.reduce((acc, { format, copy }) => {
    acc[format] = copy;
    return acc;
  }, {});
}

module.exports = {
  generateAICopy,
  generateCopyBatch,
  generateFallbackCopy,
};
