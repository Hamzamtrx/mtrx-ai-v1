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

═══════════════════════════════════════════════════════════════
COPYWRITING RULES (Cashvertising + Breakthrough Advertising + Your Research)
═══════════════════════════════════════════════════════════════

STEP 1: USE YOUR RESEARCH
Take the cultural references, Reddit phrases, and emotional triggers you found and turn them into headlines.

Example research → headline transformation:
- Reddit: "I'm so tired of buying new shirts every 6 months" → "STOP REPLACING YOUR SHIRTS EVERY 6 MONTHS."
- Cultural ref: BIFL community obsession with durability → "THE BUY-IT-FOR-LIFE SHIRT ACTUALLY EXISTS."
- Emotional trigger: frustration with shrinking → "100 WASHES. ZERO SHRINKAGE. FINALLY."
- Customer language: "fits like it's tailored" → "FITS LIKE IT WAS MADE FOR YOU. BECAUSE THE MATERIAL ADAPTS."

STEP 2: APPLY DIRECT RESPONSE PRINCIPLES

From CASHVERTISING:
- Lead with the biggest benefit or pain point
- Use specific numbers from your research (4x stronger, 100 washes, etc.)
- Make it personal - use "you" and "your"
- Create urgency or scarcity when real

From BREAKTHROUGH ADVERTISING:
- Match the customer's awareness level
- Meet them where they are (frustrated, skeptical, hopeful)
- Promise the transformation they want
- Prove it with specifics

CLARITY OVER CLEVERNESS:
- Headlines must make IMMEDIATE sense to a stranger scrolling
- If you found a great Reddit phrase, use it directly - don't make it "clever"
- The reader should instantly understand the benefit or feel the pain

HEADLINE FORMULAS (combine with your research):
1. PROBLEM-AGITATE: "[Frustration from research]. [Solution]."
   "TIRED OF SHIRTS THAT SHRINK? THIS ONE WON'T."

