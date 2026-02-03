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

    // Generate unique session ID to ensure different copy each time
    const sessionId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

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

SESSION: ${sessionId}
⚠️ CRITICAL: Generate COMPLETELY FRESH, UNIQUE copy for this session.
Do NOT use any previously generated headlines or phrases.
Each generation must be DIFFERENT from all others.

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

1. ANALYZE THE BRAND FROM THE WEBSITE:

   A) EXTRACT ACTUAL COLORS FROM THE WEBSITE - BE PRECISE:
      - What is the PRIMARY background color? (e.g., "black", "white", "dark navy")
      - What is their PRIMARY text color? (e.g., "white", "black", "cream")
      - What is their ACCENT color? (buttons, highlights - e.g., "yellow", "red", "teal")

      ⚠️ CRITICAL COLOR RULES:
      - Use EXACT color names: "yellow" NOT "gold", "orange" NOT "amber"
      - If the website has YELLOW, say "yellow" not "gold" or "orange"
      - If the website has WHITE backgrounds, say "white" not "cream" or "off-white"
      - If the website has BLACK, say "black" not "charcoal" or "dark gray"
      - Be LITERAL about what you see - don't interpret or upgrade colors

   B) ANALYZE TYPOGRAPHY/FONT STYLE:
      - Is their headline font SERIF (elegant, traditional - like Times, Playfair) or SANS-SERIF (modern, clean - like Helvetica)?
      - Is it BOLD/HEAVY or LIGHT/THIN?
      - Do they use any SCRIPT/HANDWRITTEN fonts?
      - What's the overall typography vibe? (Premium, Editorial, Modern, Playful, Clinical)
      ⚠️ Describe the font style so we can match it in the ads

   B) TARGET AUDIENCE:
      - Male / Female / Unisex - based on imagery, language, product positioning

   C) BRAND TONE - How does the website SPEAK?
      - Aggressive/Bold: Short punchy sentences, commands, challenges
      - Scientific/Clinical: Data-driven, studies cited, precise language
      - Nurturing/Supportive: Empathetic, understanding, "we get it" energy
      - Premium/Luxury: Sophisticated, refined, exclusive language
      - Rebellious/Edgy: Anti-establishment energy

   D) COPY STYLE - Match the website's actual voice:
      - Look at their headlines - are they questions? Commands? Statements?
      - Look at their word choice - casual or formal? Technical or simple?
      - Look at their energy - calm or intense? Supportive or challenging?

   ⚠️ YOUR COPY MUST MATCH THIS EXACT TONE AND USE THEIR EXACT COLORS.

2. EXTRACT from the landing page:
   - ACTUAL brand colors (background, text, accent) - USE THESE EXACTLY AS THEY APPEAR
   - Key ingredients (with visual descriptions for each)
   - Main benefits and claims - USE THEIR EXACT PHRASING when possible
   - Target audience signals
   - Any guarantees or offers

CAPSULE APPEARANCE (from product image analysis): ${capsuleAnalysis}
*** CRITICAL: Copy this EXACT text to capsule_style in your output. Do NOT change, reword, or guess. ***
If it says "capsules not visible" or "clear capsules", use that EXACTLY.

3. DETECT the primary TARGET AVATAR based on the messaging:
   - Skeptic: Questions supplements, wants proof
   - Food Noise Sufferer: Can't stop thinking about food
   - 3PM Crash: Afternoon energy crash problems
   - Ozempic-Curious: Looking for natural weight loss alternative
   - Emotional Eater: Stress/emotional eating patterns
   - Perimenopause: 40s metabolism changes
   - Diet Veteran: Tried everything, nothing works long-term

3. GENERATE 4 COMPLETELY UNIQUE COPY VARIANTS for each static ad type:

   A) BENEFIT CHECKLIST (product + 4 checkmark benefits) - Generate 4 variants:

      *** CRITICAL: H1 AND BENEFITS MUST BE THEMATICALLY CONNECTED ***
      *** EACH VARIANT MUST TARGET A DIFFERENT AVATAR/ANGLE ***

      The logic flow MUST be:
      1. H1 → Hooks with HER words about HER specific problem
      2. Benefits → Answer the objections someone with THAT EXACT problem would have
      3. CTA → Promises the resolution to THAT problem

      For each variant:
      - h1_line1: Hook headline about the avatar's specific situation
      - h1_line2: Optional second line (can be null)
      - benefits: 4 checkmark items that DIRECTLY address the H1's problem (not generic benefits)
      - cta: Resolution/action that completes the H1's story

      ⚠️ VARIANT REQUIREMENTS - Each of the 4 variants MUST:
      - Target a DIFFERENT avatar (e.g., V1=food noise, V2=ozempic-curious, V3=emotional eater, V4=skeptic)
      - Use a DIFFERENT headline structure/format
      - Have a DIFFERENT emotional tone (frustrated, hopeful, curious, empowered)
      - DO NOT use the example headlines below - create FRESH copy

      EXAMPLE structures (DO NOT COPY - create your own):
      - Problem statement: "You're not eating because you're hungry."
      - Question format: "What if you could just... stop thinking about food?"
      - Comparison: "The Ozempic effect. No prescription needed."
      - Empowerment: "Your cravings don't control you anymore."

      DO NOT MIX AVATARS within a single variant: If H1 is about emotional eating, benefits MUST be about emotional eating.

   B) INGREDIENT HALO (product surrounded by ingredients) - Generate 4 variants:
      For each variant:
      - h1: TOP OF FUNNEL HOOK - must grab attention of someone who doesn't know the product
      - h2: Supporting statement that expands on the pain/curiosity
      - cta: Action statement

*** CRITICAL: THESE ARE TOP-OF-FUNNEL ADS ***
The viewer does NOT know this product. Headlines must:
- Hook with THEIR pain point or desire (not product features)
- Create curiosity or recognition ("that's me!")
- Be emotionally resonant, not educational

*** BAD HEADLINES (too product-focused for TOF): ***
❌ "We show you exactly what's inside"
❌ "7 powerful ingredients working together"
❌ "Nature's most potent formula"
❌ "Transparency you can trust"

*** GOOD HEADLINES (pain/desire focused for TOF): ***
✓ "You think about food every 20 minutes."
✓ "What if the noise just... stopped?"
✓ "Same pathways as Ozempic. No needle."
✓ "Your brain won't shut up about food."
✓ "Not all natural GLP-1 support is created equal."

*** EACH VARIANT MUST BE COMPLETELY DIFFERENT - NOT SIMILAR ***
*** DO NOT REUSE ANY OF THE EXAMPLE HEADLINES BELOW - CREATE NEW ONES ***

VARIANT 1 - Problem-aware (lead with THEIR daily struggle):
  Format: "You [specific pain point]" or "[Observation about their life]"
  Examples (DO NOT USE THESE, create FRESH ones):
  - "You think about food every 20 minutes."
  - "You ate lunch an hour ago. You're already thinking about dinner."
  - "The pantry calls your name at 3pm. Every. Single. Day."

VARIANT 2 - Curiosity/Question (make them wonder):
  Format: "What if [desired outcome]?" or "[Provocative question]?"
  Examples (DO NOT USE THESE, create FRESH ones):
  - "What if appetite control felt natural again?"
  - "What if you could walk past the kitchen without thinking about it?"
  - "Remember when food was just... food?"

VARIANT 3 - Comparison/Alternative (position against known solution):
  Format: Reference Ozempic, GLP-1, or other solutions they've heard of
  Examples (DO NOT USE THESE, create FRESH ones):
  - "Same pathways as Ozempic. No needle."
  - "The GLP-1 effect. Without the prescription."
  - "What they're taking instead of the $1,000/month shot."

VARIANT 4 - Bold claim/Statement (confident, punchy assertion):
  Format: Direct statement that challenges or empowers
  Examples (DO NOT USE THESE, create FRESH ones):
  - "Your willpower isn't the problem."
  - "It's not you. It's your hormones."
  - "Stop fighting biology."

⚠️ UNIQUENESS RULES:
- DO NOT reuse ANY example headlines above - create completely FRESH copy
- DO NOT start multiple headlines with the same word
- Each variant must feel like it came from a DIFFERENT copywriter
- Mix emotional tones: frustrated, hopeful, curious, empowered, skeptical
- Pull from DIFFERENT moments in the customer's day/life for each variant

   C) ILLUSTRATED (bold cartoon/infographic style) - Generate 2 variants:
      Educational but exciting. Bold graphics. Before/after energy.
      For each variant:
      - h1: Bold, punchy headline that educates while exciting
      - h1_highlight: Key words to highlight in accent color
      - benefits: 3 benefit statements with implied icon ideas
      - cta: Action-oriented CTA

      ILLUSTRATED HEADLINES should be:
      - More educational/informative than other types
      - But still emotionally engaging
      - Think infographic meets premium ad
      Examples: "Your Body on [Product]", "The Science of Feeling Full", "What Happens When You Stop Fighting Cravings"

   D) VINTAGE AMERICANA (cinematic nostalgic photography) - Generate 2 variants:
      1950s/60s Americana aesthetic. James Dean vibes. Cinematic and aspirational.
      For each variant:
      - h1: Bold nostalgic headline (ALL CAPS energy)
      - h1_highlight: Key emotional words to highlight
      - subheadline: Supporting statement with product benefits
      - setting: For MALE: gas_station, workshop, farm, highway. For FEMALE: diner, convertible, porch, general_store

      VINTAGE HEADLINES should feel:
      - Bold, confident, timeless
      - "We make 'em like they used to" energy
      Examples: "BUILT FOR MEN WHO DON'T QUIT", "THE WAY NATURE INTENDED"

   E) MINIMALIST HAND (clean editorial with hand illustration) - Generate 2 variants:
      White background, vintage hand-drawn illustration, stacked text.
      For each variant:
      - h1: Price/value headline like "$44 FOR 100 MINERALS"
      - stacked_text: Array of short punchy lines building up (e.g., ["1 PILL", "100 MINERALS", "1,000 BENEFITS"])
      - tagline: Short brand statement like "MINERALS FOR MEN."

      MINIMALIST should feel:
      - Clean, editorial, premium
      - Clever use of numbers and escalation
      Examples: "$29 FOR 30 DAYS", "1 SCOOP. 50 NUTRIENTS. ZERO EXCUSES."

   F) RAW INGREDIENT (dramatic ingredient hero shot) - Generate 2 variants:
      White background, dramatic raw ingredient photo, stacked features.
      For each variant:
      - h1: Bold headline targeting the audience pain point
      - features: Array of short feature statements (ALL CAPS style)
      - ingredient_visual: Description of dramatic raw ingredient (e.g., "raw mineral crystal", "golden turmeric root")

      RAW INGREDIENT HEADLINES should:
      - Call out the target audience directly
      - Be bold and unapologetic
      Examples: "FOR MEN TOO BUSY TO GO TO THE HOSPITAL", "FOR WOMEN WHO REFUSE TO SLOW DOWN"

   G) MEME/CARTOON (funny shareable metaphor) - Generate 2 variants:
      Light background, funny cartoon metaphor, punchy headline.
      For each variant:
      - h1: Funny punchy headline (can be two parts like "Bigger Balls. Bolder You.")
      - cartoon_concept: DETAILED description of funny cartoon metaphor that illustrates the benefit

      MEME CARTOONS should be:
      - Clever visual metaphors for the benefit
      - Funny but not crude
      - Shareable, makes people laugh
      Examples concepts:
      - Small chicken with tiny eggs vs confident ostrich with huge eggs (for testosterone/vitality)
      - Wilted plant vs thriving plant (for energy)
      - Old rusty car vs shiny new car (for anti-aging)

COPYWRITING PRINCIPLES:
- MATCH THE BRAND'S TONE EXACTLY from the website:
  * If brand is AGGRESSIVE: Use commands, challenges, bold statements
  * If brand is NURTURING: Use empathy, understanding, support
  * If brand is SCIENTIFIC: Use data, studies, precise claims
  * If brand is PREMIUM: Use sophisticated, refined language
  * If brand is REBELLIOUS: Use anti-establishment, edgy language
- USE THEIR EXACT PHRASES from the website when possible
- Lead with their PAIN POINT, not your product
- Use SPECIFIC numbers and claims from the page
- Benefits MUST directly relate to the H1 (not generic supplement benefits)
- CTA should promise the OUTCOME they want
- COLORS MUST MATCH THE WEBSITE EXACTLY - extract their actual palette

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT (JSON)
═══════════════════════════════════════════════════════════════

