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
async function generateAICopy({ format, test, brandName, winningCopy = [], strategicContext = {}, variationHint = null, brandFacts = '' }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('[CopyGenerator] No API key, using fallback copy');
    return generateFallbackCopy(format, test, brandName);
  }

  const client = new Anthropic();

  // Build context from winning ads
  const winningPatterns = winningCopy.slice(0, 5).map((ad, i) =>
    `${i + 1}. Headline: "${ad.headline || 'N/A'}" | Body: "${ad.body || 'N/A'}" | ROAS: ${ad.roas?.toFixed(2) || 'N/A'}`
  ).join('\n');

  // Build verified brand facts section
  const brandFactsSection = brandFacts
    ? `\n=== VERIFIED BRAND FACTS (USE ONLY THESE) ===\n${brandFacts}\n\nCRITICAL: You may ONLY use claims from the list above. Do NOT invent numbers like "200 washes" or "30 years" or cost-per-wear calculations.`
    : '';

  // Random framework hint for variation
  const frameworks = ['comparison', 'problem_solution', 'direct_command', 'stat_implication', 'short_punchy', 'question'];
  const selectedFramework = variationHint || frameworks[Math.floor(Math.random() * frameworks.length)];

  const systemPrompt = `You are an expert direct response copywriter. You TRANSFORM raw test hooks into polished headlines using proven frameworks.

=== CRITICAL RULES ===
1. ONLY use USD ($) currency - NEVER euros (€) or pounds (£)
2. Keep prices realistic for apparel ($15-$60 range typically)
3. Each format should get a DIFFERENT headline approach - don't repeat the same headline
4. DO NOT MAKE UP SPECIFIC STATISTICS OR CLAIMS - no fake numbers like "200 washes" or "30 years" or "2% return rate"
5. Only use GENERIC benefit language unless the brand info explicitly states a fact
6. SAFE generic claims: "Built to last", "Lifetime guarantee", "Premium quality", "All natural materials"
7. UNSAFE made-up claims: "Lasts 200 washes", "30-year guarantee", "2% return rate", "$180/year savings"
8. LANGUAGE MUST BE NATURAL — write how a real person talks, not marketing jargon
9. NEVER use confusing concepts like "cost per wear", "price per use", or math that requires explanation
10. If a normal person wouldn't understand the headline in 2 seconds, rewrite it simpler

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

**D) Bold Claim + Implication** (10-15 words)
"[BOLD CLAIM]. [WHAT THIS MEANS]."
Example: "MOST SHIRTS END UP IN LANDFILLS. OURS COMES WITH A LIFETIME GUARANTEE."

**E) Short Punchy** (3-8 words)
"[BENEFIT STATEMENT]." or "NO [BAD]. NO [BAD]."
Examples: "BUILT LIKE CAST IRON." / "NO SAG. NO STINK." / "LIFETIME GUARANTEE."

**F) Question Hook** (5-10 words)
"[PROVOCATIVE QUESTION]?"
Examples: "What's really in your shirt?" / "Why do cheap shirts fall apart so fast?"

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
- "Cost per wear" / "price per use" / any math-based value propositions (confusing)
- "$X per wear scam" or similar (people don't think in these terms)
- Any headline that requires calculation to understand
- Marketing jargon that a normal person wouldn't say out loud

=== GREEN FLAGS ===
- Familiar comparisons ("cast iron", "grandpa's tools")
- Direct frustration language ("fall apart", "shrink", "stink")
- Unexpected claims that create curiosity
- Generic durability claims ("lifetime guarantee", "built to last")
- ONLY use specific numbers if they come from verified brand info

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
${brandFactsSection}

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
  D) "[BOLD CLAIM]. [WHAT THIS MEANS]."
- offerText: Single trust signal like "✓ Lifetime Guarantee" or "✓ Free Shipping"
- ctaText: Direct action like "SHOP NOW" or "GET YOURS"
- visualDirection: MUST say "Clean product photography only - no graphics, no dashboards, no overlays"
TONE: Bold, confident, direct. No fluff.
CRITICAL: Product Hero is MINIMAL - just product + text. NO dashboards, NO charts, NO analytics graphics, NO floating UI elements.`;

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

    case 'news_editorial':
      return `FORMAT: Vintage Newspaper (1930s NEWSPAPER CLIPPING AESTHETIC)
This format mimics a scanned 1930s newspaper article. Aged yellowed paper, sepia photography.
Think archived newspaper clipping discovered in grandpa's attic.
Generate:
- headline: 8-15 words, VALUES-level story headline (not product features). Formulas that work:
  A) "The [Person] Who [Did Something Against The Grain]" — e.g., "The Man Who Refused To Sell A Shirt He Wouldn't Wear"
  B) "The [Thing] Has Been [Forgotten/Lost]" — e.g., "The Fabric America Forgot How To Make"
  C) "[Specific Claim] And [Surprising Detail]" — e.g., "One Shirt Lasted A Decade. Then They Stopped Making It."
- subheadline: Supporting statement, newspaper style. E.g., "Kentucky craftsman: If I won't wear it myself, I've got no business selling it to you"
- newspaperName: Vintage newspaper name. E.g., "The American Textile Record" or "The National Quality Gazette"
- photoCaption: Caption for the black & white photo. E.g., "Walter Briggs has worn the same hemp shirt for over a decade"
- photoSubject: Who is in the photo (1930s aesthetic). E.g., "weathered 1930s craftsman, late 50s, grey stubble, work-worn hands"
- photoAction: What they're doing (candid, NOT posing). E.g., "sitting at wooden workbench, inspecting fabric with calloused hands"
- photoSetting: Where (1930s setting). E.g., "small textile workshop, warm window light, dust in air"
- photoEmotion: The mood (authentic). E.g., "quiet pride in craftsmanship, private moment"
- ctaLine: CTA for bottom bar. E.g., "THEY STOPPED MAKING THEM. WE DIDN'T." or "YOUR GRANDPA KNEW. NOW YOU DO TOO."
TONE: Nostalgic, authentic, values-driven. Like discovering a piece of history.
KEY: Headlines tell VALUES stories about people, not product features. Photo subject must NOT look at camera.`;

    case 'testimonial':
      return `FORMAT: Customer Testimonial (PERSONAL STORY + PRODUCT)
This format features a real customer sharing their personal experience.
Think: iPhone selfie + authentic story text overlay.
Generate:
- headline: 8-20 words, FIRST PERSON story that sounds like a real person wrote it. Examples:
  A) "I was honestly skeptical at first, but after a month with this shirt..."
  B) "Finally found a shirt that doesn't fall apart after 3 washes"
  C) "My husband kept stealing mine so I bought him his own"
  D) "After years of polyester giving me rashes, I switched to hemp"
- testimonialStory: 15-30 words, longer personal narrative. Authentic, casual, with genuine emotion.
  Include: specific timeframe ("after a month"), specific detail, genuine reaction
- photoSetting: Casual home environment description. E.g., "cozy living room, natural window light"
- personDescription: Who's in the photo. E.g., "woman mid-30s, genuine smile, casual outfit"
- ctaText: Soft CTA like "Shop Now" or brand name
TONE: Authentic, personal, relatable. NOT salesy. Reads like a real review.
KEY: First person voice, specific details, genuine emotion. Person should look natural, not model-like.`;

    case 'stat_stack_hero':
      return `FORMAT: Stat Stack Hero (EDITORIAL PROOF STORY)
This format shows a real person doing something impressive + stat badges as proof.
Think: Documentary photo of person + overlaid stat badges + social proof.
Generate:
- headline: NOT a traditional headline. Instead, generate a STAT LINE like:
  "365 days | 12 hour shifts | 1 shirt" or "14 job sites | 3 years | 1,460 days of sweat"
- subheadline: The punchline that follows the stats. E.g., "Still going strong" or "1 shirt that actually lasts"
- badges: Array of 4 short proof points, 2-4 words each. E.g., ["4x stronger than cotton", "Zero microplastics", "Hemp + bamboo blend", "Lifetime guarantee"]
- heroSubject: Who is the hero. E.g., "rugged construction worker, mid 30s, tanned weathered skin"
- heroAction: What they're doing (MID-ACTION, not posing). E.g., "carrying lumber on active job site"
- heroClothing: What they're wearing. E.g., "fitted plain black t-shirt, work pants"
- setting: Environment description. E.g., "busy job site, sawdust in air, bright midday sun"
- socialProof: Object with name and credential. E.g., { name: "Jake, 34", credential: "General contractor — same shirt, 14 job sites, 3 years" }
TONE: Documentary, authentic, proof-focused. Like editorial content, NOT advertising.
KEY: Stats must be SPECIFIC numbers. Hero must be MID-ACTION, NOT posing. Feels like earned media.`;

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

    case 'news_editorial':
      return {
        headline: 'The Man Who Refused To Sell A Shirt He Wouldn\'t Wear',
        subheadline: 'Craftsman: If I won\'t wear it myself, I\'ve got no business selling it to you',
        newspaperName: 'The American Textile Record',
        photoCaption: `${brandName} founder inspecting fabric by hand, as he does every batch`,
        photoSubject: 'weathered craftsman, late 50s, grey stubble, work-worn hands',
        photoAction: 'sitting at wooden workbench, inspecting fabric with calloused hands',
        photoSetting: 'small workshop, warm window light, authentic 1930s setting',
        photoEmotion: 'quiet pride in craftsmanship',
        ctaLine: 'THEY STOPPED MAKING THEM. WE DIDN\'T.',
      };

    case 'testimonial':
      return {
        headline: `I was honestly skeptical at first, but ${brandName} changed my mind`,
        testimonialStory: `After years of buying cheap shirts that fall apart, I finally found ${brandName}. ${hook} I'm obsessed.`,
        photoSetting: 'cozy living room, natural window light',
        personDescription: 'real person, mid-30s, genuine smile, casual outfit',
        ctaText: `Shop ${brandName}`,
      };

    case 'stat_stack_hero':
      return {
        headline: '365 days | 12 hour shifts | 1 shirt',
        subheadline: 'Still going strong',
        badges: ['Lifetime Guarantee', 'Premium materials', 'Built to last', 'Zero compromises'],
        heroSubject: 'rugged working professional, mid 40s, confident stance',
        heroAction: 'in their natural work environment',
        heroClothing: 'fitted plain black t-shirt, work pants',
        setting: 'authentic workplace, natural lighting',
        socialProof: { name: 'Real Customer', credential: 'Wears it every single day' },
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