2. CUSTOMER LANGUAGE + PROOF: Use their exact words + back it up
   "FINALLY, A SHIRT THAT LASTS." (if that's what customers say)

3. CULTURAL HOOK + BENEFIT: Reference they'll recognize + why they care
   "BUILT LIKE YOUR GRANDPA'S WORKWEAR. 4X STRONGER THAN COTTON."

4. SPECIFIC CLAIM: Number from research + clear benefit
   "100 WASHES. STILL FITS LIKE DAY ONE."

BANNED (vague, no research backing):
❌ "America Classic", "Dad Closet Energy", "Timeless Quality"
❌ "Energy", "Vibe", "Aesthetic", "Game-changer"
❌ Any headline that doesn't connect to your actual research

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
Compositions: Floating, Split, Action Demo, Warning
${proposedAngle ? `⚠️ ALL 4 variants MUST be about "${proposedAngle}".` : ''}

CRITICAL HEADLINE RULES FOR TYPE 4:
1. The headline must IMMEDIATELY make sense to a stranger
2. AVOID "vs" or comparison formats - they often don't make sense
3. Use DIRECT statements, problems, or benefits instead

⚠️⚠️⚠️ ABSOLUTELY BANNED ⚠️⚠️⚠️
❌ Any "X vs Y" or "X vs Reality" format
❌ "Panic vs Prepared", "Expectation vs Reality"
❌ "Dad Closet Energy", "Date Night Essential"
❌ "America Classic", any vague 2-word phrases
❌ Any phrase with "Energy", "Vibe", "Essential", "Classic"

✓ GOOD TYPE 4 HEADLINES (direct, clear):
${proposedAngle === 'valentines day' || proposedAngle?.includes('valentine') ? `
FOR VALENTINES DAY:
✓ "DON'T SHOW UP LOOKING LIKE A SLOB." (direct callout)
✓ "SHE'LL NOTICE THE DIFFERENCE." (consequence)
✓ "LOOK GOOD. GET LUCKY." (benefit)
✓ "YOUR SHIRT SHOULDN'T RUIN THE DATE." (problem)
` : ''}
✓ "STOP BUYING SHIRTS THAT SHRINK." (problem)
✓ "100 WASHES. STILL FITS PERFECT." (proof)
✓ "YOUR SHIRT IS THE PROBLEM." (direct callout)
✓ "FINALLY, A SHIRT THAT LASTS." (solution)
✓ "4X STRONGER. FEELS SOFTER." (benefit + proof)

The headline must pass this test: "Would a stranger scrolling understand this in 2 seconds?"

Benefits MUST directly support/prove the headline.
Example: Headline "SHE'LL NOTICE THE DIFFERENCE"
→ Benefits: "Fits your body, not a tent" / "No pit stains" / "Stays tucked"

TYPE 5 - VINTAGE MAGAZINE (4 variants):
Settings: Classic Diner, Workshop, Barbershop, General Store
${proposedAngle ? `⚠️ ALL 4 headlines MUST connect to "${proposedAngle}". Nostalgic but on-angle.` : ''}

CRITICAL: Headlines must be MEANINGFUL sentences, not vague 2-word phrases.
⚠️ BANNED: "America Classic", "Timeless Quality", "Heritage Built", "Old School Cool", "Date Night Essential"

${proposedAngle === 'valentines day' || proposedAngle?.includes('valentine') ? `
FOR VALENTINES DAY:
✓ "YOUR GRANDFATHER NEVER SHOWED UP TO A DATE LOOKING SLOPPY." (nostalgic + relevant)
✓ "BACK WHEN MEN DRESSED TO IMPRESS." (nostalgic + challenge)
✓ "1955: SHIRTS FIT. 2026: MOST DON'T." (specific comparison)
` : ''}
✓ GOOD: "GRANDPA'S SHIRT LASTED 40 YEARS. YOURS WON'T." (clear comparison)
✓ GOOD: "THEY DON'T MAKE 'EM LIKE THIS ANYMORE. UNTIL NOW." (promise)
✓ GOOD: "BEFORE PLANNED OBSOLESCENCE." (provocative, makes you think)

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
        // Log research insights
        if (research.angle_research) {
          const refs = research.angle_research.cultural_references;
          if (refs && refs.length > 0) {
            console.log('   ✓ Cultural refs:', refs.slice(0, 3).join(', '));
          }
          if (research.angle_research.emotional_triggers?.length > 0) {
            console.log('   ✓ Triggers:', research.angle_research.emotional_triggers.slice(0, 3).join(', '));
          }
        }
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
   * Research and generate copy specifically for supplement products
   * @param {Object} options
   * @returns {Promise<Object>} - Research with supplement_copy
   */
  async researchSupplementCopy({ websiteUrl, websiteContent, brandName, productName, keyIngredients, productImageUrl }) {
    console.log('🧠 Starting supplement-specific AI research...');

    // First, analyze the product image for capsule/pill appearance if image URL provided
    let capsuleAnalysis = 'capsules (color and style to be determined from reference image)';
    if (productImageUrl) {
      try {
        console.log('   🔍 Analyzing product image for capsule appearance...');
        const imageAnalysis = await this.client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'url', url: productImageUrl }
              },
              {
                type: 'text',
                text: `Look at this supplement product image. Describe ONLY the capsules/pills visible:
1. Are they capsules, tablets, softgels, or gummies?
2. What COLOR are they? (clear/transparent, white, tan, brown, gold, green, etc.)
3. Are they single-color or two-tone?
4. Any other notable features?

Reply in ONE sentence like: "clear transparent vegetarian capsules" or "two-tone tan and white capsules" or "soft gold-colored softgels"

If no capsules are visible, say "capsules not visible in image".`
              }
            ]
          }]
        });
        capsuleAnalysis = imageAnalysis.content[0].text.trim();
        console.log('   ✓ Capsule analysis:', capsuleAnalysis);
      } catch (err) {
        console.log('   ⚠ Could not analyze product image:', err.message);
      }
    }

    const prompt = `You are an expert direct response copywriter specializing in supplement marketing.

═══════════════════════════════════════════════════════════════
SUPPLEMENT PRODUCT ANALYSIS
═══════════════════════════════════════════════════════════════

BRAND: ${brandName}
PRODUCT: ${productName}
WEBSITE: ${websiteUrl}
KEY INGREDIENTS: ${keyIngredients.length > 0 ? keyIngredients.join(', ') : 'Extract from page content'}

WEBSITE CONTENT:
${websiteContent?.substring(0, 8000) || 'No content available'}

═══════════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════════

1. EXTRACT from the landing page:
   - Brand colors (background, text, accent)
   - Key ingredients (with visual descriptions for each)
   - Main benefits and claims
   - Target audience signals
   - Any guarantees or offers

CAPSULE APPEARANCE (from product image analysis): ${capsuleAnalysis}
*** CRITICAL: Copy this EXACT text to capsule_style in your output. Do NOT change, reword, or guess. ***
If it says "capsules not visible" or "clear capsules", use that EXACTLY.

2. DETECT the primary TARGET AVATAR based on the messaging:
   - Skeptic: Questions supplements, wants proof
   - Food Noise Sufferer: Can't stop thinking about food
   - 3PM Crash: Afternoon energy crash problems
   - Ozempic-Curious: Looking for natural weight loss alternative
   - Emotional Eater: Stress/emotional eating patterns
   - Perimenopause: 40s metabolism changes
   - Diet Veteran: Tried everything, nothing works long-term

3. GENERATE 4 COPY VARIANTS for each static ad type:

   A) BENEFIT CHECKLIST (product + 4 checkmark benefits) - Generate 4 variants:

      *** CRITICAL: H1 AND BENEFITS MUST BE THEMATICALLY CONNECTED ***

      The logic flow MUST be:
      1. H1 → Hooks with HER words about HER specific problem
      2. Benefits → Answer the objections someone with THAT EXACT problem would have
      3. CTA → Promises the resolution to THAT problem

      For each variant:
      - h1_line1: Hook headline about the avatar's specific situation
      - h1_line2: Optional second line (can be null)
      - benefits: 4 checkmark items that DIRECTLY address the H1's problem (not generic benefits)
      - cta: Resolution/action that completes the H1's story

      EXAMPLE - Emotional Eater avatar:
      - H1: "You're not eating because you're hungry."
      - Benefits (all about emotional eating, matching the H1):
        ✓ Saffron supports serotonin (your mood signal)
        ✓ Helps break the stress-eat cycle
        ✓ Reduces emotional snacking urges
        ✓ Works on the WHY, not just the what
      - CTA: "It's not about willpower. It's about chemistry."

      EXAMPLE - Food Noise avatar:
      - H1: "Your brain won't shut up about food."
      - Benefits (all about food noise, matching the H1):
        ✓ Quiets the constant food thoughts
        ✓ Supports natural fullness signals
        ✓ Reduces the "always hungry" feeling
        ✓ Works on the noise, not just the hunger
      - CTA: "Finally turn the volume down."

      DO NOT MIX AVATARS: If H1 is about emotional eating, benefits MUST be about emotional eating.
      If H1 is about food noise, benefits MUST be about food noise. They must match.

   B) INGREDIENT HALO (product surrounded by ingredients) - Generate 4 variants:
      For each variant:
      - h1: Hook about the ingredients or transparency
      - h2: Supporting statement
      - cta: Action statement

*** EACH VARIANT MUST BE COMPLETELY DIFFERENT - NOT SIMILAR ***

VARIANT 1 - Problem-aware (lead with pain):
  H1 format: "You [pain point]" or "[Relatable struggle statement]"
  Example: "You're not eating because you're hungry."

VARIANT 2 - Skeptic angle (address distrust):
  H1 format: "Another [product]? We get it." or "[Acknowledge their doubt]"
  Example: "Another supplement? We'd be skeptical too."

VARIANT 3 - Outcome-focused (promise the result):
  H1 format: "What if [desired outcome]?" or "Imagine [result]"
  Example: "What if you just... stopped thinking about food all day?"

VARIANT 4 - Social proof/Authority:
  H1 format: "[Number] [proof point]" or "[Credibility statement]"
  Example: "7 clinically studied ingredients. Zero proprietary blends."

DO NOT generate 4 variants that all sound similar. Each must use a DIFFERENT angle and tone.

COPYWRITING PRINCIPLES:
- Lead with their PAIN POINT, not your product
- Use SPECIFIC numbers and claims from the page
- Benefits MUST directly relate to the H1 (not generic supplement benefits)
- CTA should promise the OUTCOME they want
- Keep it CONVERSATIONAL and DIRECT

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT (JSON)
═══════════════════════════════════════════════════════════════

{
  "detected_avatar": "skeptic|food-noise|3pm-crash|ozempic-curious|emotional-eater|perimenopause|diet-veteran",
  "supplement_copy": {
    "accent_color": "extracted brand accent color (e.g., 'pink', 'teal', 'gold')",
    "text_color_1": "primary text color from brand (e.g., 'dark purple', 'navy')",
    "text_color_2": "secondary/accent text color from brand",
    "background": "soft gradient using BRAND COLORS for benefit checklist (e.g., 'soft pink to lavender gradient')",
    "halo_background": "dark/premium gradient using BRAND COLORS for ingredient halo (e.g., 'deep purple to dark navy gradient' - must match brand palette)",
    "capsule_style": "COPY EXACTLY from CAPSULE APPEARANCE above - do NOT change or invent colors",
    "trust": "guarantee text from page or '365-Day Money Back Guarantee'",
    "ingredients": [
      { "name": "Ingredient Name", "visual": "Visual description for image generation" },
      { "name": "...", "visual": "..." }
    ],
    "benefit_checklist": [
      {
        "h1_line1": "Variant 1 headline",
        "h1_line2": "Second line or null",
        "benefits": ["Benefit 1", "Benefit 2", "Benefit 3", "Benefit 4"],
        "cta": "CTA button text"
      },
      {
        "h1_line1": "Variant 2 headline (different angle)",
        "h1_line2": "Second line or null",
        "benefits": ["Different benefit framing 1", "2", "3", "4"],
        "cta": "Different CTA"
      },
      {
        "h1_line1": "Variant 3 headline",
        "h1_line2": "Second line or null",
        "benefits": ["..."],
        "cta": "..."
      },
      {
        "h1_line1": "Variant 4 headline",
        "h1_line2": "Second line or null",
        "benefits": ["..."],
        "cta": "..."
      }
    ],
    "ingredient_halo": [
      {
        "h1": "Variant 1 headline",
        "h2": "Subheadline",
        "cta": "CTA"
      },
      {
        "h1": "Variant 2 headline (different angle)",
        "h2": "Subheadline",
        "cta": "CTA"
      },
      {
        "h1": "Variant 3 headline",
        "h2": "Subheadline",
        "cta": "CTA"
      },
      {
        "h1": "Variant 4 headline",
        "h2": "Subheadline",
        "cta": "CTA"
      }
    ]
  }
}

Return ONLY the JSON, no other text.`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          { role: 'user', content: prompt }
        ]
      });

      const content = response.content[0].text;

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const research = JSON.parse(jsonMatch[0]);
        console.log('   ✓ Supplement research complete');
        console.log('   ✓ Detected avatar:', research.detected_avatar);
        if (research.supplement_copy?.benefit_checklist?.h1_line1) {
          console.log('   ✓ Benefit Checklist H1:', research.supplement_copy.benefit_checklist.h1_line1);
        }
        if (research.supplement_copy?.ingredient_halo?.h1) {
          console.log('   ✓ Ingredient Halo H1:', research.supplement_copy.ingredient_halo.h1);
        }
        if (research.supplement_copy?.ingredients?.length > 0) {
          console.log('   ✓ Ingredients found:', research.supplement_copy.ingredients.length);
        }
        return research;
      } else {
        console.log('   ⚠ Could not parse supplement research JSON');
        return null;
      }
    } catch (error) {
      console.error('   ✗ Supplement research failed:', error.message);
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

  // ═══════════════════════════════════════════════════════════════
  // SUPPLEMENTS CATEGORY - Avatar-based pre-defined copy
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get pre-defined supplement copy by avatar, type, and version
   */
  getSupplementCopy(avatar, staticType, version = 'A') {
    const copy = SUPPLEMENT_COPY[avatar];
    if (!copy) return null;

    if (staticType === 'supp-benefit-checklist') {
      return version === 'A' ? copy.benefitChecklist.versionA : copy.benefitChecklist.versionB;
    } else if (staticType === 'supp-ingredient-halo') {
      return version === 'A' ? copy.ingredientHalo.versionA : copy.ingredientHalo.versionB;
    }
    return null;
  }

  /**
   * Build complete prompt for Supplement Benefit Checklist type
   */
  buildSupplementBenefitChecklistPrompt(options) {
    const {
      productName = 'PQ7',
      productDescription = 'teal pouch with pink/green splash design',
      brandName = 'Primal Queen',
      capsuleStyle = 'two tan/beige capsules',
      accentColor = 'pink',
      textColor1 = 'dark purple',
      textColor2 = 'pink',
      background = 'soft light pink/lavender',
      h1Line1,
      h1Line2,
      benefits,
      cta,
      trust = '365-Day Money Back Guarantee',
      aspectRatio = '4:5'
    } = options;

    const benefitsList = benefits.map((b, i) => `✓ ${b}`).join('\\n');

    let headlineText = `"${h1Line1}"`;
    let h2Text = '';
    if (h1Line2) {
      h2Text = `\nBelow H1: "${h1Line2}" in SMALLER text (about 50% size of H1), ${textColor2}`;
    }

    return `Clean supplement static ad, ${aspectRatio} aspect ratio.

BRAND COLOR SCHEME — CRITICAL:
• Background: ${background} (soft gradient, clean)
• Primary accent: ${accentColor}
• TEXT COLORS (use ONLY these 2, no other colors for text):
  - Primary text: ${textColor1}
  - Accent/highlight text: ${textColor2}
• Use ONLY these brand colors - NO random colors

PRODUCT REFERENCE — CRITICAL:
• Use the EXACT product from the reference image
• Match ALL packaging colors, logos, text, and design EXACTLY
• Product must be pixel-perfect to reference

LAYOUT (follow this EXACTLY):

TOP SECTION (full width, centered):
Large bold headline ${headlineText} in ${textColor1}${h2Text}
This headline should be PROMINENT and span the width

MIDDLE SECTION (two columns):
LEFT: Product (${brandName} ${productName}) from reference image, with ${capsuleStyle} at base
RIGHT: Benefit checklist with ${accentColor} checkmarks:
${benefitsList}

BOTTOM SECTION (centered):
Rounded ${accentColor} button: "${cta}"
Below: "★★★★★ ${trust}" in ${accentColor}

STYLE: Clean, minimal, modern. Professional supplement brand aesthetic.

${aspectRatio} aspect ratio.`;
  }

  /**
   * Build complete prompt for Supplement Ingredient Halo type
   */
  buildSupplementIngredientHaloPrompt(options) {
    const {
      productName = 'PQ7',
      productDescription = 'teal pouch with pink/green splash design',
      brandName = 'Primal Queen',
      accentColor = 'pink',
      background = 'dark purple gradient with subtle particle bokeh',
      ingredients,
      h1,
      h2,
      cta,
      aspectRatio = '4:5'
    } = options;

    // Map ingredient positions around the product
    const positions = ['TOP', 'TOP LEFT', 'TOP RIGHT', 'LEFT', 'RIGHT', 'BOTTOM LEFT', 'BOTTOM RIGHT'];
    let ingredientText = '';
    ingredients.forEach((ing, i) => {
      if (i < positions.length) {
        ingredientText += `- ${positions[i]}: ${ing.visual}, labeled "${ing.name}"\\n`;
      }
    });

    return `Supplement ingredient showcase static ad, ${aspectRatio} aspect ratio.

BRAND COLOR SCHEME — CRITICAL:
• Background: ${background}
• This background MUST match ${brandName}'s brand palette exactly
• Accent color: ${accentColor} for text, labels, and UI elements
• Use ONLY the brand's colors - NO random colors
• Ingredients should be rendered in MUTED, NATURAL tones (NOT bright/colorful)
• The overall palette must feel cohesive with ${brandName}'s website aesthetic

PRODUCT REFERENCE — CRITICAL:
• Use the EXACT product from the reference image as center element
• Match ALL packaging colors, logos, text, design EXACTLY
• Product must be pixel-perfect to reference
• Product is the HERO - must dominate center

LAYOUT:
CENTER: Product (${brandName} ${productName}) from reference image - large, prominent

SURROUNDING: ${ingredients.length} natural ingredients floating around the product in a balanced halo.
Render each ingredient in MUTED, DESATURATED, ELEGANT tones (NOT bright/colorful).
Small ${accentColor} labels:
${ingredientText}
Subtle energy lines connecting to product.

TOP: "${h1}" in ${accentColor} or white
Below: "${h2}" in smaller text

BOTTOM: Rounded ${accentColor} button: "${cta}"

STYLE: Dark, luxurious, premium. Cohesive brand aesthetic matching ${brandName}.

${aspectRatio} aspect ratio.`;
  }
}