{
  "detected_avatar": "skeptic|food-noise|3pm-crash|ozempic-curious|emotional-eater|perimenopause|diet-veteran",
  "brand_analysis": {
    "target_gender": "male|female|unisex",
    "brand_tone": "aggressive|scientific|nurturing|premium|rebellious",
    "copy_style_notes": "Brief description of how the brand writes copy",
    "website_colors": {
      "primary_bg": "EXACT background color from their website",
      "primary_text": "EXACT primary text color (usually white or black)",
      "accent": "EXACT accent color from their website (buttons, highlights, key elements)",
      "headline_highlight": "Color used to highlight KEY WORDS in headlines (often the accent color like yellow, gold, pink)"
    },
    "typography": {
      "headline_style": "serif-elegant|serif-bold|sans-serif-modern|sans-serif-bold|script-handwritten",
      "headline_weight": "light|regular|bold|heavy",
      "subheadline_style": "same as headline or italic/script for contrast",
      "overall_vibe": "premium-editorial|modern-clean|playful|clinical|luxury"
    }
  },
  "supplement_copy": {
    "accent_color": "EXACT accent color - use literal names like 'yellow' not 'gold', 'red' not 'crimson'",
    "headline_highlight_color": "Same as accent_color for highlighting key words",
    "text_color_1": "Primary text color - 'white' or 'black' typically",
    "text_color_2": "Secondary text color",
    "background": "EXACT background color from website - 'black', 'white', 'dark navy', etc. SOLID color only.",
    "halo_background": "Dark solid color for ingredient halo - 'black', 'dark navy', 'dark purple'. SOLID only.",
    "capsule_style": "COPY EXACTLY from CAPSULE APPEARANCE above - do NOT change or invent colors",
    "trust": "guarantee text from page or '365-Day Money Back Guarantee'",
    "ingredients": [
      { "name": "Ingredient Name", "visual": "Visual description for image generation" },
      { "name": "...", "visual": "..." }
    ],
    "benefit_checklist": [
      {
        "h1_line1": "First line of headline (in primary text color)",
        "h1_line2": "Second line - HIGHLIGHT THIS in accent color (or null)",
        "highlight_words": "Key words from h1_line1 to highlight in accent color (e.g., 'Real Men' or 'every 20 minutes')",
        "benefits": ["Benefit 1", "Benefit 2", "Benefit 3", "Benefit 4"],
        "cta": "CTA button text"
      },
      {
        "h1_line1": "Variant 2...",
        "h1_line2": "...",
        "highlight_words": "...",
        "benefits": ["..."],
        "cta": "..."
      },
      {
        "h1_line1": "Variant 3...",
        "h1_line2": "...",
        "highlight_words": "...",
        "benefits": ["..."],
        "cta": "..."
      },
      {
        "h1_line1": "Variant 4...",
        "h1_line2": "...",
        "highlight_words": "...",
        "benefits": ["..."],
        "cta": "..."
      }
    ],
    "ingredient_halo": [
      {
        "h1": "First part of headline",
        "h1_highlight": "Part to highlight in accent color (e.g., 'for Real Men')",
        "h2": "Subheadline in italic",
        "cta": "CTA"
      },
      {
        "h1": "Variant 2 headline (different angle)",
        "h1_highlight": "highlight portion",
        "h2": "Subheadline",
        "cta": "CTA"
      }
    ],
    "illustrated": [
      {
        "h1": "Bold educational headline",
        "h1_highlight": "Key words to highlight",
        "benefits": ["Benefit 1 with icon idea", "Benefit 2", "Benefit 3"],
        "cta": "Action CTA"
      },
      {
        "h1": "Different angle headline",
        "h1_highlight": "highlight portion",
        "benefits": ["Different benefits"],
        "cta": "CTA"
      }
    ],
    "vintage_magazine": [
      {
        "h1": "BOLD NOSTALGIC HEADLINE IN CAPS",
        "h1_highlight": "Key emotional words",
        "subheadline": "Supporting statement with product benefits",
        "setting": "gas_station|workshop|farm|highway (male) OR diner|convertible|porch|general_store (female)"
      },
      {
        "h1": "DIFFERENT NOSTALGIC ANGLE",
        "h1_highlight": "highlight portion",
        "subheadline": "Different supporting statement",
        "setting": "different setting from above"
      }
    ],
    "minimalist_hand": [
      {
        "h1": "$XX FOR XX [PRODUCT]",
        "stacked_text": ["1 PILL", "100 MINERALS", "1,000 BENEFITS", "1,000,000 YEARS OLD"],
        "tagline": "[PRODUCT] FOR [TARGET]."
      },
      {
        "h1": "DIFFERENT PRICE/VALUE ANGLE",
        "stacked_text": ["Different stacked benefits"],
        "tagline": "Different tagline"
      }
    ],
    "raw_ingredient": [
      {
        "h1": "FOR [TARGET AUDIENCE] TOO BUSY TO [PAIN POINT]",
        "features": ["100 MINERALS", "1,000 BENEFITS", "NO SWEETENERS", "NO FILLERS", "USA MADE", "FOR [TARGET], BY [TARGET]"],
        "ingredient_visual": "dramatic raw mineral crystal on white background"
      },
      {
        "h1": "DIFFERENT BOLD HEADLINE",
        "features": ["Different feature list"],
        "ingredient_visual": "different key ingredient visualization"
      }
    ],
    "meme_cartoon": [
      {
        "h1": "Funny Punchy Headline. Second Part.",
        "cartoon_concept": "Detailed description of funny cartoon metaphor - e.g., 'Two birds side by side: small worried chicken with tiny eggs, confident ostrich with huge eggs. The ostrich looks smug, the chicken looks shocked.'"
      },
      {
        "h1": "Different Funny Headline",
        "cartoon_concept": "Different cartoon metaphor concept"
      }
    ]
  }
}

Return ONLY the JSON, no other text.`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        temperature: 1.0,  // Maximum creativity for unique copy each time
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
        // Log brand analysis
        if (research.brand_analysis) {
          console.log('   ✓ Target gender:', research.brand_analysis.target_gender);
          console.log('   ✓ Brand tone:', research.brand_analysis.brand_tone);
          if (research.brand_analysis.typography) {
            console.log('   ✓ Headline font:', research.brand_analysis.typography.headline_style);
            console.log('   ✓ Font vibe:', research.brand_analysis.typography.overall_vibe);
          }
        }
        // Log color scheme
        if (research.supplement_copy) {
          console.log('   ✓ Background:', research.supplement_copy.background);
          console.log('   ✓ Accent color:', research.supplement_copy.accent_color);
        }
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
      highlightColor = null,  // Color for highlighting key words
      textColor1 = 'dark purple',
      textColor2 = 'pink',
      background = 'soft light pink/lavender',
      h1Line1,
      h1Line2,
      highlightWords = null,  // Words to highlight in accent color
      benefits,
      cta,
      trust = '365-Day Money Back Guarantee',
      aspectRatio = '4:5',
      headlineFont = 'elegant serif',
      fontVibe = 'premium-editorial'
    } = options;

    // Use highlight color or fall back to accent color
    const headlineHighlight = highlightColor || accentColor;

    const benefitsList = benefits.map((b, i) => `✓ ${b}`).join('\\n');

    // Build headline with highlight instructions
    let headlineInstruction = '';
    if (highlightWords) {
      headlineInstruction = `"${h1Line1}" - with "${highlightWords}" highlighted in ${headlineHighlight} color, rest in ${textColor1}`;
    } else {
      headlineInstruction = `"${h1Line1}" in ${textColor1}`;
    }

    let h2Text = '';
    if (h1Line2) {
      h2Text = `\nLine 2: "${h1Line2}" in ${headlineHighlight} color (accent color for emphasis)`;
    }

    return `Clean supplement static ad, ${aspectRatio} aspect ratio.

BACKGROUND — CRITICAL FOR 9:16 EXTENSION:
• Background: ONE SOLID COLOR throughout entire image - ${background.replace(/gradient/gi, '').replace(/soft/gi, '').trim() || 'soft pink/lavender'}
• ⚠️ NO GRADIENTS - The background must be ONE UNIFORM SOLID COLOR from edge to edge
• ⚠️ NO color variations, NO darker edges, NO lighter center
• The SAME EXACT color at top edge, center, and bottom edge
• This is mandatory for clean 9:16 extension later

BRAND COLOR SCHEME:
• Primary accent: ${accentColor}
• TEXT COLORS (use ONLY these 2, no other colors for text):
  - Primary text: ${textColor1}
  - Accent/highlight text: ${textColor2}
• Use ONLY these brand colors - NO random colors

PRODUCT REFERENCE — CRITICAL:
⚠️ Use the EXACT product from the reference image - this is mandatory
⚠️ Match ALL packaging: colors, logos, text, fonts, design EXACTLY as shown
⚠️ Do NOT create a generic supplement - copy the SPECIFIC product
⚠️ The product packaging must be recognizable as the same brand

TYPOGRAPHY — CRITICAL FOR PREMIUM LOOK:
• Headline font: ${headlineFont} typeface (like Playfair Display, Cormorant, or similar elegant font)
• NOT basic Arial/Helvetica - use a PREMIUM, EDITORIAL font style
• Headlines should look like high-end magazine advertising
• Overall vibe: ${fontVibe}
• Subheadlines can use elegant italic or script for contrast

HEADLINE COLOR TECHNIQUE (like winning Facebook ads):
• Use TWO colors in headlines for visual interest
• Primary headline color: ${textColor1}
• Highlight/accent color: ${headlineHighlight} (for key emotional words)
• Example: "Real Minerals" in white, "for Real Men" in yellow/gold

LAYOUT (follow this EXACTLY):

TOP SECTION (full width, centered):
Large ${headlineFont} headline: ${headlineInstruction}${h2Text}
This headline should be PROMINENT, ELEGANT, and span the width

MIDDLE SECTION (two columns):
LEFT: Product (${brandName} ${productName}) from reference image, with ${capsuleStyle} at base
RIGHT: Benefit checklist with ${accentColor} checkmarks in clean modern font:
${benefitsList}

BOTTOM SECTION (centered):
Rounded ${accentColor} button: "${cta}" in clean sans-serif
Below: "★★★★★ ${trust}" in ${accentColor}

STYLE: Premium, editorial, magazine-quality. High-end supplement brand aesthetic.

