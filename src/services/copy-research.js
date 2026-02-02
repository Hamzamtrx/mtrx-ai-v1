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