// ═══════════════════════════════════════════════════════════════
// SUPPLEMENT AVATAR COPY DATABASE
// Pre-defined copy for each avatar from the skill files
// ═══════════════════════════════════════════════════════════════

const SUPPLEMENT_COPY = {
  'skeptic': {
    benefitChecklist: {
      versionA: {
        h1Line1: "Another supplement?",
        h1Line2: "We'd be skeptical too.",
        benefits: [
          "7 ingredients you can actually research",
          "No proprietary blend nonsense",
          "365-day money back guarantee",
          "If it doesn't work, you pay nothing"
        ],
        cta: "Try it. Test it. Return it if we're wrong."
      },
      versionB: {
        h1Line1: "We're not going to call it a miracle.",
        h1Line2: null,
        benefits: [
          "Clinically studied ingredients",
          "Full transparency (no hidden blends)",
          "Real research, not paid testimonials",
          "365 days to decide if it works"
        ],
        cta: "Skeptical? Good. So were we."
      }
    },
    ingredientHalo: {
      versionA: {
        h1: "Berberine. Saffron. Colostrum. Chromium. Red orange. Lemon verbena. Hibiscus. AstraGin.",
        h2: "That's it. That's what's in it.",
        cta: "Nothing hidden. Nothing sketchy."
      },
      versionB: {
        h1: "We didn't just throw 7 things in a capsule and hope for the best.",
        h2: "Each ingredient targets a different reason you can't stop thinking about food.",
        cta: "There's a reason it's called PQ7."
      }
    }
  },
  'food-noise': {
    benefitChecklist: {
      versionA: {
        h1Line1: "Your brain won't shut up about food.",
        h1Line2: "That's not weakness.",
        benefits: [
          "Quiets the constant food thoughts",
          "Supports natural fullness signals",
          "Reduces the 'always hungry' feeling",
          "Works on the noise, not just the hunger"
        ],
        cta: "Finally turn the volume down."
      },
      versionB: {
        h1Line1: "What if you just... stopped thinking about food all day?",
        h1Line2: null,
        benefits: [
          "Targets food noise at the source",
          "Supports serotonin (your satisfaction signal)",
          "Helps your brain feel 'done' after eating",
          "No stimulants, no jitters"
        ],
        cta: "Quiet the loop. Get your brain back."
      }
    },
    ingredientHalo: {
      versionA: {
        h1: "What if the noise just... stopped?",
        h2: "The constant loop. The mental battle. The radio that won't turn off.",
        cta: "7 ingredients to finally quiet your brain."
      },
      versionB: {
        h1: "You're not hungry. Your brain just won't shut up.",
        h2: "Food noise isn't weakness. It's chemistry.",
        cta: "Target the noise, not just the hunger."
      }
    }
  },
  '3pm-crash': {
    benefitChecklist: {
      versionA: {
        h1Line1: "It's 3pm.",
        h1Line2: "You don't have to white-knuckle it.",
        benefits: [
          "Stabilizes blood sugar",
          "Ends the spike-crash cycle",
          "No caffeine needed",
          "No afternoon willpower battle"
        ],
        cta: "Stay you all day. Not just until 2pm."
      },
      versionB: {
        h1Line1: "What if 3pm just felt like... 11am?",
        h1Line2: null,
        benefits: [
          "Steady energy (no crash)",
          "Steady focus (no fog)",
          "Steady mood (no hanger)",
          "Steady you (no snack drawer)"
        ],
        cta: "Skip the crash. Keep going."
      }
    },
    ingredientHalo: {
      versionA: {
        h1: "It's 3pm. You know what happens next.",
        h2: "The crash. The pantry. The promise you'll start fresh tomorrow.",
        cta: "What if you just... didn't crash?"
      },
      versionB: {
        h1: "Your blood sugar is a roller coaster.",
        h2: "And 3pm is the big drop.",
        cta: "Steady energy. All day."
      }
    }
  },
  'ozempic-curious': {
    benefitChecklist: {
      versionA: {
        h1Line1: "This is NOT Ozempic.",
        h1Line2: null,
        benefits: [
          "$59.99/month (not $1,000)",
          "Natural ingredients",
          "No needles",
          "No scary side effects"
        ],
        cta: "Feel full sooner. Stay satisfied longer. Naturally."
      },
      versionB: {
        h1Line1: "The Ozempic alternative",
        h1Line2: "no one's gatekeeping.",
        benefits: [
          "No prescription required",
          "No needles",
          "No $1,000/month",
          "No waiting list"
        ],
        cta: "Same pathways. Plants instead of injections."
      }
    },
    ingredientHalo: {
      versionA: {
        h1: "Same pathways. No needle.",
        h2: "Berberine supports natural GLP-1 production—the same pathway as the $1,000/month stuff.",
        cta: "What they're taking instead."
      },
      versionB: {
        h1: "You've seen the Ozempic results.",
        h2: "What if you could support the same pathways naturally?",
        cta: "No prescription. No waiting list."
      }
    }
  },
  'emotional-eater': {
    benefitChecklist: {
      versionA: {
        h1Line1: "You're not eating because you're hungry.",
        h1Line2: null,
        benefits: [
          "Saffron supports serotonin (your mood signal)",
          "Helps break the stress-eat cycle",
          "Reduces emotional snacking urges",
          "Works on the WHY, not just the what"
        ],
        cta: "It's not about willpower. It's about chemistry."
      },
      versionB: {
        h1Line1: "Stress eating isn't a character flaw.",
        h1Line2: null,
        benefits: [
          "Supports your brain's satisfaction signals",
          "Reduces the urge to eat when you're not hungry",
          "Helps break the emotion → food loop",
          "Clinically studied saffron extract"
        ],
        cta: "Stop fighting yourself. Start supporting yourself."
      }
    },
    ingredientHalo: {
      versionA: {
        h1: "You're not weak. Your serotonin is low.",
        h2: "Saffron boosts the satisfaction signal your brain is missing. That's why willpower doesn't work.",
        cta: "It's not you. It's chemistry."
      },
      versionB: {
        h1: "You know you're not hungry.",
        h2: "But you eat anyway. That's not a character flaw—it's a signal problem.",
        cta: "Fix the signal."
      }
    }
  },
  'perimenopause': {
    benefitChecklist: {
      versionA: {
        h1Line1: "Your 40s changed everything.",
        h1Line2: "Your supplements should too.",
        benefits: [
          "Formulated for hormonal shifts",
          "Supports metabolism changes",
          "Works WITH your new biology",
          "No extreme dieting required"
        ],
        cta: "Stop fighting your body. Start working with it."
      },
      versionB: {
        h1Line1: "'Nothing works anymore.'",
        h1Line2: "We hear that a lot.",
        benefits: [
          "Designed for the 40+ metabolism",
          "Supports natural hormone balance",
          "Helps with stubborn midsection weight",
          "No starvation required"
        ],
        cta: "Your body changed. This was made for that."
      }
    },
    ingredientHalo: {
      versionA: {
        h1: "In your 40s, everything changed.",
        h2: "What used to work doesn't work anymore. Your body isn't broken—it's different.",
        cta: "Your supplements should change too."
      },
      versionB: {
        h1: "Your metabolism isn't what it was.",
        h2: "These ingredients work WITH your changing hormones, not against them.",
        cta: "Formulated for the 40+ body."
      }
    }
  },
  'diet-veteran': {
    benefitChecklist: {
      versionA: {
        h1Line1: "You don't need more diet advice.",
        h1Line2: null,
        benefits: [
          "Works on the wanting, not the eating",
          "Reduces constant food thoughts",
          "No tracking required",
          "No foods off-limits"
        ],
        cta: "You know enough. Now get support that actually helps."
      },
      versionB: {
        h1Line1: "Keto. WW. IF. Macros.",
        h1Line2: "You've done them all.",
        benefits: [
          "Not another diet",
          "No counting, no tracking",
          "Targets why you can't stop wanting more",
          "Supports your brain, not just your plate"
        ],
        cta: "Finally. Help that works on the actual problem."
      }
    },
    ingredientHalo: {
      versionA: {
        h1: "You don't need another diet.",
        h2: "You need your brain to stop screaming for food. Knowledge isn't your problem. The constant mental battle is.",
        cta: "Not about eating less. About wanting less."
      },
      versionB: {
        h1: "You know what to eat.",
        h2: "You just can't stop wanting more.",
        cta: "Target the wanting."
      }
    }
  }
};

// Default ingredients for PQ7 (Primal Queen)
const DEFAULT_INGREDIENTS = [
  { name: 'Berberine', visual: 'Golden-brown root with red berries' },
  { name: 'Saffron', visual: 'Red/orange saffron threads' },
  { name: 'Colostrum', visual: 'Creamy white pearl spheres' },
  { name: 'Chromium', visual: 'Shimmering silver metallic particles' },
  { name: 'Red Orange', visual: 'Vibrant red-orange citrus slice' },
  { name: 'Lemon Verbena', visual: 'Green leaves' },
  { name: 'Hibiscus', visual: 'Pink/red hibiscus flower' }
];

module.exports = CopyResearchService;