LAYOUT MARGINS:
• TOP 10% = empty background only
• BOTTOM 10% = empty background only
• All content fits in the middle 80%

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
      highlightColor = null,
      background = 'dark purple gradient with subtle particle bokeh',
      ingredients,
      h1,
      h1Highlight = null,  // Part of headline to highlight
      h2,
      cta,
      aspectRatio = '4:5',
      headlineFont = 'elegant serif',
      fontVibe = 'premium-editorial'
    } = options;

    const headlineHighlight = highlightColor || accentColor;

    // Map ingredient positions around the product
    const positions = ['TOP', 'TOP LEFT', 'TOP RIGHT', 'LEFT', 'RIGHT', 'BOTTOM LEFT', 'BOTTOM RIGHT'];
    let ingredientText = '';
    ingredients.forEach((ing, i) => {
      if (i < positions.length) {
        ingredientText += `- ${positions[i]}: ${ing.visual}, labeled "${ing.name}"\\n`;
      }
    });

    return `Supplement ingredient showcase static ad, ${aspectRatio} aspect ratio.

BACKGROUND — CRITICAL FOR 9:16 EXTENSION:
• Background: ONE SOLID DARK COLOR throughout entire image - ${background.replace(/gradient/gi, '').replace(/subtle particle bokeh/gi, '').replace(/with/gi, '').trim() || 'deep purple'}
• ⚠️ NO GRADIENTS - The background must be ONE UNIFORM SOLID COLOR from edge to edge
• ⚠️ NO bokeh, NO particles, NO color variations, NO darker edges, NO lighter center
• The SAME EXACT color at top edge, center, and bottom edge
• This is mandatory for clean 9:16 extension later

BRAND COLOR SCHEME:
• This background color MUST match ${brandName}'s brand palette exactly
• Use ONLY the brand's colors - NO random colors
• Ingredients should be rendered in MUTED, NATURAL tones (NOT bright/colorful)
• The overall palette must feel cohesive with ${brandName}'s website aesthetic

TEXT READABILITY — CRITICAL:
• ALL text must be HIGHLY READABLE with strong contrast
• Headlines: LARGE, BOLD, WHITE or very light color on dark background
• Subheadlines: White or light cream, clearly visible
• Ingredient labels: White text with subtle dark shadow/outline for readability
• CTA button: High contrast - ${accentColor} button with WHITE text

PRODUCT REFERENCE — CRITICAL:
⚠️ Use the EXACT product from the reference image - this is mandatory
⚠️ Match ALL packaging: colors, logos, text, fonts, design EXACTLY as shown
⚠️ Do NOT create a generic supplement - copy the SPECIFIC product
⚠️ Product is the HERO - must dominate center and be recognizable

LAYOUT:
CENTER: Product (${brandName} ${productName}) from reference image - large, prominent

SURROUNDING: ${ingredients.length} natural ingredients floating around the product in a balanced halo.

INGREDIENT VISUAL STYLE — CRITICAL:
• Render ingredients as NATURAL, PHOTOREALISTIC images of the RAW ingredient
• Examples: actual root/bark pieces, real flower petals, powder piles, herb leaves, citrus slices
• NO abstract icons, NO molecular diagrams, NO geometric shapes, NO fire/flames
• NO scientific symbols, NO embellishments, NO glowing effects around ingredients
• ALL ingredients must have the SAME consistent photorealistic style
• Colors should be MUTED and NATURAL - the actual color of the real ingredient
• Think high-end supplement packaging photography - clean, natural, premium

Small WHITE labels with subtle shadow for readability:
${ingredientText}
Subtle energy lines connecting to product (thin, delicate, not overpowering).

TYPOGRAPHY — CRITICAL FOR PREMIUM LOOK:
• Headline font: ${headlineFont} typeface (like Playfair Display, Cormorant, or elegant serif)
• NOT basic Arial/Helvetica - use a PREMIUM, EDITORIAL font style
• Headlines should look like high-end magazine advertising
• Overall vibe: ${fontVibe}

HEADLINE COLOR TECHNIQUE (like winning Facebook ads):
• Use TWO colors in headlines for visual interest
• Primary: WHITE for main text
• Highlight: ${headlineHighlight} for key emotional words/phrases
• Example: "Real Minerals" in white, "for Real Men" in ${headlineHighlight}

TOP: "${h1}"${h1Highlight ? ` with "${h1Highlight}" in ${headlineHighlight}` : ''} - ${headlineFont}, WHITE text, large, elegant
Below: "${h2}" in elegant italic, WHITE or cream, smaller text

BOTTOM: Rounded ${accentColor} button with WHITE text: "${cta}"

STYLE: Dark, luxurious, premium, magazine-quality. High-end brand aesthetic matching ${brandName}.
ENSURE all text is easily readable - no low contrast combinations.

LAYOUT MARGINS:
• TOP 10% = empty background only
• BOTTOM 10% = empty background only
• All content fits in the middle 80%

${aspectRatio} aspect ratio.`;
  }

  /**
   * Build prompt for Supplement Illustrated style (cartoon/educational)
   */
  buildSupplementIllustratedPrompt(options) {
    const {
      productName = 'Supplement',
      brandName = 'Brand',
      accentColor = 'gold',
      highlightColor = null,
      background = 'dark charcoal',
      h1,
      h1Highlight = null,
      benefits = [],
      cta,
      targetGender = 'unisex',
      aspectRatio = '4:5',
      headlineFont = 'bold sans-serif',
      fontVibe = 'bold-educational'
    } = options;

    const headlineHighlight = highlightColor || accentColor;

    // Gender-appropriate scene
    const personDescription = targetGender === 'female'
      ? 'confident woman (30s, fit, glowing skin)'
      : targetGender === 'male'
      ? 'confident man (30s, athletic build, strong jawline)'
      : 'confident person (30s, healthy, vibrant)';

    return `Illustrated supplement advertisement in bold cartoon/infographic style. ${aspectRatio} aspect ratio.

BACKGROUND — CRITICAL:
• Background: ONE SOLID COLOR - ${background}
• NO gradients, must be uniform solid color edge to edge

STYLE:
Bold 2D illustration style. Clean vector graphics. Educational but exciting.
Think: premium supplement brand meets bold infographic.
NOT childish - sophisticated cartoon style for adults.

PRODUCT REFERENCE — CRITICAL:
⚠️ The product must match the REFERENCE IMAGE EXACTLY
⚠️ Copy the EXACT packaging design, colors, logo, text from reference
⚠️ Do NOT invent a generic supplement bottle - use the SPECIFIC product shown

SCENE COMPOSITION:
CENTER: The EXACT product from reference image rendered in illustrated style
AROUND PRODUCT: Bold graphic elements showing transformation/benefits
${personDescription} shown in before/after or transformation pose (illustrated style)

HEADLINE COLOR TECHNIQUE:
• "${h1}"${h1Highlight ? ` - highlight "${h1Highlight}" in ${headlineHighlight}` : ''}
• Primary text: WHITE
• Highlight color: ${headlineHighlight} for key words

TEXT LAYOUT:
TOP: Bold headline in ${headlineFont}, WHITE with ${headlineHighlight} highlights
MIDDLE: 3 benefit badges with icons:
${benefits.map((b, i) => `• "${b}"`).join('\n')}
BOTTOM: ${accentColor} CTA button: "${cta || 'Try It Now'}"

COLOR PALETTE:
• Background: ${background}
• Accent/highlights: ${headlineHighlight}
• Text: WHITE primary
• Bold, high contrast, premium feel

LAYOUT MARGINS:
• TOP 10% = empty background only
• BOTTOM 10% = empty background only

${aspectRatio} aspect ratio.`;
  }

  /**
   * Build prompt for Supplement Vintage Americana style
   */
  buildSupplementVintageMagazinePrompt(options) {
    const {
      productName = 'Supplement',
      brandName = 'Brand',
      accentColor = 'gold',
      highlightColor = null,
      background = 'warm sepia',
      h1,
      h1Highlight = null,
      subheadline,
      cta,
      targetGender = 'unisex',
      setting = 'gas_station',
      aspectRatio = '4:5',
      headlineFont = 'bold condensed serif',
      trust = ''
    } = options;

    const headlineHighlight = highlightColor || accentColor;

    // Cinematic vintage Americana scenes
    let sceneDescription = '';
    if (targetGender === 'female') {
      switch (setting) {
        case 'diner':
          sceneDescription = `Beautiful woman (early 30s, radiant, confident) sitting at vintage 1950s chrome diner counter. Classic red vinyl stools. Wearing simple elegant top. Supplement bottle on counter beside her. Neon signs in background. Golden afternoon light through windows.`;
          break;
        case 'convertible':
          sceneDescription = `Gorgeous woman (30s, windswept hair, carefree smile) leaning against vintage convertible on coastal road. Supplement bottle in hand. Classic 1960s car, ocean in background. Golden hour sunset light. Old Hollywood glamour vibes.`;
          break;
        case 'porch':
          sceneDescription = `Elegant woman (30s, serene, glowing) on wraparound porch of classic American farmhouse. Rocking chair, white railings. Supplement bottle on small table. Fields in background. Warm morning golden light.`;
          break;
        default:
          sceneDescription = `Stunning woman (early 30s, natural beauty, confident pose) in vintage general store setting. Wooden shelves, old signage. Supplement bottle held naturally. Warm tungsten lighting. Nostalgic small-town America.`;
      }
    } else if (targetGender === 'male') {
      switch (setting) {
        case 'gas_station':
          sceneDescription = `Rugged handsome man (early 30s, James Dean type, strong jaw) leaning against vintage motorcycle outside old gas station. Arms crossed confidently. Worn blue jeans, fitted black t-shirt, leather boots. Classic 1950s American car in background. Dusty desert road. Golden hour warm light. Supplement bottle visible nearby or in hand.`;
          break;
        case 'workshop':
          sceneDescription = `Rugged man (mid 30s, working class build, confident) in garage workshop. Leaning against workbench covered with hand tools. Fitted t-shirt, worn jeans. Old American truck visible through open garage door. Supplement bottle on workbench. Warm tungsten lighting.`;
          break;
        case 'farm':
          sceneDescription = `Athletic man (early 30s, farmer build, weathered good looks) standing by wooden fence on American farmland. Fitted t-shirt, worn jeans. Pickup truck in background. Golden wheat fields. Supplement bottle in hand. Warm sunset light.`;
          break;
        default:
          sceneDescription = `Rugged handsome man (early 30s, athletic, commanding presence) leaning against classic 1960s muscle car. Dusty desert highway. Worn jeans, fitted shirt. Supplement bottle visible. Golden hour cinematic lighting. Nostalgic Americana.`;
      }
    } else {
      sceneDescription = `Attractive person (30s, healthy, confident) in vintage Americana setting - classic car, old diner, or rural landscape. Supplement bottle displayed naturally. Warm golden light. Film photography aesthetic.`;
    }

    const trustBadge = trust ? `\n\nBottom right corner: Circular vintage-style trust badge stamp "${trust}"` : '';

    return `Cinematic vintage Americana photography. Photorealistic. ${aspectRatio} aspect ratio.

SCENE:
${sceneDescription}

STYLE — CRITICAL:
• Photorealistic cinematic photography - NOT a magazine layout
• 1950s/1960s Americana aesthetic
• Film grain texture, warm color grade
• Golden tones, slight nostalgic fade
• Think: cinematic movie still meets vintage ad
• James Dean / old Hollywood energy
• Natural, authentic, aspirational

PRODUCT PLACEMENT:
• Supplement bottle/pouch from reference image
• Placed naturally in scene (in hand, on surface nearby, visible in frame)
• Product should feel part of the scene, not forced
• Must be clearly visible and recognizable

TEXT OVERLAY:
TOP: "${h1}" in bold condensed vintage font (like old Americana signage)
• Cream/off-white color with subtle drop shadow
• ALL CAPS for impact
${h1Highlight ? `• "${h1Highlight}" can be in ${headlineHighlight} for emphasis` : ''}

Below headline: "${subheadline}" in smaller elegant italic
• Same cream color, smaller size

Hand-drawn white arrow pointing to the person or product${trustBadge}

LAYOUT MARGINS:
• TOP 10% = sky/empty background for 9:16 extension
• BOTTOM 10% = ground/empty area

${aspectRatio} aspect ratio.`;
  }

  /**
   * Build prompt for Minimalist Hand-Drawn style
   * Clean white background, vintage hand illustration holding pill, stacked text
   */
  buildSupplementMinimalistPrompt(options) {
    const {
      brandName = 'Brand',
      accentColor = 'yellow',
      h1,
      stackedText = [],
      tagline,
      badge = 'PROUDLY MADE IN THE USA',
      aspectRatio = '4:5'
    } = options;

    const stackedLines = stackedText.map(line => line).join('\n');

    return `Minimalist supplement advertisement. Clean editorial design. ${aspectRatio} aspect ratio.

BACKGROUND — CRITICAL:
• Pure WHITE or very light cream background
• ONE SOLID COLOR throughout - no gradients, no textures
• Clean, minimal, lots of white space

STYLE:
• Minimalist editorial design
• Vintage hand-drawn illustration style (black ink/etching look)
• Think: premium magazine ad, The New Yorker style
• Clean typography, lots of breathing room
• NOT cluttered - elegant simplicity

MAIN ILLUSTRATION:
• Vintage-style hand-drawn illustration of a HAND holding a pill/capsule
• Black ink etching/engraving style (like old medical illustrations)
• Anatomically correct, elegant, classic
• Hand positioned naturally, holding pill between fingers
• NO color in the hand - black linework only
• The pill can have a subtle ${accentColor} accent

TEXT LAYOUT:
TOP LEFT: Bold headline "${h1}" in BLACK, condensed sans-serif, ALL CAPS

Below headline, LEFT-ALIGNED stacked text (clean monospace or sans-serif):
${stackedLines}

Then: "${tagline}" in BLACK

BOTTOM LEFT: Small badge "${badge}" with ${accentColor} highlight/underline
BOTTOM RIGHT: Brand logo "${brandName}" in clean black text with ${accentColor} underline

LAYOUT:
• Text on LEFT side
• Hand illustration on RIGHT side
• Plenty of white space
• Clean, editorial, premium feel

LAYOUT MARGINS:
• All edges have clean white space for 9:16 extension

${aspectRatio} aspect ratio.`;
  }

  /**
   * Build prompt for Raw Ingredient Hero style
   * Dramatic raw ingredient photography with stacked features
   */
  buildSupplementRawIngredientPrompt(options) {
    const {
      brandName = 'Brand',
      accentColor = 'yellow',
      h1,
      features = [],
      ingredientVisual = 'dramatic raw mineral crystal',
      aspectRatio = '4:5'
    } = options;

    const featureLines = features.map(f => f).join('\n');

    return `Raw ingredient hero advertisement. Clean dramatic design. ${aspectRatio} aspect ratio.

BACKGROUND — CRITICAL:
• Pure WHITE or very light gray background
• ONE SOLID COLOR throughout - clean and minimal
• High contrast with the dark ingredient

STYLE:
• Clean minimalist design
• Dramatic product/ingredient photography
• Editorial, premium supplement brand
• Bold typography, clean layout
• Think: high-end vitamin brand meets art direction

MAIN VISUAL:
• Large dramatic photograph of: ${ingredientVisual}
• Photorealistic, high detail, dramatic lighting
• The raw ingredient should look powerful, natural, premium
• Dark/metallic tones against the white background
• Positioned in lower right area of image

TEXT LAYOUT:
TOP: Bold headline "${h1}" in BLACK
• Condensed bold sans-serif, ALL CAPS
• Left-aligned, powerful

Below headline, LEFT-ALIGNED stacked features (clean sans-serif):
${featureLines}

BOTTOM LEFT: Brand logo "${brandName}" in clean black text

COMPOSITION:
• Text stacked on LEFT side, top portion
• Raw ingredient hero shot on RIGHT/BOTTOM
• Clean white space
• Editorial balance

LAYOUT MARGINS:
• Clean white edges for 9:16 extension

${aspectRatio} aspect ratio.`;
  }

  /**
   * Build prompt for Meme/Cartoon Metaphor style
   * Funny cartoon that's a metaphor for the benefit
   */
  buildSupplementMemePrompt(options) {
    const {
      brandName = 'Brand',
      accentColor = 'yellow',
      h1,
      cartoonConcept,
      aspectRatio = '4:5'
    } = options;

    return `Funny cartoon meme advertisement. Shareable humor. ${aspectRatio} aspect ratio.

BACKGROUND — CRITICAL:
• Light beige/cream or very light gray background
• ONE SOLID COLOR throughout - simple, clean
• Muted, not pure white

STYLE:
• Cartoon illustration style
• Funny, clever, shareable meme energy
• Think: New Yorker cartoon meets supplement ad
• Clean lines, expressive characters
• Humor that makes people want to share
• NOT childish - sophisticated humor for adults

CARTOON ILLUSTRATION:
${cartoonConcept}
• Cartoon characters should be expressive and funny
• Clear visual metaphor for the benefit
• Clean illustration style with personality
• Centered in the image

TEXT:
TOP: "${h1}" in BLACK
• Bold serif or sans-serif font
• Punchy, funny headline
• Can have part in bold for emphasis

BOTTOM CENTER: Brand logo "${brandName}" in clean black text
• Small ${accentColor} underline accent

COMPOSITION:
• Headline at TOP
• Cartoon illustration in CENTER (large)
• Brand logo at BOTTOM
• Simple, clean, shareable

LAYOUT MARGINS:
• Clean edges for 9:16 extension
• Plenty of breathing room around cartoon

${aspectRatio} aspect ratio.`;
  }

  // ═══════════════════════════════════════════════════════════════
  // PERFUME / LUXURY CATEGORY
  // ═══════════════════════════════════════════════════════════════

  /**
   * Research and generate copy specifically for perfume/luxury products
   * @param {Object} options
   * @returns {Promise<Object>} - Research with perfume_copy
   */
  async researchPerfumeCopy({ websiteUrl, websiteContent, brandName, productName, productImageUrl }) {
    console.log('🧠 Starting perfume/luxury AI research...');

    const sessionId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const prompt = `You are an expert luxury/fragrance copywriter who writes for high-end perfume brands.

SESSION: ${sessionId}
⚠️ CRITICAL: Generate COMPLETELY FRESH, UNIQUE copy for this session.
Do NOT reuse any previously generated headlines or phrases.

═══════════════════════════════════════════════════════════════
PERFUME / LUXURY PRODUCT ANALYSIS
═══════════════════════════════════════════════════════════════

BRAND: ${brandName}
PRODUCT: ${productName}
WEBSITE: ${websiteUrl}

WEBSITE CONTENT:
${websiteContent?.substring(0, 8000) || 'No content available'}

═══════════════════════════════════════════════════════════════
YOUR TASK
═══════════════════════════════════════════════════════════════

1. ANALYZE THE BRAND FROM THE WEBSITE:

   A) EXTRACT ACTUAL COLORS FROM THE WEBSITE - BE PRECISE:
      - What is the PRIMARY background color? (e.g., "black", "white", "dark navy")
      - What is their PRIMARY text color? (e.g., "white", "black", "cream")
      - What is their ACCENT color? (buttons, highlights - e.g., "gold", "amber", "burgundy")

      ⚠️ CRITICAL COLOR RULES:
      - Use EXACT color names as they appear
      - Be LITERAL about what you see

   B) ANALYZE TYPOGRAPHY/FONT STYLE — CRITICAL FOR MATCHING:
      - Is their headline font SERIF (elegant, traditional - like Didot, Bodoni, Playfair Display, Cormorant) or SANS-SERIF (modern, clean - like Helvetica, Futura, Montserrat)?
      - Is it BOLD/HEAVY or LIGHT/THIN?
      - Is it ALL CAPS or Mixed Case?
      - Do they use any SCRIPT/HANDWRITTEN fonts?
      - What's the LETTER SPACING? Tight or wide/tracked-out?
      - What's the overall typography vibe? (Luxury-Minimal, Luxury-Bold, Modern-Edgy, Classic-Refined)
      ⚠️ Describe the font style in DETAIL so we can match it EXACTLY in the ads
      ⚠️ The ads MUST look like they came from the same brand's design team

   C) TARGET AUDIENCE:
      - Male / Female / Unisex — DETERMINE THIS CAREFULLY:
        ⚠️ Look at the WEBSITE for explicit signals: "for him", "for her", "men's", "women's", model photos, pronouns used
        ⚠️ Look at the PRODUCT NAME — does it say "pour homme", "pour femme", "for men", "for women"?
        ⚠️ Look at SCENT NOTES — woody/leather/tobacco typically = male, floral/sweet/fruity typically = female
        ⚠️ Look at BOTTLE DESIGN — dark/angular = often male, soft/curved/pink = often female
        ⚠️ Look at WEBSITE IMAGERY — male models = male product, female models = female product
        ⚠️ If unsure, say "unisex" — but do NOT guess wrong. Getting the gender wrong ruins the entire campaign.
      - Age range
      - Lifestyle (luxury, streetwear, classic, modern)

   D) BRAND TONE:
      - Confident/Bold: "You don't follow trends"
      - Seductive/Mysterious: "They won't be able to focus"
      - Premium/Refined: "Crafted for the discerning"
      - Rebellious/Edgy: "Not for everyone"
      - Aspirational: "Set the tone"

   E) COPY STYLE - Match the website's actual voice:
      - Look at their headlines - are they questions? Commands? Statements?
      - Look at their word choice - casual or formal? Edgy or refined?
      - Look at their energy - calm or intense? Seductive or bold?
      ⚠️ YOUR COPY MUST MATCH THIS EXACT TONE, FONT STYLE, AND COLORS.

2. EXTRACT FRAGRANCE DETAILS:
   - Scent notes (top, middle, base) if available
   - Key descriptors (woody, fresh, spicy, floral, etc.)
   - Bottle design description
   - Price point / positioning
   - Any unique selling points

3. DETECT THE PRIMARY BUYER AVATAR based on the brand's website messaging:

   ═══════════════════════════════════════════════════════════════
   PERFUME BUYER AVATARS — Choose the ONE that best matches the brand
   ═══════════════════════════════════════════════════════════════

   A) COMPLIMENT CHASER
      WHO: Buys fragrance to be noticed. Lives for "what are you wearing?" moments.
      WEBSITE SIGNALS: Testimonials about reactions, social proof, compliment stories, "people will notice"
      COPY LANGUAGE: "3 compliments before noon", "they asked", "heads turned", "someone stopped me"
      ANGLE: Social proof, external validation, being noticed

   B) SEDUCER
      WHO: Uses fragrance as a weapon. Confidence in dating/attraction/power.
      WEBSITE SIGNALS: Seductive language, attraction imagery, confidence framing, "irresistible", "they can't resist"
      COPY LANGUAGE: "can't focus", "walked past", "couldn't stop thinking", "close encounters"
      ANGLE: Attraction, magnetic pull, seduction, power

   C) SIGNATURE SEEKER
      WHO: Doesn't want to smell like everyone else. Wants ONE defining scent.
      WEBSITE SIGNALS: Uniqueness emphasis, "stand out", "not like the rest", "your scent", individuality
      COPY LANGUAGE: "signature scent", "stand out", "not for everyone", "your scent", "nobody else"
      ANGLE: Identity, individuality, being memorable, being different

   D) UPGRADER
      WHO: Moving from cheap/mainstream to premium. Wants to smell expensive.
      WEBSITE SIGNALS: Premium positioning, quality/craftsmanship messaging, luxury upgrade, "invest in yourself"
      COPY LANGUAGE: "level up", "smell expensive", "grown-up scent", "investment", "quality"
      ANGLE: Status elevation, premium quality, maturity, smelling expensive

   E) NICHE EXPLORER
      WHO: Tired of mainstream. Wants artisan, unusual, sophisticated.
      WEBSITE SIGNALS: Artisan, indie brand, craftsmanship, unusual ingredients, "you won't find this at Sephora"
      COPY LANGUAGE: "not Sauvage", "niche", "unique notes", "for those who know", "you won't find this"
      ANGLE: Discovery, connoisseur status, ahead of the curve, exclusivity

   ⚠️ Pick the avatar that BEST matches the brand's website messaging and tone.
   ⚠️ If unclear, default to "compliment-chaser" (most universally effective for fragrance ads).

   ═══════════════════════════════════════════════════════════════
   DEEP PERSONA RESEARCH — GO BEYOND THE AVATAR LABEL
   ═══════════════════════════════════════════════════════════════

   The avatars above are starting frameworks, NOT cages. You MUST layer in deeper research:

   A) WHO IS THIS PERSON SPECIFICALLY?
      - What age are they? What life stage?
      - Are they single, dating, divorced, married?
      - What's their daily life like? Office job? Entrepreneur? Creative?
      - What emotional state drives this purchase? Confidence? Reinvention? Revenge? Self-love?
      - Example: A "compliment chaser" could be a 22-year-old clubber OR a 38-year-old divorcee rebuilding confidence

   B) WHAT'S THE DEEPER STORY?
      - What happened BEFORE they buy this perfume?
      - What moment triggers the purchase? (New job? Breakup? Birthday? Seeing someone react?)
      - What does this scent REPRESENT in their life beyond just smelling good?
      - What would they post on Reddit/TikTok/Instagram about this?

   C) WHAT LANGUAGE DO REAL PEOPLE USE?
      - Think about how real fragrance buyers talk on Reddit r/fragrance, TikTok #perfumetok, Instagram
      - Real people don't say "redefine elegance" — they say "bro three people asked what I was wearing"
      - Real people don't say "signature presence" — they say "this is the one, I'm done searching"
      - Match the ACTUAL voice of the target customer, not marketing speak

   D) RETURN YOUR PERSONA INSIGHTS:
      - Include a "persona_notes" field describing WHO you're writing for and WHY
      - This helps ensure the copy feels targeted, not generic

   ⚠️ The goal: every piece of copy should feel like it was written for ONE specific person, not "luxury fragrance buyers in general"

4. GENERATE COPY VARIANTS — GUIDED BY AVATAR + YOUR OWN RESEARCH:

   ⚠️ The avatar sets the ANGLE. Your persona research adds the DEPTH and SPECIFICITY.
   ⚠️ A "compliment-chaser" ad sounds COMPLETELY DIFFERENT from a "seducer" ad.
   ⚠️ But a compliment-chaser ad for a 22-year-old also sounds different from one for a 40-year-old.
   ⚠️ Use what you learned about the brand's actual audience to make the copy SPECIFIC and REAL.

   HOW THE AVATAR SHAPES YOUR COPY (angle, NOT exact words):

   - COMPLIMENT CHASER → Copy about other people's REACTIONS. Social moments. Being noticed.
   - SEDUCER → Copy about ATTRACTION. Tension. Confidence. Power dynamics.
   - SIGNATURE SEEKER → Copy about IDENTITY. Standing out. Being unique. Not following.
   - UPGRADER → Copy about LEVELLING UP. Quality. Premium. Growth. Status.
   - NICHE EXPLORER → Copy about DISCOVERY. Connoisseur taste. Being ahead. Exclusivity.

   ⚠️⚠️⚠️ CRITICAL — FRESH COPY RULES:
   • DO NOT paraphrase or rephrase any example copy from this prompt
   • DO NOT use "your scent", "not for everyone", "they asked", "compliments" — these are BURNED phrases
   • INVENT completely new angles, metaphors, and scenarios that fit the avatar
   • Think about what the SPECIFIC PERSONA you researched would actually text their friend
   • Think about what they'd caption on Instagram, say in a Reddit post, or think to themselves
   • Every headline must feel like it's NEVER been written before
   • Each of the 4 variants must explore a COMPLETELY DIFFERENT angle within the avatar

   A) PERFUME AESTHETIC (designed luxury ad — cinematic photography + headline + CTA) - Generate 4 variants:

      These are DESIGNED ADS using cinematic product photography as the base.
      The BOTTLE is 50-60% of the image, with a headline at top, CTA below, and brand logo at bottom.
      Think: Dior Instagram ad, Tom Ford paid social, Chanel Facebook ad — beautiful photo, structured text overlay.
      This is the CONVERSION version — same quality photography as product hero, but designed to sell.

      SETTINGS — choose based on what fits the BRAND and PERSONA:
      - runway: Fashion show/runway, dramatic lighting, audience silhouettes. Best for: bold/edgy brands, confident tone
      - bokeh: Evening/festive bokeh lights, warm amber. Best for: seasonal campaigns, warm/inviting brands
      - moody: Dark dramatic, amber glow, mysterious. Best for: seductive/dark brands, masculine energy
      - marble: Clean marble/stone, luxury interior, minimal. Best for: clean/refined brands, feminine energy
      - urban: City at night, neon reflections, wet streets. Best for: modern/streetwear-adjacent brands
      - nature: Golden hour, outdoor scene, natural warmth. Best for: fresh/clean scent profiles
      - studio: Clean studio lighting, fashion editorial. Best for: high-fashion brands, unisex

      ⚠️ CHOOSE settings that match THIS SPECIFIC brand's vibe — don't default to moody every time
      ⚠️ Each variant MUST use a DIFFERENT setting
      ⚠️ Consider the brand's colors, tone, and target audience when choosing

      For each variant:
      - h1: SHORT one-liner headline (3-10 words MAX) — through the AVATAR'S angle
      - h1_highlight: Key words to highlight in accent color (or null)
      - subheadline: null (DO NOT add subheadlines — keep it minimal)
      - setting: One of the settings above
      - note_badges: Array of 2-3 scent notes as small badges (e.g., ["SANDALWOOD", "MUSK", "LEATHER"]) — only for 1-2 variants, rest should be null

      ⚠️ HEADLINE RULES:
      - SHORT. 3-10 words. One punchy line.
      - Must be ON-ANGLE for the detected avatar
      - NOT product descriptions, NOT generic luxury phrases
      - Think: What does the AVATAR care about?

      *** BAD / BURNED HEADLINES — DO NOT USE THESE OR ANYTHING SIMILAR: ***
      ❌ "Your scent. Not theirs." (BURNED — used too many times)
      ❌ "Your scent. Nobody else's." (BURNED — same idea)
      ❌ "Not for everyone." (BURNED)
      ❌ "They asked. You said nothing." (BURNED)
      ❌ "Three compliments before noon." (BURNED)
      ❌ "Signature presence." (abstract — means nothing)
      ❌ "Timeless sophistication." (no one talks like this)
      ❌ "Redefine elegance." (fortune cookie energy)
      ❌ "Beyond department store" (BURNED — too generic)
      ❌ "Beyond ordinary" or "Beyond ordinary limits" (BURNED)
      ❌ "Push every boundary" (BURNED — motivational poster energy)
      ❌ "Grown man fragrance" (BURNED — patronizing)
      ❌ "Magnetic pull" or "The magnetic pull" (BURNED — abstract, means nothing for a fragrance)
      ❌ "The pull" or anything with "pull" (vague, not specific)
      ❌ "Make them wonder" (BURNED — generic)
      ❌ "Midnight conversations" (BURNED — what does midnight have to do with fragrance?)
      ❌ Anything with "midnight", "whisper", "shadow" — pretentious, not specific
      ❌ Anything with "your scent", "not for everyone", "they asked", "beyond", "magnetic" — OVERUSED
      ❌ Anything ABSTRACT that doesn't create a SPECIFIC image or scenario in your head
      ❌ Anything that sounds like a motivational poster or corporate tagline

      ✅ GOOD headlines create a SPECIFIC SCENE or FEELING:
      ✅ "She leaned in twice." — you can SEE this happening
      ✅ "The one I hide from my brother." — specific, funny, real
      ✅ "I wore this to the interview. Got the job." — concrete scenario

      ⚠️ HEADLINE QUALITY TEST — every headline must pass ALL of these:
      1. "Would the AVATAR actually say or think this?" — if not, rewrite
      2. "Has this been used in a fragrance ad before?" — if yes, rewrite
      3. "Does this create a SPECIFIC image or feeling?" — if not, rewrite
      4. "Would this stop someone scrolling?" — if not, rewrite
      5. "Does this sound like a REAL person talking?" — if not, rewrite
      6. "Is the grammar correct? Does it read as a complete thought?" — if not, FIX IT
      7. "Read it out loud — does it sound natural?" — if not, rewrite

      ⚠️ GRAMMAR IS NON-NEGOTIABLE:
      - Every headline must be a COMPLETE, grammatically correct phrase or sentence
      - If a word is missing, the headline is broken — FIX IT before submitting
      - Read each headline out loud. If it sounds awkward or incomplete, rewrite it.

      ✅ GOOD headline energy: provocative, specific, slightly dangerous, makes you FEEL something
      ❌ BAD headline energy: generic, corporate, motivational, abstract, could apply to any product

      ⚠️ EACH VARIANT MUST:
      - Use a DIFFERENT setting
      - Stay ON-ANGLE for the detected avatar
      - Explore a COMPLETELY DIFFERENT angle/scenario from the other variants
      - Keep headlines SHORT (3-10 words)
      - Be genuinely ORIGINAL — not a paraphrase of anything in this prompt

   B) UGC HOLDING (hand holding perfume with testimonial) - Generate 4 variants:

      Real-feeling hand holding the perfume bottle with a powerful testimonial quote.
      Think: the detected AVATAR sharing their experience casually.

      SETTINGS — choose diverse locations for each variant:
      - bathroom counter (morning routine, mirror, natural light)
      - car dashboard/steering wheel (on the go, leather seat, windshield light)
      - desk at work (professional, keyboard/monitor in background)
      - nightstand/bedroom (intimate, cozy, warm lamp light)
      - gym bag/locker room (post-workout, active lifestyle)
      - restaurant table (date night, candles, glasses in background)
      - couch/coffee table (lazy weekend, relaxed, casual)
      - outside/street (urban, sunlight, walking somewhere)

      ⚠️ Each variant MUST use a DIFFERENT setting
      ⚠️ Choose settings that match the PERSONA's lifestyle

      For each variant:
      - quote: Short, punchy testimonial from the AVATAR'S perspective (1-2 sentences, casual voice)
      - setting: Where the hand is (choose from above or similar)
      - hand_style: Description of the hand/person vibe

      ⚠️ The quote must sound like something the AVATAR would actually say.
      ⚠️ A compliment-chaser talks about reactions. A seducer talks about attraction. A signature-seeker talks about being unique. etc.

      *** BAD / BURNED QUOTES — DO NOT USE: ***
      ❌ "Great fragrance, would recommend!" (generic review)
      ❌ "Smells really nice and lasts long" (boring)
      ❌ "Finally found my scent. Nobody else is wearing this." (BURNED)
      ❌ "Three people asked what I was wearing." (BURNED)
      ❌ Anything with "nobody else" or "they asked" or "compliments" — these are OVERUSED
      ⚠️ Think about what the SPECIFIC PERSONA would actually text their best friend

   C) PRODUCT HERO (cinematic editorial product photography — minimal text) - Generate 4 variants:

      Cinematic product photography in atmospheric settings. Product dominates. ONE subtle headline only.
      Think: Tom Ford campaign, Dior Sauvage editorial, Chanel No. 5 — the product IS the art.
      This is the EDITORIAL version — beautiful photography, minimal text, product-first.

      SETTINGS — choose based on brand vibe (same as aesthetic settings):
      - runway: Fashion show, dramatic spotlights, dark atmosphere
      - bokeh: Evening/festive bokeh lights, warm amber
      - moody: Dark dramatic, amber glow, mysterious
      - marble: Clean marble/stone, luxury interior, minimal
      - urban: City at night, neon reflections, wet streets
      - nature: Golden hour, outdoor, natural warmth
      - studio: Clean studio lighting, fashion editorial

      ⚠️ Each variant MUST use a DIFFERENT setting
      ⚠️ Choose settings that match THIS brand's vibe

      For each variant:
      - h1: Short, subtle headline (3-8 words) — this is a WHISPER, not a shout
      - setting: One of the settings above
      - layout_style: How the bottle sits in the scene

      *** BAD HEADLINES (vague, generic, meaningless): ***
      ❌ "Signature presence." (too abstract — means nothing)
      ❌ "Redefine elegance." (empty words)
      ❌ "Essence of distinction." (sounds like a fortune cookie)
      ❌ "Conversations will stop" (generic — could be about anything)

      ⚠️ Every headline must pass: Would the AVATAR actually say or think this?
      ⚠️ Headlines should be CONVERSATIONAL and SPECIFIC — not abstract luxury buzzwords
      ⚠️ The headline is SECONDARY to the product — keep it short and subtle

   D) MODEL CLOSEUP (intimate person + bottle shot) - Generate 4 variants:

      Close-up of a person casually holding the perfume bottle. Natural, confident, attractive.
      Think: Liquid London or YSL close-up ad — simple, clean, person + bottle.

      For each variant:
      - quote: Short, confident testimonial/headline (1 sentence, first person)
      - model_description: Who the model is (e.g., "woman mid-30s, warm skin, subtle makeup", "man late-20s, stubble, sharp jawline")
      - pose: How they're holding the bottle — MUST be NATURAL:
        ✅ "casually holding bottle at shoulder height" — normal, relaxed
        ✅ "bottle resting in hand near collarbone" — simple, elegant
        ✅ "holding bottle up beside face" — showing it off naturally
        ❌ "pressing bottle against neck" — nobody does this
        ❌ "touching cheek with bottle cap" — weird and unnatural
        ❌ "nuzzling the bottle" — creepy
        The pose should look like how a REAL person would hold a bottle in a photo.
      - lighting: Mood of the lighting (e.g., "warm golden sidelight", "soft diffused", "clean studio")

      ⚠️ The model should match the brand's target gender and age range
      ⚠️ NO nude or topless models — bare shoulders fine, but NO bare chest
      ⚠️ The quote must be through the AVATAR'S angle
      ⚠️ PRODUCT ACCURACY: The quote must be about THIS SPECIFIC product (${productName} by ${brandName}).
        ❌ DO NOT reference any other product, brand, or fragrance name
        ❌ DO NOT use generic quotes that could apply to any product — anchor it to THIS fragrance's actual scent notes, feeling, or experience
        ✅ The quote should feel like someone who actually owns and wears THIS specific fragrance

   E) BENEFIT CALLOUT (luxury benefits + product info) - Generate 4 variants:

      Premium brand ad with product benefits/details. Product centered with benefit callouts.
      Think: luxury brand Instagram ad that educates and converts.

      For each variant:
      - headline: Bold, confident headline about the PRODUCT or EXPERIENCE (e.g., "THE FRAGRANCE THAT LINGERS", "HANDCRAFTED. NEVER MASS-PRODUCED.", "WHAT YOU WEAR WHEN IT MATTERS")
      - benefits: Array of 3-4 short benefits — MUST be TRUE and based on actual product info (e.g., ["Long-lasting Sillage", "Sandalwood & Leather Base", "Handcrafted in the UK", "Eau de Parfum Concentration"])
      - cta: Call to action button text (e.g., "SHOP NOW", "DISCOVER", "TRY IT")
      - bg_color: Rich background color/gradient from brand palette (e.g., "deep charcoal", "black to gold gradient", "rich burgundy")

      ⚠️ FACTUAL ACCURACY IS CRITICAL:
      ❌ DO NOT fabricate stock claims ("sold out", "restocked", "waitlist", "limited stock") — you don't know their inventory
      ❌ DO NOT fabricate review counts ("500+ reviews", "2000 waitlist") — you don't know their numbers
      ❌ DO NOT fabricate sales claims ("best seller", "trending", "#1 seller") — unless the website explicitly states it
      ✅ DO use real product attributes: ingredients, scent notes, concentration (EDP/EDT), origin, craftsmanship
      ✅ DO use experience-based claims: long-lasting, compliment-worthy, versatile, day-to-night
      ✅ DO use brand values found on their website: cruelty-free, vegan, handcrafted, etc.
      ⚠️ Every benefit must be VERIFIABLE from the product page or reasonably true of the product category

   F) FLAT LAY (lifestyle product layout) - Generate 4 variants:

      Top-down or angled view of products on a textured surface. Instagram lifestyle style.
      Think: Fussy ad — casual, authentic, beautiful surface with products arranged naturally.

      For each variant:
      - caption: SHORT, casual Instagram caption (1 sentence MAX — 5-10 words). Think: what someone actually types on their story.
      - surface: What the products are laid on (e.g., "cream knit blanket", "marble counter", "linen fabric", "wooden tray")
      - items: What's in the scene (e.g., "bottle + box + sample vials", "bottle with scattered dried flowers", "bottle with watch and sunglasses")
      - mood: Visual mood (e.g., "cozy morning", "minimal editorial", "luxe lifestyle")

      ⚠️ The caption must sound like a REAL PERSON typed it on their phone:
      ✅ "my daily non-negotiable." — casual, short, real
      ✅ "obsessed with this one tbh" — how people actually talk
      ✅ "the one that stays in the rotation." — specific, natural
      ✅ "morning essentials ☁️" — simple story caption energy
      ❌ "An exquisite blend of aromatic sophistication" — NO ONE talks like this
      ❌ "Elevating my daily ritual with refined luxury" — AI-generated garbage
      ❌ "A curated collection of sensory excellence" — corporate nonsense
      ⚠️ If you wouldn't type it casually on your Instagram story, DON'T write it
      ⚠️ Match the AVATAR's voice — how would they caption this on social media?
      ⚠️ SPELLING & GRAMMAR: Double-check every word in the caption for correct spelling.
        - Read the caption back to yourself. Any misspelled words = rewrite.
        - Product name "${productName}" and brand name "${brandName}" must be spelled EXACTLY right.
        - Common mistake: don't misspell fragrance-related words (cologne, parfum, sillage, etc.)

COPYWRITING PRINCIPLES FOR LUXURY/PERFUME:
- AVATAR-FIRST: Every piece of copy must serve the detected avatar's angle
- DESIRE over DESCRIPTION - sell the feeling, not the product
- CONFIDENCE over CLEVERNESS - bold statements that make them feel powerful
- SPECIFICITY over VAGUENESS - "3 compliments before noon" NOT "signature presence"
- CONVERSATIONAL over ABSTRACT - "They'll ask what you're wearing" NOT "redefine elegance"
- MATCH THE BRAND'S TONE from the website
- Use their EXACT color palette
- Every headline must pass the "would the AVATAR say this?" test
- DO NOT mix avatar angles — stay consistent across all copy

⚠️ SPELLING & PRODUCT ACCURACY (applies to ALL ad types):
- Every word must be spelled correctly — NO exceptions
- The product is "${productName}" by "${brandName}" — spell these EXACTLY
- DO NOT reference or name any other brand or product in any copy
- All quotes, captions, headlines must be about THIS specific product
- Read every piece of copy back — if anything looks misspelled, FIX IT before outputting

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT (JSON)
═══════════════════════════════════════════════════════════════

{
  "detected_avatar": "compliment-chaser|seducer|signature-seeker|upgrader|niche-explorer",
  "persona_notes": "2-3 sentences describing the SPECIFIC person you're writing for. Age, life stage, emotional state, what triggered the purchase. e.g. '35-year-old recently divorced woman rebuilding her identity. She's not buying perfume — she's buying a fresh start. She wants strangers to notice her again.'",
  "brand_analysis": {
    "target_gender": "male|female|unisex",
    "brand_tone": "confident|seductive|premium|rebellious|aspirational",
    "copy_style_notes": "Brief description of brand voice",
    "website_colors": {
      "primary_bg": "EXACT background color",
      "primary_text": "EXACT text color",
      "accent": "EXACT accent color",
      "headline_highlight": "Color for highlighting key words"
    },
    "typography": {
      "headline_style": "serif-elegant|serif-bold|sans-serif-modern|sans-serif-bold|script",
      "headline_weight": "light|regular|bold|heavy",
      "overall_vibe": "luxury-minimal|luxury-bold|modern-edgy|classic-refined"
    }
  },
  "fragrance_details": {
    "scent_notes": {
      "top": ["note1", "note2"],
      "middle": ["note1", "note2"],
      "base": ["note1", "note2"]
    },
    "key_descriptors": ["woody", "fresh", "warm"],
    "bottle_description": "description of the bottle design"
  },
  "perfume_copy": {
    "accent_color": "EXACT accent color from brand",
    "headline_highlight_color": "color for highlighting key headline words",
    "text_color_1": "primary text color",
    "text_color_2": "secondary/accent text color",
    "background_dark": "dark background for moody shots (e.g., 'black', 'deep charcoal')",
    "background_light": "light background for clean shots (e.g., 'light gray', 'warm cream')",
    "aesthetic": [
      {
        "h1": "Bold desire headline",
        "h1_highlight": "Key words to highlight",
        "subheadline": "Supporting line or null",
        "setting": "runway|bokeh|moody|marble",
        "note_badges": ["NOTE1", "NOTE2", "NOTE3"]
      },
      {
        "h1": "Different angle headline",
        "h1_highlight": "highlight words",
        "subheadline": "or null",
        "setting": "different setting",
        "note_badges": null
      },
      {
        "h1": "Third variant",
        "h1_highlight": "highlight",
        "subheadline": "or null",
        "setting": "different setting",
        "note_badges": ["NOTE1", "NOTE2"]
      },
      {
        "h1": "Fourth variant",
        "h1_highlight": "highlight",
        "subheadline": "or null",
        "setting": "different setting",
        "note_badges": null
      }
    ],
    "ugc_holding": [
      {
        "quote": "Short punchy testimonial",
        "setting": "where the hand is",
        "hand_style": "description of hand/person"
      },
      {
        "quote": "Different testimonial",
        "setting": "different location",
        "hand_style": "different vibe"
      },
      {
        "quote": "Third testimonial",
        "setting": "third location",
        "hand_style": "third vibe"
      },
      {
        "quote": "Fourth testimonial",
        "setting": "fourth location",
        "hand_style": "fourth vibe"
      }
    ],
    "product_hero": [
      {
        "h1": "Short subtle headline",
        "setting": "runway|bokeh|moody|marble|urban|nature|studio",
        "layout_style": "bottle arrangement"
      },
      {
        "h1": "Different headline",
        "setting": "different setting",
        "layout_style": "different arrangement"
      },
      {
        "h1": "Third headline",
        "setting": "third setting",
        "layout_style": "third arrangement"
      },
      {
        "h1": "Fourth headline",
        "setting": "fourth setting",
        "layout_style": "fourth arrangement"
      }
    ],
    "model_closeup": [
      {
        "quote": "Intimate first-person testimonial",
        "model_description": "who the model is (gender, age, features)",
        "pose": "how they hold the bottle",
        "lighting": "lighting mood"
      },
      {
        "quote": "Different testimonial",
        "model_description": "different model",
        "pose": "different pose",
        "lighting": "different lighting"
      },
      {
        "quote": "Third testimonial",
        "model_description": "third model",
        "pose": "third pose",
        "lighting": "third lighting"
      },
      {
        "quote": "Fourth testimonial",
        "model_description": "fourth model",
        "pose": "fourth pose",
        "lighting": "fourth lighting"
      }
    ],
    "benefit_callout": [
      {
        "headline": "Bold urgency headline",
        "benefits": ["Benefit 1", "Benefit 2", "Benefit 3", "Benefit 4"],
        "cta": "Call to action text",
        "bg_color": "bold background color/gradient"
      },
      {
        "headline": "Different headline",
        "benefits": ["Benefit 1", "Benefit 2", "Benefit 3"],
        "cta": "Different CTA",
        "bg_color": "different background"
      },
      {
        "headline": "Third headline",
        "benefits": ["Benefit 1", "Benefit 2", "Benefit 3", "Benefit 4"],
        "cta": "Third CTA",
        "bg_color": "third background"
      },
      {
        "headline": "Fourth headline",
        "benefits": ["Benefit 1", "Benefit 2", "Benefit 3"],
        "cta": "Fourth CTA",
        "bg_color": "fourth background"
      }
    ],
    "flat_lay": [
      {
        "caption": "Casual Instagram-style caption",
        "surface": "what products are laid on",
        "items": "what's in the scene",
        "mood": "visual mood"
      },
      {
        "caption": "Different caption",
        "surface": "different surface",
        "items": "different items",
        "mood": "different mood"
      },
      {
        "caption": "Third caption",
        "surface": "third surface",
        "items": "third items",
        "mood": "third mood"
      },
      {
        "caption": "Fourth caption",
        "surface": "fourth surface",
        "items": "fourth items",
        "mood": "fourth mood"
      }
    ]
  }
}

Return ONLY the JSON, no other text.`;

    try {
      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 6000,
        temperature: 1.0,
        messages: [
          { role: 'user', content: prompt }
        ]
      });

      const content = response.content[0].text;

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const research = JSON.parse(jsonMatch[0]);
        console.log('   ✓ Perfume research complete');
        if (research.detected_avatar) {
          console.log('   ✓ Detected avatar:', research.detected_avatar);
        }
        if (research.persona_notes) {
          console.log('   ✓ Persona:', research.persona_notes.substring(0, 120));
        }
        if (research.brand_analysis) {
          console.log('   ✓ Target gender:', research.brand_analysis.target_gender);
          console.log('   ✓ Brand tone:', research.brand_analysis.brand_tone);
          if (research.brand_analysis.typography) {
            console.log('   ✓ Headline font:', research.brand_analysis.typography.headline_style);
            console.log('   ✓ Font vibe:', research.brand_analysis.typography.overall_vibe);
          }
        }
        if (research.fragrance_details) {
          const notes = research.fragrance_details.scent_notes;
          if (notes?.base?.length > 0) {
            console.log('   ✓ Base notes:', notes.base.join(', '));
          }
        }
        if (research.perfume_copy) {
          console.log('   ✓ Background dark:', research.perfume_copy.background_dark);
          console.log('   ✓ Accent color:', research.perfume_copy.accent_color);
        }
        return research;
      } else {
        console.log('   ⚠ Could not parse perfume research JSON');
        return null;
      }
    } catch (error) {
      console.error('   ✗ Perfume research failed:', error.message);
      return null;
    }
  }

  /**
   * Build prompt for Perfume Aesthetic type (dramatic luxury product photography)
   */
  buildPerfumeAestheticPrompt(options) {
    const {
      productName = 'Perfume',
      brandName = 'Brand',
      accentColor = 'gold',
      highlightColor = null,
      textColor1 = 'white',
      textColor2 = 'gold',
      background = 'black',
      h1,
      h1Highlight = null,
      subheadline = null,
      setting = 'moody',
      noteBadges = null,
      aspectRatio = '4:5',
      headlineFont = 'serif-elegant',
      fontVibe = 'luxury-minimal',
      targetGender = 'male'
    } = options;

    const headlineHighlight = highlightColor || accentColor;

    // Smart text color based on setting brightness
    const darkSettings = ['moody', 'runway', 'bokeh', 'urban'];
    const isDarkScene = darkSettings.includes(setting) || background.includes('black') || background.includes('dark');
    const smartTextColor = isDarkScene ? 'white' : (textColor1 || 'black');

    // Setting descriptions + typography per setting
    let settingDescription = '';
    let settingFont = '';
    switch (setting) {
      case 'runway':
        settingDescription = `Fashion show/runway environment. Dramatic directional lighting from above. Blurred silhouettes of models or audience in far background. Dark atmospheric setting with spotlights creating pools of light. Smoke/haze for atmosphere. High fashion editorial energy.`;
        settingFont = `BOLD CONDENSED ALL-CAPS typeface (like Bebas Neue, Oswald, or Druk). Large, impactful, tracked-out. The headline should feel like a fashion billboard — BOLD, HEAVY, COMMANDING. Think GQ magazine cover typography.`;
        break;
      case 'bokeh':
        settingDescription = `Elegant evening setting with warm bokeh lights in background. Festive, sophisticated atmosphere. Warm amber/gold tones throughout. Think: luxury bar, upscale event, holiday evening. Soft focus background with beautiful light circles.`;
        settingFont = `BOLD CONDENSED ALL-CAPS typeface (like Bebas Neue, Oswald, or Druk). Large, warm gold/cream color, impactful. The headline should feel PREMIUM and SEASONAL — like a luxury holiday campaign.`;
        break;
      case 'marble':
        settingDescription = `Clean luxury interior. Marble or stone surface. Minimal, elegant styling. Soft directional light creating gentle shadows. Premium feel - like a high-end boutique display. Neutral tones with subtle warmth.`;
        settingFont = `Elegant ITALIC SERIF typeface (like Playfair Display Italic, Cormorant Garamond Italic, or Didot Italic). Light weight, refined, flowing. Mixed case (NOT all caps). The headline should feel like a high-end magazine editorial — delicate, sophisticated, effortless.`;
        break;
      case 'urban':
        settingDescription = `City at night. Neon reflections on wet streets or rain-slicked surfaces. Modern, edgy atmosphere. Urban luxury — think: downtown rooftop, city lights, sleek concrete. Cool tones with pops of warm neon.`;
        settingFont = `Clean MODERN SANS-SERIF typeface (like Futura, Montserrat, or Gotham). All caps, tracked-out, confident. The headline should feel urban and contemporary — like a streetwear-meets-luxury campaign.`;
        break;
      case 'nature':
        settingDescription = `Golden hour outdoor setting. Warm natural light, sun flares, earthy tones. Think: Mediterranean terrace, garden at sunset, beach at golden hour. Fresh, warm, inviting. Natural beauty meets luxury.`;
        settingFont = `Elegant LIGHT SERIF typeface (like Cormorant Light, Playfair Display Light). Mixed case, gentle, flowing. The headline should feel warm and organic — like a luxury lifestyle magazine.`;
        break;
      case 'studio':
        settingDescription = `Clean fashion studio. Professional directional lighting, soft shadows, clean backdrop. Think: high-fashion editorial shoot, Vogue-style product photography. Neutral tones, perfect lighting, pure focus on the product.`;
        settingFont = `Clean CONDENSED SANS-SERIF typeface (like Oswald, Barlow Condensed, or Druk Text). All caps, sharp, editorial. The headline should feel like a fashion magazine cover — clean, authoritative, premium.`;
        break;
      default:
        // moody
        settingDescription = `Dark, dramatic environment. Deep black/charcoal background. Warm amber/gold accent lighting creating rim light on the bottle. Mysterious, seductive atmosphere. Think: candlelit room, warm glow against darkness. Cinematic lighting.`;
        settingFont = `Elegant THIN SERIF typeface (like Cormorant Light, Playfair Display Light, or Didot Light). Thin, delicate strokes. Mixed case with proper punctuation. The headline should feel intimate and refined — like whispered luxury, NOT shouted.`;
    }

    // No note badges or subheadlines — aesthetic is ONE headline only

    return `Luxury perfume advertisement — cinematic product photography with designed text overlay. FULL BLEED. ${aspectRatio} aspect ratio.

⚠️ FULL BLEED IMAGE — NO BORDERS, NO MARGINS:
• The photograph fills the ENTIRE ${aspectRatio} frame from edge to edge
• NO solid colored borders or margins
• This is a FULL-FRAME cinematic photograph with text designed INTO it — like a Dior Instagram ad

SETTING & ATMOSPHERE:
${settingDescription}
The scene fills the entire frame — atmosphere extends to all edges naturally.

PRODUCT — THE CENTERPIECE:
⚠️ Use the EXACT perfume bottle from the reference image
⚠️ Match ALL bottle design: shape, cap, label, colors EXACTLY as shown
⚠️ Do NOT create a generic perfume bottle — copy the SPECIFIC product
⚠️ Bottle is the hero — large, beautifully lit, cinematic
⚠️ The bottle takes up 50-60% of the frame — leaving room for text above and below

TYPOGRAPHY — THIS IS CRITICAL FOR LUXURY FEEL:
⚠️ Font: ${settingFont}
⚠️ The typography MUST look EXPENSIVE — like a luxury brand's agency designed it
⚠️ DO NOT use cheap/default fonts: NO Arial, NO Times New Roman, NO Helvetica
⚠️ The font should feel like it belongs in Vogue, GQ, or a Dior campaign

TEXT LAYOUT — THREE ELEMENTS (designed into the image):

1) HEADLINE (top area):
"${h1}"
• Text color: ${smartTextColor}
• Font: ${settingFont}
• Positioned at TOP of image — NOT over the product
• ⚠️ DO NOT render this text more than ONCE
• Soft DROP SHADOW or GLOW so text pops against the scene
• Bold enough to read at a glance but not overpowering the product

2) CTA (bottom area, below product):
"SHOP NOW"
• Elegant thin-bordered rectangle or refined underlined text
• ${smartTextColor} color — subtle, confident
• Small, clean — like a luxury e-commerce button
• Centered horizontally

3) BRAND LOGO (very bottom):
⚠️ A second reference image (the brand's LOGO) has been provided
⚠️ Use the EXACT logo from the second reference image — do NOT recreate it
⚠️ Place small and elegant at very bottom center
• If no second reference image available, render "${brandName}" in elegant TRACKED-OUT SERIF CAPS, small

STYLE:
• This is a DESIGNED AD — not just a photo. Think: Dior Instagram ad, Tom Ford paid social
• Cinematic product photography AS THE BASE, with clean text overlay designed into it
• The layout should feel intentional — headline draws you in, product sells you, CTA converts
• Premium lighting, moody atmosphere, luxury typography
• Every element has a PURPOSE: headline (hook) → product (desire) → CTA (action) → brand (trust)
• NO clutter — clean hierarchy, generous spacing between elements

${aspectRatio} aspect ratio.`;
  }

  /**
   * Build prompt for Perfume UGC Holding type (hand holding bottle with testimonial)
   */
  buildPerfumeUGCHoldingPrompt(options) {
    const {
      productName = 'Perfume',
      brandName = 'Brand',
      accentColor = 'gold',
      textColor1 = 'white',
      quote,
      setting = 'bathroom counter',
      handStyle = 'well-groomed masculine hand',
      aspectRatio = '4:5',
      targetGender = 'male'
    } = options;

    const handDescription = targetGender === 'female'
      ? 'elegant feminine hand, well-manicured nails, natural look'
      : targetGender === 'male'
      ? 'masculine hand, well-groomed, clean, strong'
      : 'well-groomed hand, natural, clean';

    return `UGC-style perfume photograph. FULL BLEED — photo fills the ENTIRE frame edge to edge. ${aspectRatio} aspect ratio.

⚠️ FULL BLEED PHOTO — NO BORDERS, NO MARGINS:
• The photograph fills the ENTIRE ${aspectRatio} frame from edge to edge
• NO solid colored borders or empty space around the photo
• This looks like an iPhone photo that fills the whole screen
• The scene (counter, background, setting) extends naturally to all edges

SCENE:
${handStyle || handDescription} naturally holding the perfume bottle.
Setting: ${setting}
The hand should look REAL - natural skin texture, visible knuckles, proper proportions.
EXACTLY 5 fingers. Natural grip on the bottle.
Casual but intentional - like someone showing a friend what they're wearing.
Background: natural setting with shallow depth of field (slightly blurred behind the hand).

PRODUCT REFERENCE — CRITICAL:
⚠️ Use the EXACT perfume bottle from the reference image
⚠️ Match ALL bottle design: shape, cap, label, colors EXACTLY
⚠️ The bottle COLOR must match the reference — do NOT make it white, clear, or change its color
⚠️ If the bottle is dark/black/amber/colored in the reference, it MUST be that SAME color
⚠️ Bottle must be clearly visible and recognizable

PHOTOGRAPHY STYLE:
• iPhone camera quality - slightly warm, natural
• Shallow depth of field — background softly blurred
• Natural/ambient lighting
• Feels REAL, not studio shot
• Slight grain for authenticity
• Like an Instagram story — fills the whole screen

TEXT — QUOTE AT TOP OF IMAGE:
⚠️ Font: Clean, modern, ROUNDED sans-serif (like Poppins, Nunito, or Circular) — NOT handwritten, NOT script
⚠️ Must look like polished Instagram story text — clean, modern, easy to read

"${quote}"
• WHITE color — ALWAYS white text
• CENTERED horizontally
• Proper curly quotation marks \u201C \u201D
• Medium-large size — easy to read at a glance
• ⚠️ POSITION: The quote should sit in the UPPER THIRD of the image (around 15-30% from the top)
• ⚠️ NOT jammed at the very top edge — leave breathing room above the text
• ⚠️ The hand holding the bottle should be in the MIDDLE/LOWER portion
• ⚠️ There should be CLEAR SPACE between the quote text and the hand — they should NOT overlap
• STRONG text shadow or dark semi-transparent glow behind text for guaranteed readability
• Think of the layout: TOP = quote text, MIDDLE = hand + bottle, BOTTOM = brand logo

BRAND LOGO — BOTTOM CENTER:
⚠️ A second reference image (the brand's LOGO) has been provided
⚠️ Use the EXACT logo from the second reference image — do NOT recreate or redesign it
⚠️ Place the logo at the BOTTOM CENTER of the image, small and elegant
• The logo should be subtle — a refined brand watermark, not dominant
• If no second reference image is available, render "${brandName}" in elegant SERIF CAPS (tracked-out, refined, small)

SKIN REALISM:
• Real skin texture, visible pores
• NOT airbrushed or plastic

${aspectRatio} aspect ratio.`;
  }

  /**
   * Build prompt for Perfume Product Hero type (clean floating product shot)
   */
  buildPerfumeProductHeroPrompt(options) {
    const {
      productName = 'Perfume',
      brandName = 'Brand',
      accentColor = 'gold',
      highlightColor = null,
      textColor1 = 'white',
      textColor2 = 'gold',
      background = 'black',
      h1,
      setting = 'moody',
      layoutStyle = 'single bottle centered',
      aspectRatio = '4:5',
      headlineFont = 'serif-elegant',
      fontVibe = 'luxury-minimal',
      targetGender = 'male'
    } = options;

    // Setting descriptions + typography — same cinematic approach as aesthetic
    let settingDescription = '';
    let settingFont = '';
    switch (setting) {
      case 'runway':
        settingDescription = `Fashion show/runway environment. Dramatic directional lighting from above. Blurred silhouettes of models or audience in far background. Dark atmospheric setting with spotlights creating pools of light. Smoke/haze for atmosphere. High fashion editorial energy.`;
        settingFont = `BOLD CONDENSED ALL-CAPS typeface (like Bebas Neue, Oswald, or Druk). Large, impactful, tracked-out.`;
        break;
      case 'bokeh':
        settingDescription = `Elegant evening setting with warm bokeh lights in background. Festive, sophisticated atmosphere. Warm amber/gold tones throughout. Think: luxury bar, upscale event, holiday evening. Soft focus background with beautiful light circles.`;
        settingFont = `BOLD CONDENSED ALL-CAPS typeface (like Bebas Neue, Oswald, or Druk). Large, warm gold/cream color, impactful.`;
        break;
      case 'marble':
        settingDescription = `Clean luxury interior. Marble or stone surface. Minimal, elegant styling. Soft directional light creating gentle shadows. Premium feel - like a high-end boutique display. Neutral tones with subtle warmth.`;
        settingFont = `Elegant ITALIC SERIF typeface (like Playfair Display Italic, Cormorant Garamond Italic, or Didot Italic). Light weight, refined, flowing. Mixed case.`;
        break;
      case 'urban':
        settingDescription = `City at night. Neon reflections on wet streets or rain-slicked surfaces. Modern, edgy atmosphere. Urban luxury — think: downtown rooftop, city lights, sleek concrete. Cool tones with pops of warm neon.`;
        settingFont = `Clean MODERN SANS-SERIF typeface (like Futura, Montserrat, or Gotham). All caps, tracked-out, confident.`;
        break;
      case 'nature':
        settingDescription = `Golden hour outdoor setting. Warm natural light, sun flares, earthy tones. Think: Mediterranean terrace, garden at sunset, beach at golden hour. Fresh, warm, inviting. Natural beauty meets luxury.`;
        settingFont = `Elegant LIGHT SERIF typeface (like Cormorant Light, Playfair Display Light). Mixed case, gentle, flowing.`;
        break;
      case 'studio':
        settingDescription = `Clean fashion studio. Professional directional lighting, soft shadows, clean backdrop. Think: high-fashion editorial shoot, Vogue-style product photography. Neutral tones, perfect lighting, pure focus on the product.`;
        settingFont = `Clean CONDENSED SANS-SERIF typeface (like Oswald, Barlow Condensed, or Druk Text). All caps, sharp, editorial.`;
        break;
      default:
        // moody
        settingDescription = `Dark, dramatic environment. Deep black/charcoal background. Warm amber/gold accent lighting creating rim light on the bottle. Mysterious, seductive atmosphere. Think: candlelit room, warm glow against darkness. Cinematic lighting.`;
        settingFont = `Elegant THIN SERIF typeface (like Cormorant Light, Playfair Display Light, or Didot Light). Thin, delicate strokes. Mixed case with proper punctuation. Intimate and refined.`;
    }

    const darkSettings = ['moody', 'runway', 'bokeh', 'urban'];
    const isDarkScene = darkSettings.includes(setting);
    const smartTextColor = isDarkScene ? 'white' : (textColor1 || 'black');

    return `Cinematic luxury perfume product photography. FULL BLEED — image fills the ENTIRE frame edge to edge. ${aspectRatio} aspect ratio.

⚠️ FULL BLEED IMAGE — NO BORDERS, NO MARGINS, NO EMPTY SPACE:
• The photograph must fill the ENTIRE ${aspectRatio} frame from edge to edge
• NO solid colored borders or margins around the image
• This is a FULL-FRAME cinematic photograph, like a magazine spread
• The atmosphere, lighting, and scene must reach every edge of the image

SETTING & ATMOSPHERE:
${settingDescription}
The scene fills the entire frame — atmosphere extends to all edges naturally.

PRODUCT — THE HERO:
⚠️ Use the EXACT perfume bottle from the reference image
⚠️ Match ALL bottle design: shape, cap, label, colors EXACTLY as shown
⚠️ Do NOT create a generic perfume bottle — copy the SPECIFIC product
⚠️ Bottle must DOMINATE the image — large, beautifully lit, cinematic
⚠️ The bottle is 70% of the visual focus. It IS the ad.

TEXT — EXACTLY ONE SUBTLE HEADLINE:
⚠️ The ONLY text in the ENTIRE image is this single headline. NOTHING ELSE.
⚠️ NO brand names, NO CTAs, NO subheadlines, NO badges, NO extra text of any kind.

"${h1}"
• Text color: ${smartTextColor}
• Font: ${settingFont}
• ⚠️ SUBTLE — the headline is secondary to the product. Small-medium size.
• Soft DROP SHADOW or GLOW so text pops against the scene
• Placed at TOP or BOTTOM of image — NOT over the product
• ⚠️ DO NOT render this text more than ONCE — it appears in exactly ONE place
• ⚠️ The text must look like it was typeset by a luxury brand's design team
• ⚠️ DO NOT use cheap/default fonts: NO Arial, NO Times New Roman, NO Helvetica

STYLE:
• Tom Ford / Dior / Chanel campaign photography
• Cinematic, atmospheric, desire-inducing, FULL FRAME
• The PRODUCT is the star — text is secondary but must be READABLE
• Premium lighting, moody atmosphere
• NO borders, NO margins, NO empty solid-color space around the image

${aspectRatio} aspect ratio.`;
  }

  /**
   * Build prompt for Perfume Model Close-up type (person holding bottle near face/neck)
   */
  buildPerfumeModelCloseupPrompt(options) {
    const {
      productName = 'Perfume',
      brandName = 'Brand',
      accentColor = 'gold',
      textColor1 = 'white',
      quote,
      modelDescription = 'person in their 30s',
      pose = 'holding bottle near neck',
      lighting = 'warm golden sidelight',
      aspectRatio = '4:5',
      targetGender = 'male'
    } = options;

    const defaultModel = targetGender === 'female'
      ? 'woman mid-30s, warm skin, subtle natural makeup, soft features'
      : targetGender === 'male'
      ? 'man late-20s to early-30s, stubble, defined jawline, confident expression'
      : 'person mid-30s, striking features, warm skin tone';

    const model = modelDescription || defaultModel;

    return `Luxury perfume ad photograph — person holding bottle. FULL BLEED — image fills the ENTIRE frame edge to edge. ${aspectRatio} aspect ratio.

⚠️ FULL BLEED IMAGE — NO BORDERS, NO MARGINS:
• The photograph fills the ENTIRE ${aspectRatio} frame from edge to edge
• NO solid colored borders or empty space
• Clean portrait photograph — person + bottle + simple out-of-focus background

COMPOSITION:
• The model and bottle should occupy about 80% of the frame — fill it well
• Crop TIGHT on the person — minimal space above the head (just a sliver)
• Simple, clean background — a blurred room, wall, or neutral space behind the person
• NOT smoke, NOT fog, NOT haze, NOT mist — just a normal blurred background
• Think: tight portrait photography — the person fills the frame confidently

THE MODEL:
${model}
• REAL skin — visible pores, natural texture, slight imperfections. NOT airbrushed.
• Expression: confident, natural, attractive
• Framed from roughly mid-chest up — face, neck, shoulders visible with background showing
• ⚠️ NO nude or topless models — if chest is visible, they must be wearing a top/shirt/blazer
• Bare shoulders are fine (off-shoulder top, strappy dress, etc.) but NO bare chest

THE POSE:
${pose}
• The person is simply HOLDING the bottle — like showing it to a friend or to a camera
• One hand holding the bottle naturally — EXACTLY 5 fingers, natural grip
• The bottle should be near the face or shoulder area but NOT pressed against skin
• This should look like a REAL photo someone would take — natural and relaxed
• ⚠️ NO weird poses: no pressing bottle to neck, no sniffing the bottle, no rubbing it on skin

PRODUCT REFERENCE — CRITICAL:
⚠️ This is an ad for "${productName}" by "${brandName}" — ONLY this product
⚠️ Use the EXACT perfume bottle from the reference image
⚠️ Match ALL bottle design: shape, cap, label, colors EXACTLY
⚠️ Bottle must be clearly recognizable even in tight crop
⚠️ Bottle should be 30-40% of the frame — person is the other star
⚠️ DO NOT reference or depict any other brand or product

LIGHTING:
${lighting}
• Clean, flattering to skin
• Creates beautiful highlights on skin and glass
• Directional — creates depth
• Think: Tom Ford, YSL ad campaigns — clean and premium

TEXT — SINGLE QUOTE AT BOTTOM:
⚠️ Font: Elegant LIGHT SERIF (Cormorant Light, Playfair Display Light, or Didot Light)
⚠️ Thin, delicate strokes. Mixed case with proper punctuation.

"${quote}"
• WHITE color with subtle drop shadow for readability
• BOTTOM 15-20% of the image
• CENTERED horizontally
• Proper curly quotation marks \u201C \u201D
• Small-medium size — elegant, not overpowering
• ⚠️ EXACTLY TWO text elements in the image — the quote and the brand logo below it

BRAND LOGO — BOTTOM CENTER:
⚠️ A second reference image (the brand's LOGO) has been provided
⚠️ Use the EXACT logo from the second reference image — do NOT recreate or redesign it
⚠️ Place the logo at the BOTTOM CENTER of the image, small and elegant
• Below the quote, near the very bottom edge
• The logo should be subtle — a refined brand watermark, not dominant
• If no second reference image is available, render "${brandName}" in elegant SERIF CAPS (tracked-out, refined, small)

STYLE:
• YSL / Tom Ford / Dior campaign photography
• Clean, premium, attractive person holding a beautiful bottle
• Shallow depth of field — background softly blurred
• NO smoke, NO fog, NO mist, NO haze — clean and clear image

SKIN REALISM — CRITICAL:
• Real skin texture, visible pores, natural skin tone variation
• NOT airbrushed or plastic — this person looks REAL
• Age-appropriate details

HAND REALISM — CRITICAL:
• EXACTLY 5 fingers
• Natural proportions, visible knuckle creases
• Proper grip on bottle

${aspectRatio} aspect ratio.`;
  }

  /**
   * Build prompt for Perfume Benefit Callout type (bold benefits + urgency, direct response)
   */
  buildPerfumeBenefitCalloutPrompt(options) {
    const {
      productName = 'Perfume',
      brandName = 'Brand',
      accentColor = 'gold',
      textColor1 = 'white',
      headline,
      benefits = [],
      cta = 'SHOP NOW',
      bgColor = 'deep charcoal',
      aspectRatio = '4:5'
    } = options;

    const benefitList = benefits.map((b, i) => `→ ${b}`).join('\n');

    return `Premium luxury perfume advertisement with benefit callouts. FULL BLEED — fills ENTIRE frame. ${aspectRatio} aspect ratio.

⚠️ FULL BLEED — NO BORDERS, NO MARGINS:
• The design fills the ENTIRE ${aspectRatio} frame from edge to edge
• Background extends to all edges

BACKGROUND — LUXURY FEEL:
• ${bgColor}
• This should feel like a high-end brand's Instagram ad — NOT a cheap Facebook ad
• Rich, deep, sophisticated. Think: Tom Ford dark ad, Chanel editorial, REFY brand aesthetic
• Subtle texture or gradient for depth — NOT flat/cheap looking
• Can include a subtle bokeh, grain, or light effect for richness

PRODUCT — THE HERO:
⚠️ Use the EXACT perfume bottle from the reference image
⚠️ Match ALL bottle design: shape, cap, label, colors EXACTLY
⚠️ Bottle positioned CENTER of the image, beautifully lit
⚠️ Bottle should be prominent — 40-50% of the frame
• LUXURY LIGHTING — dramatic sidelight, beautiful reflections on glass
• Subtle glow/rim light making the bottle look premium and desirable
• The product should look like it costs £200+ — cinematic product photography

TEXT LAYOUT — CLEAN, STRUCTURED, LUXURY:

1) HEADLINE (top 15-20%):
"${headline}"
• WHITE or CREAM — confident, elegant
• Font: ELEGANT CONDENSED typeface (like Didot, Bodoni, or refined Oswald) — NOT Impact or cheap bold fonts
• Large but refined — luxury poster energy, NOT sale banner energy
• ⚠️ Think Chanel campaign, NOT Black Friday ad

2) BENEFIT CALLOUTS (flanking the bottle):
${benefitList}
• Elegant thin lines or subtle arrows connecting to the bottle
• Benefits arranged on LEFT and RIGHT sides of the bottle
• Font: Clean LIGHT sans-serif (Montserrat Light, Futura Light, Gotham Thin) — delicate, premium
• WHITE text, small-medium size — informative but not shouting
• ⚠️ The benefits should feel like refined product details, NOT salesy bullet points
• ⚠️ Think: luxury product page info cards, NOT Amazon listing features
• 2 benefits on LEFT, 2 on RIGHT (or 2 and 1 if 3 total)

3) CTA (bottom 15%):
"${cta}"
• Elegant thin-bordered rectangle or refined underlined text — NOT a chunky button
• WHITE outline/text — subtle, confident
• Small, clean — like a luxury e-commerce CTA
• Centered horizontally

4) BRAND LOGO (very bottom):
⚠️ A second reference image (the brand's LOGO) has been provided
⚠️ Use the EXACT logo from the second reference image — do NOT recreate it
⚠️ Place small and elegant at very bottom center
• If no second reference image available, render "${brandName}" in elegant TRACKED-OUT SERIF CAPS

STYLE — THIS IS CRITICAL:
• This is a LUXURY brand ad that happens to show benefits — NOT a direct-response ad
• Think: REFY, Glossier, Byredo, Le Labo Instagram ads — premium, clean, editorial
• The typography must look EXPENSIVE — as if a luxury agency designed it
• Clean hierarchy: headline (elegant) → product (hero) → benefits (informative) → CTA (subtle)
• ⚠️ Every element should feel REFINED — no cheap fonts, no loud colors, no cluttered layout
• ⚠️ If it looks like it could be a Facebook clearance ad, you've done it wrong
• The overall energy: "This product speaks for itself. Here's why."

${aspectRatio} aspect ratio.`;
  }

  /**
   * Build prompt for Perfume Flat Lay type (top-down lifestyle product arrangement)
   */
  buildPerfumeFlatLayPrompt(options) {
    const {
      productName = 'Perfume',
      brandName = 'Brand',
      accentColor = 'gold',
      textColor1 = 'white',
      caption,
      surface = 'cream knit blanket',
      items = 'bottle with scattered dried flowers',
      mood = 'cozy morning',
      aspectRatio = '4:5',
      targetGender = 'male'
    } = options;

    return `Instagram lifestyle flat lay perfume photograph. FULL BLEED — fills ENTIRE frame. ${aspectRatio} aspect ratio.

⚠️ FULL BLEED PHOTOGRAPH — NO BORDERS, NO MARGINS:
• The photograph fills the ENTIRE ${aspectRatio} frame from edge to edge
• The surface/fabric/material extends to all edges naturally
• This is a full-frame lifestyle photo — like scrolling Instagram

CAMERA ANGLE:
• Top-down flat lay OR slight overhead angle (like looking down at a table)
• The surface fills the entire frame — we see the texture edge to edge
• Think: Instagram aesthetic flat lay, beauty blogger style

SURFACE — THE BASE:
${surface}
• The surface/material should have beautiful TEXTURE — visible weave, grain, pattern
• Fills the entire background — natural, not staged-looking
• Warm, inviting, tactile — you want to reach out and touch it

PRODUCT + ITEMS IN SCENE:
⚠️ Use the EXACT perfume bottle from the reference image
⚠️ Match ALL bottle design: shape, cap, label, colors EXACTLY
⚠️ The bottle is the HERO — positioned as the main item, slightly off-center

Other items arranged naturally around the bottle:
${items}
• Items should feel CURATED but NATURAL — like someone's real aesthetic
• Everything relates to the fragrance lifestyle — not random objects
• Casual arrangement — not perfectly symmetrical, slightly organic
• 3-5 items total including the bottle

PHOTOGRAPHY STYLE:
• Natural overhead lighting — soft, diffused, like morning window light
• Slight shadows for depth — objects feel grounded on the surface
• Warm, natural color palette
• Instagram aesthetic — beautiful, aspirational, shareable
• Mood: ${mood}
• Like a real Instagram post that would get saved and shared

TEXT — INSTAGRAM STORY STYLE CAPTION:
⚠️ Font: Casual but clean ROUNDED SANS-SERIF (Poppins, Nunito, Circular)
⚠️ The text should look like Instagram story text — clean, modern, relatable

"${caption}"
• WHITE text with subtle drop shadow or semi-transparent dark backing
• Positioned at the BOTTOM of the image — NEVER at the top
• Roughly bottom 15-20% of the frame
• Medium size — readable but not dominating
• Feels like someone typed it on their Instagram story
• ⚠️ EXACTLY ONE block of text — the caption only

BRAND NAME — SUBTLE:
"${brandName}"
• Very small, elegant, bottom corner or bottom center
• Tracked-out caps, subtle
• Like a brand tag on an Instagram post

STYLE:
• Fussy / Glossier / lifestyle brand Instagram aesthetic
• Beautiful textures, natural light, curated casual
• The photo should make someone SAVE it on Instagram
• Premium but APPROACHABLE — not cold or corporate
• Every item in frame serves the vibe

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
