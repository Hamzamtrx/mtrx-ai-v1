/**
 * Prompt Builder Service
 * 
 * Builds complete image generation prompts by:
 * 1. Loading skill template for selected direction
 * 2. Inserting product description block
 * 3. Selecting brand-matched elements (surface, lighting, persona)
 * 4. Applying all realism blocks
 * 5. Adding NOT section
 */

const fs = require('fs').promises;
const path = require('path');

class PromptBuilder {
  constructor(skillsPath = './skills') {
    this.skillsPath = skillsPath;
    this.skillCache = {};
  }

  /**
   * Build a complete prompt for image generation
   * @param {Object} options
   * @param {string} options.imageType - aesthetic, influencer, ugc, model
   * @param {string} options.direction - Specific direction within type
   * @param {Object} options.productAnalysis - Product analysis from analyzer
   * @param {string} options.productAngle - Which angle from grid to use
   * @returns {Promise<string>} - Complete prompt
   */
  async buildPrompt({ imageType, direction, productAnalysis, productAngle = 'front_hero' }) {
    // Load skill template
    const skill = await this.loadSkill(imageType, direction);

    // Get brand-matched elements
    const brandElements = this.getBrandMatchedElements(productAnalysis);

    // Build the prompt
    let prompt = '';

    // Add product description at TOP for fidelity
    prompt += this.buildProductLockBlock(productAnalysis);
    prompt += '\n\n---\n\n';

    // For aesthetic images, add brand context from website
    if (imageType === 'aesthetic') {
      prompt += this.buildBrandContextBlock(productAnalysis);
      prompt += '\n\n---\n\n';
    }

    // Add product-specific handling instructions (how to hold, scale, etc.)
    prompt += this.getProductHandlingInstructions(productAnalysis, imageType, direction);
    prompt += '\n\n';

    // Add main skill template
    prompt += skill.template;

    // Replace placeholders
    prompt = this.replacePlaceholders(prompt, {
      ...productAnalysis,
      ...brandElements,
      productAngle,
      direction
    });

    // Transform template for target gender
    const targetGender = productAnalysis.brand_voice?.target_gender || 'female';
    if (targetGender === 'male') {
      prompt = this.transformForMale(prompt, productAnalysis);
    }

    // Add realism blocks
    prompt += '\n\n' + this.getRequiredRealismBlocks(imageType);

    // Add NOT section with gender and category awareness
    const category = productAnalysis.product_info?.category || 'general';
    prompt += '\n\n' + this.getNotSection(imageType, direction, targetGender, category);

    return prompt;
  }

  /**
   * Build brand context block for aesthetic images
   * @param {Object} analysis - Product analysis
   * @returns {string} - Brand context block
   */
  buildBrandContextBlock(analysis) {
    const targetGender = analysis.brand_voice?.target_gender || 'female';
    const parts = ['BRAND CONTEXT (from website analysis):'];

    // CRITICAL: Gender-specific styling
    if (targetGender === 'male') {
      parts.push(`🎯 MASCULINE STYLING REQUIRED:`);
      parts.push(`- Dark, moody, sophisticated color palette`);
      parts.push(`- Rugged textures: wood, leather, stone, metal`);
      parts.push(`- Strong directional lighting with deep shadows`);
      parts.push(`- NO soft/feminine elements, NO pastel colors, NO flowers`);
    } else {
      parts.push(`🎯 FEMININE STYLING:`);
      parts.push(`- Soft, warm, inviting color palette`);
      parts.push(`- Delicate textures: linen, marble, botanicals`);
      parts.push(`- Soft diffused lighting, gentle shadows`);
    }

    // Add key ingredients if available
    if (analysis.product_info?.key_ingredients?.length > 0) {
      const ingredients = analysis.product_info.key_ingredients.slice(0, 5).join(', ');
      parts.push(`Key Ingredients: ${ingredients}`);
      if (targetGender === 'male') {
        parts.push(`→ Show masculine interpretations: dark wood, amber, leather, spices, raw materials`);
      } else {
        parts.push(`→ Include visual elements: raw botanicals, herbs, natural elements`);
      }
    }

    // Add benefits if available
    if (analysis.product_info?.key_benefits?.length > 0) {
      const benefits = analysis.product_info.key_benefits.slice(0, 3).join(', ');
      parts.push(`Product Benefits: ${benefits}`);
    }

    // Add brand voice context
    if (analysis.brand_voice) {
      const { tone, energy, target_gender, target_age } = analysis.brand_voice;
      parts.push(`Brand Tone: ${tone} | Energy: ${energy} | Target: ${target_gender}, age ${target_age}`);
    }

    // Add category-specific styling hints adjusted for gender
    const category = analysis.product_info?.category || 'general';
    if (category === 'fashion') {
      parts.push(`🎽 FASHION/APPAREL STYLING:`);
      parts.push(`- This is CLOTHING - must be WORN by model or shown as flat lay`);
      parts.push(`- Brand logo/design must be accurate and visible`);
      parts.push(`- DO NOT treat like a handheld product`);
      if (targetGender === 'male') {
        parts.push(`- Masculine streetwear/casual aesthetic`);
        parts.push(`- Urban, confident, lifestyle settings`);
      } else {
        parts.push(`- Fashion-forward, stylish aesthetic`);
        parts.push(`- Lifestyle, aspirational settings`);
      }
    } else if (targetGender === 'male') {
      if (category === 'fragrance' || category === 'perfume') {
        parts.push(`Style: Masculine fragrance aesthetic - dark moody lighting, leather/wood props, sophisticated`);
      } else if (category === 'skincare') {
        parts.push(`Style: Men's grooming aesthetic - clean, minimal, dark tones, bathroom/gym setting`);
      } else {
        parts.push(`Style: Masculine aesthetic - bold, confident, dark sophisticated tones`);
      }
    } else {
      if (category === 'supplement') {
        parts.push(`Style: Natural wellness aesthetic with raw ingredients, earth tones, morning light`);
      } else if (category === 'skincare') {
        parts.push(`Style: Clean beauty aesthetic with soft textures, dewdrops, fresh botanicals`);
      } else if (category === 'fitness') {
        parts.push(`Style: Active lifestyle aesthetic with dynamic energy`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Load skill file and parse template
   * @param {string} imageType 
   * @param {string} direction 
   * @returns {Promise<Object>}
   */
  async loadSkill(imageType, direction) {
    const cacheKey = `${imageType}_${direction}`;
    
    if (this.skillCache[cacheKey]) {
      return this.skillCache[cacheKey];
    }

    const skillFiles = {
      aesthetic: 'aesthetic-image-skill.md',
      influencer: 'influencer-image-skill.md',
      ugc: 'ugc-influencer-skill.md',
      model: 'model-closeup-skill.md',
      model_closeup: 'model-closeup-skill.md',
      model_lifestyle: 'model-lifestyle-skill.md',
      model_couple: 'model-couple-skill.md'
    };

    const skillFile = skillFiles[imageType] || skillFiles.aesthetic;

    const filePath = path.join(this.skillsPath, skillFile);
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Parse out the relevant direction template
    const template = this.extractDirectionTemplate(content, direction);
    
    const skill = { template, rawContent: content };
    this.skillCache[cacheKey] = skill;
    
    return skill;
  }

  /**
   * Extract specific direction template from skill file
   * @param {string} content - Full skill file content
   * @param {string} direction - Direction to extract
   * @returns {string} - Template text
   */
  extractDirectionTemplate(content, direction) {
    // Look for direction header and extract template block
    const directionPatterns = {
      botanical_ingredient: /### DIRECTION 1: BOTANICAL INGREDIENT\n\n```\n([\s\S]*?)```/,
      calm_wellness: /### DIRECTION 2: CALM WELLNESS\n\n```\n([\s\S]*?)```/,
      lifestyle_moment: /### DIRECTION 3: LIFESTYLE MOMENT\n\n```\n([\s\S]*?)```/,
      bold_color_pop: /### DIRECTION 4: BOLD COLOR POP\n\n```\n([\s\S]*?)```/,
      texture_immersion: /### DIRECTION 5: TEXTURE IMMERSION\n\n```\n([\s\S]*?)```/,
      hand_holding: /### DIRECTION 1: HAND HOLDING\n\n```\n([\s\S]*?)```/,
      presenting_to_camera: /### DIRECTION 2: PRESENTING TO CAMERA\n\n```\n([\s\S]*?)```/,
      product_in_scene: /### DIRECTION 3: PRODUCT IN SCENE\n\n```\n([\s\S]*?)```/,
      using_product: /### DIRECTION 4: USING PRODUCT\n\n```\n([\s\S]*?)```/,
      selfie_with_product: /### DIRECTION 5: SELFIE WITH PRODUCT\n\n```\n([\s\S]*?)```/,
      bedroom_selfie: /### SETTING A: BEDROOM SELFIE.*?\n\n```\n([\s\S]*?)```/,
      car_selfie: /### SETTING B: CAR SELFIE.*?\n\n```\n([\s\S]*?)```/,
      gym_selfie: /### SETTING C: GYM SELFIE.*?\n\n```\n([\s\S]*?)```/,
      bathroom_mirror: /### SETTING D: BATHROOM MIRROR.*?\n\n```\n([\s\S]*?)```/,
      kitchen_counter: /### SETTING E: KITCHEN COUNTER.*?\n\n```\n([\s\S]*?)```/,
      closeup_warm: /## TEMPLATE: CLOSE-UP \(WARM.*?\n\n```\n([\s\S]*?)```/,
      closeup_confident: /## TEMPLATE: CLOSE-UP \(CONFIDENT.*?\n\n```\n([\s\S]*?)```/
    };

    const pattern = directionPatterns[direction];
    if (!pattern) {
      console.warn(`No pattern found for direction: ${direction}`);
      return content;
    }

    const match = content.match(pattern);
    return match ? match[1] : content;
  }

  /**
   * Get brand-matched elements based on product analysis
   * @param {Object} analysis - Product analysis
   * @returns {Object} - Matched elements
   */
  getBrandMatchedElements(analysis) {
    const tone = analysis.brand_voice?.tone || 'nurturing';
    const targetGender = analysis.brand_voice?.target_gender || 'female';
    const targetAge = analysis.brand_voice?.target_age || '25-45';
    const elements = {};

    // Store gender for use in prompts
    elements.targetGender = targetGender;
    elements.targetAge = targetAge;

    // Surface matching - adjust for gender
    const surfaceMap = {
      male: {
        default: 'Dark walnut wood or slate stone',
        luxurious: 'Dark marble with subtle veining, black stone',
        natural: 'Raw weathered wood, concrete',
        clinical: 'Brushed metal, dark gray surface'
      },
      female: {
        default: 'Light natural wood with soft grain',
        luxurious: 'White marble with gold veining',
        natural: 'Cream linen with natural texture',
        clinical: 'White corian, clean surfaces'
      }
    };
    const genderSurfaces = surfaceMap[targetGender] || surfaceMap.female;
    elements.surface = genderSurfaces[tone] || genderSurfaces.default;

    // Lighting matching - adjust for gender
    const lightingMap = {
      male: {
        default: 'Dramatic directional light, hard shadows, moody and cinematic',
        luxurious: 'Controlled studio light, rich shadows, sophisticated',
        natural: 'Strong natural light, high contrast',
        clinical: 'Clean directional light, sharp shadows'
      },
      female: {
        default: 'Soft morning window light, warm golden hour quality, gentle shadows',
        luxurious: 'Elegant studio light, soft shadow play',
        natural: 'Soft natural daylight, warm inviting tones',
        clinical: 'Clean diffused light, minimal shadows'
      }
    };
    const genderLighting = lightingMap[targetGender] || lightingMap.female;
    elements.lighting = genderLighting[tone] || genderLighting.default;

    // Persona matching - CRITICAL: must match target gender
    if (targetGender === 'male') {
      const malePersonas = {
        nurturing: `Man, ${targetAge}, well-groomed, warm confident smile, approachable dad energy`,
        luxurious: `Man, ${targetAge}, refined, sharp jawline, subtle confidence, sophisticated`,
        natural: `Man, ${targetAge}, rugged handsome, light stubble, outdoorsy vibe`,
        aggressive: `Man, ${targetAge}, athletic muscular build, intense focused expression`,
        rebellious: `Man, ${targetAge}, edgy style, confident smirk, bold presence`,
        default: `Man, ${targetAge}, attractive, well-groomed, masculine features, confident expression`
      };
      elements.persona = malePersonas[tone] || malePersonas.default;
    } else {
      const femalePersonas = {
        nurturing: `Woman, ${targetAge}, warm natural makeup, soft smile, relatable mom energy`,
        luxurious: `Woman, ${targetAge}, refined elegant, subtle elegance, understated confidence`,
        natural: `Woman, ${targetAge}, healthy glow, calm centered expression, minimal makeup`,
        aggressive: `Woman, ${targetAge}, athletic toned, fierce confident expression`,
        rebellious: `Woman, ${targetAge}, edgy bold style, confident attitude`,
        default: `Woman, ${targetAge}, glowing skin, approachable, aspirational but real`
      };
      elements.persona = femalePersonas[tone] || femalePersonas.default;
    }

    // Setting matching - adjust for gender
    const settingMap = {
      male: {
        default: 'Modern bathroom with dark tiles, masculine space',
        luxurious: 'Upscale hotel bathroom, dark sophisticated interior',
        natural: 'Outdoor setting or rustic cabin',
        clinical: 'Clean modern gym or bathroom'
      },
      female: {
        default: 'Bright bathroom vanity, clean aesthetic',
        luxurious: 'Elegant minimal interior, spa-like',
        natural: 'Bright airy space with plants',
        clinical: 'Clean white bathroom, minimal'
      }
    };
    const genderSettings = settingMap[targetGender] || settingMap.female;
    elements.setting = genderSettings[tone] || genderSettings.default;

    return elements;
  }

  /**
   * Build product lock block for fidelity
   * @param {Object} analysis - Product analysis
   * @returns {string} - Product lock block
   */
  buildProductLockBlock(analysis) {
    const targetGender = analysis.brand_voice?.target_gender || 'female';
    const category = analysis.product_info?.category || 'general';
    const genderText = targetGender === 'male' ? 'MAN/MALE' : 'WOMAN/FEMALE';
    const genderDescription = targetGender === 'male'
      ? 'This is a MENS product - use MALE models only, masculine styling, rugged/sophisticated aesthetic'
      : 'This is a WOMENS product - use FEMALE models only, feminine styling';

    // Fashion-specific product lock
    if (category === 'fashion') {
      return `⚠️ CRITICAL INSTRUCTIONS — FASHION/APPAREL ⚠️

THE GARMENT IN THIS IMAGE MUST BE: ${analysis.product_info.brand} ${analysis.product_info.product_name}

🎽 THIS IS CLOTHING — SPECIAL HANDLING REQUIRED:
• The garment must be WORN by a model OR displayed as a flat lay
• DO NOT show someone holding the garment like a bottle/product
• The EXACT logo, design, and colors from the reference must appear on the garment

🎯 TARGET AUDIENCE: ${genderText}
${genderDescription}
Any model wearing this garment MUST be ${targetGender === 'male' ? 'a MAN (male)' : 'a WOMAN (female)'}.

GARMENT APPEARANCE (COPY EXACTLY FROM REFERENCE IMAGE):
${analysis.product_description_block}

🚨 MANDATORY RULES FOR FASHION:
1. The garment design MUST match the reference image EXACTLY
2. The brand logo "${analysis.product_info.brand}" must be visible and accurate
3. Copy the EXACT colors, graphics, and text from the reference
4. If model is shown, they must be WEARING the garment - NOT holding it
5. For flat lay: garment laid out neatly showing the design
6. The logo position and size must match the reference

⛔ FORBIDDEN FOR FASHION:
- Person holding shirt/garment like a product bottle
- Wrong logo or brand name on the garment
- Different design than the reference
- Garment being presented/shown to camera (not worn)
- PQ7, supplement pouches, water bottles, or ANY non-clothing product
- ${targetGender === 'male' ? 'Female models - this is MENS clothing' : 'Male models - this is WOMENS clothing'}

⚠️ IGNORE any example products mentioned elsewhere (PQ7, supplements, etc.)
ONLY show the GARMENT from the reference image.

The reference image shows the ONLY acceptable garment design. REPLICATE IT EXACTLY.`;
    }

    // Standard product lock for non-fashion
    return `⚠️ CRITICAL INSTRUCTIONS — MUST FOLLOW EXACTLY ⚠️

THE PRODUCT IN THIS IMAGE MUST BE: ${analysis.product_info.brand} ${analysis.product_info.product_name}

🎯 TARGET AUDIENCE: ${genderText}
${genderDescription}
Any person in this image MUST be ${targetGender === 'male' ? 'a MAN (male)' : 'a WOMAN (female)'}.

PRODUCT APPEARANCE (COPY EXACTLY FROM REFERENCE IMAGE):
${analysis.product_description_block}

🚨 MANDATORY RULES:
1. The product shown MUST match the reference image EXACTLY
2. Copy the EXACT brand name, logo, colors, and packaging design
3. DO NOT substitute with any other product brand
4. DO NOT use generic or different packaging
5. The text "${analysis.product_info.brand}" MUST be visible and readable on the product
6. Match the exact color scheme from the reference
7. If showing a person, they MUST be ${targetGender === 'male' ? 'MALE' : 'FEMALE'}

⛔ FORBIDDEN — NEVER SHOW THESE:
- PQ7, Primal Queen, or any supplement pouch (unless that's what the reference shows)
- Evian, Fiji, or any water bottle brand (unless that's what the reference shows)
- BYOMA, CeraVe, The Ordinary, or ANY brand not in the reference
- Any product that doesn't match the reference image
- ${targetGender === 'male' ? 'Do NOT show women/females - this is a MENS product' : 'Do NOT show men/males - this is a WOMENS product'}

⚠️ IGNORE any example products mentioned elsewhere in this prompt (like PQ7, supplement pouches, etc.)
ONLY use the reference image as your product guide.

The reference image shows the ONLY acceptable product design. CLONE IT EXACTLY.`;
  }

  /**
   * Replace template placeholders with actual values
   * @param {string} template - Template text
   * @param {Object} values - Values to insert
   * @returns {string} - Filled template
   */
  replacePlaceholders(template, values) {
    let result = template;

    // Replace [BRACKETED] placeholders
    result = result.replace(/\[SURFACE\]/g, values.surface || '');
    result = result.replace(/\[LIGHTING\]/g, values.lighting || '');
    result = result.replace(/\[PERSONA\]/g, values.persona || '');
    result = result.replace(/\[SETTING\]/g, values.setting || '');
    result = result.replace(/\[ANGLE\]/g, values.productAngle || 'front_hero');
    result = result.replace(/\[PRODUCT\]/g, values.product_description_block || '');
    result = result.replace(/\[BRAND\]/g, values.product_info?.brand || '');
    result = result.replace(/\[PRODUCT_NAME\]/g, values.product_info?.product_name || '');

    // Replace ingredients
    if (values.product_info?.key_ingredients?.length > 0) {
      values.product_info.key_ingredients.forEach((ing, i) => {
        result = result.replace(new RegExp(`\\[INGREDIENT ${i + 1}\\]`, 'g'), ing);
      });
    }

    return result;
  }

  /**
   * Get required realism blocks based on image type
   * @param {string} imageType 
   * @returns {string} - Realism blocks
   */
  getRequiredRealismBlocks(imageType) {
    const blocks = [];

    // Product fidelity - always required
    blocks.push(`PRODUCT FIDELITY — ABSOLUTELY CRITICAL:
• Product MUST be identical to reference image - no substitutions
• Brand name and logo must match reference EXACTLY
• Package colors, graphics, text must be copied precisely
• DO NOT use any other brand's packaging design
• If you cannot replicate the exact product, the image fails
• Product scale realistic and prominent in frame`);

    // Person-specific blocks
    if (['influencer', 'ugc', 'model'].includes(imageType)) {
      blocks.push(`SKIN REALISM — CRITICAL:
• Real skin texture, visible pores on nose, forehead, cheeks
• NOT airbrushed or plastic smooth
• Natural skin tone variation
• Age-appropriate details (smile lines, expression lines)
• Like unedited iPhone photo of real person`);

      blocks.push(`HAND REALISM — CRITICAL:
• EXACTLY 5 fingers per hand
• Natural proportions and finger lengths
• Visible knuckle creases and skin texture
• Natural nail beds
• Proper grip — fingers wrap naturally around product`);
    }

    // Aesthetic-specific blocks
    if (imageType === 'aesthetic') {
      blocks.push(`ASYMMETRIC COMPOSITION — CRITICAL:
• MORE elements on one side than the other
• Product slightly OFF-CENTER (rule of thirds)
• Documentary photography, not staged portrait`);

      blocks.push(`IMPERFECTION REALISM:
• One botanical with brown spot or wilted edge
• Surface wear marks acceptable
• Tiny debris on surface
• NOT pristine, NOT perfect`);
    }

    return blocks.join('\n\n');
  }

  /**
   * Get product-specific handling instructions
   * @param {Object} analysis - Product analysis
   * @param {string} imageType - Type of image
   * @param {string} direction - Direction
   * @returns {string} - Handling instructions
   */
  /**
   * Transform template for male target audience
   * @param {string} prompt - Original prompt
   * @param {Object} analysis - Product analysis
   * @returns {string} - Transformed prompt
   */
  transformForMale(prompt, analysis) {
    const targetAge = analysis.brand_voice?.target_age || '25-45';

    // Replace female-specific terms with male equivalents
    let transformed = prompt;

    // Model descriptions
    transformed = transformed.replace(/Woman, early 30s/gi, `Man, ${targetAge}`);
    transformed = transformed.replace(/Woman, late 20s/gi, `Man, ${targetAge}`);
    transformed = transformed.replace(/Woman,/gi, 'Man,');
    transformed = transformed.replace(/woman/gi, 'man');
    transformed = transformed.replace(/female/gi, 'male');
    transformed = transformed.replace(/feminine/gi, 'masculine');
    transformed = transformed.replace(/her face/gi, 'his face');
    transformed = transformed.replace(/her hair/gi, 'his hair');
    transformed = transformed.replace(/her skin/gi, 'his skin');

    // Appearance
    transformed = transformed.replace(/natural makeup/gi, 'clean-shaven or light stubble');
    transformed = transformed.replace(/groomed brows/gi, 'natural masculine brows');
    transformed = transformed.replace(/natural lip color/gi, 'natural lips');
    transformed = transformed.replace(/healthy glow/gi, 'healthy masculine complexion');
    transformed = transformed.replace(/radiant complexion/gi, 'strong masculine features');

    // Clothing
    transformed = transformed.replace(/cream knit sweater/gi, 'dark henley shirt or dark sweater');
    transformed = transformed.replace(/knit sweater/gi, 'dark sweater or shirt');

    // Hands
    transformed = transformed.replace(/natural feminine hand/gi, 'masculine hand with natural nails');
    transformed = transformed.replace(/feminine hand/gi, 'masculine hand');
    transformed = transformed.replace(/elegant feminine/gi, 'confident masculine');
    transformed = transformed.replace(/polished nails/gi, 'clean short nails');

    // Background and lighting for male
    transformed = transformed.replace(/Warm beige seamless studio backdrop/gi, 'Dark gray or charcoal seamless studio backdrop');
    transformed = transformed.replace(/warm beige/gi, 'dark charcoal');
    transformed = transformed.replace(/Warm tone — inviting/gi, 'Moody dramatic — sophisticated');
    transformed = transformed.replace(/cream/gi, 'dark');
    transformed = transformed.replace(/pastel/gi, 'dark');
    transformed = transformed.replace(/pink/gi, 'charcoal');

    // Expression adjustments
    transformed = transformed.replace(/warm "I'm happy to share this with you" smile/gi, 'confident subtle smile');
    transformed = transformed.replace(/warm confidence/gi, 'quiet masculine confidence');

    return transformed;
  }

  /**
   * Get product-specific handling instructions
   * @param {Object} analysis - Product analysis
   * @param {string} imageType - Type of image
   * @param {string} direction - Direction
   * @returns {string} - Handling instructions
   */
  getProductHandlingInstructions(analysis, imageType, direction) {
    const category = analysis.product_info?.category || 'general';
    const targetGender = analysis.brand_voice?.target_gender || 'female';
    const instructions = [];

    // Product scale instructions
    instructions.push(`PRODUCT SCALE — CRITICAL:`);
    instructions.push(`• Product must be REALISTIC SIZE relative to hand/body`);
    instructions.push(`• NOT oversized, NOT miniature`);

    // Category-specific holding instructions
    if (category === 'fragrance' || category === 'perfume') {
      instructions.push(`\nFRAGRANCE/PERFUME HANDLING — CRITICAL:`);
      instructions.push(`• Hold bottle with ONE hand only in classic perfume pose`);
      instructions.push(`• CORRECT GRIP: Bottle held between thumb and fingers, index finger near or on spray nozzle`);
      instructions.push(`• Palm facing slightly toward camera, bottle upright`);
      instructions.push(`• Fingers elegantly positioned - NOT gripping like a water bottle`);
      instructions.push(`• Alternative: Bottle resting on open palm, fingers gently curved around it`);
      instructions.push(`• Show the label/brand name facing camera`);
      instructions.push(`• Bottle size: realistic perfume (50-100ml = 10-15cm tall)`);
      instructions.push(`• NOT two hands, NOT cupped like holding a small animal`);
      instructions.push(`• NOT holding by the cap, NOT hiding the label`);

      if (targetGender === 'male') {
        instructions.push(`\nMALE FRAGRANCE STYLING:`);
        instructions.push(`• Confident, refined grip - sophisticated not casual`);
        instructions.push(`• Strong masculine hand with visible tendons/definition`);
        instructions.push(`• Dark/moody background: charcoal gray, black, deep navy, dark wood`);
        instructions.push(`• NOT bright backgrounds, NOT pastel, NOT white`);
        instructions.push(`• Dramatic side lighting creating depth and shadow`);
      } else {
        instructions.push(`\nFEMALE FRAGRANCE STYLING:`);
        instructions.push(`• Elegant, delicate grip`);
        instructions.push(`• Graceful feminine hand positioning`);
      }
    } else if (category === 'fashion') {
      // FASHION/APPAREL - completely different approach
      instructions.push(`\n🎽 FASHION/APPAREL — CRITICAL DIFFERENT APPROACH:`);
      instructions.push(`• This is CLOTHING - it must be WORN or displayed as a flat lay`);
      instructions.push(`• DO NOT hold clothing like a product bottle`);
      instructions.push(`• The BRAND LOGO must be visible and accurate`);
      instructions.push(`\n📍 LOGO PLACEMENT — CRITICAL:`);
      instructions.push(`• Logo is on the LEFT CHEST (wearer's left side)`);
      instructions.push(`• When viewing the image: logo appears on VIEWER'S RIGHT side`);
      instructions.push(`• For flat lay: logo on the RIGHT side of the shirt as you look at it`);
      instructions.push(`• This is standard t-shirt logo placement - LEFT breast pocket area`);

      if (imageType === 'aesthetic') {
        instructions.push(`\nFASHION AESTHETIC (FLAT LAY):`);
        instructions.push(`• Show garment as FLAT LAY on styled surface`);
        instructions.push(`• Garment laid flat, neatly arranged, visible logo/design`);
        instructions.push(`• Style with complementary props: sunglasses, watch, shoes, coffee`);
        instructions.push(`• Surface: wood table, concrete, fabric backdrop`);
        instructions.push(`• Bird's eye view or slight angle`);
        instructions.push(`• NO person in shot - just the garment styled`);
      } else if (imageType === 'influencer' || imageType === 'ugc') {
        instructions.push(`\nFASHION INFLUENCER/UGC (WORN):`);
        instructions.push(`• Person must be WEARING the garment`);
        instructions.push(`• NOT holding it, NOT showing it to camera like a bottle`);
        instructions.push(`• Full outfit visible or upper body showing the garment`);
        instructions.push(`• Natural pose: standing, walking, sitting casually`);
        instructions.push(`• Brand logo/design clearly visible on the garment being worn`);
        instructions.push(`• SINGLE PERSON in frame - no mirror reflections showing second person`);
        instructions.push(`• LOGO MUST READ CORRECTLY (left-to-right) - NOT mirrored/backwards`);
        instructions.push(`• Even if selfie style, the logo text should be readable and correct`);
        instructions.push(`• Prefer front-facing camera angle over mirror reflection`);
      } else if (imageType === 'model') {
        if (direction.includes('closeup')) {
          instructions.push(`\nFASHION CLOSE-UP (GARMENT DETAIL):`);
          instructions.push(`• Focus on GARMENT DETAILS - NOT face with held product`);
          instructions.push(`• Show: fabric texture, logo detail, stitching quality`);
          instructions.push(`• Close-up of the shirt/garment being worn on body`);
          instructions.push(`• Chest/torso area showing the design and logo`);
          instructions.push(`• Can include part of face/neck but focus is the GARMENT`);
          instructions.push(`• NOT a person holding up a shirt to camera`);
        } else {
          instructions.push(`\nFASHION MODEL (LIFESTYLE WORN):`);
          instructions.push(`• Person WEARING the garment in lifestyle setting`);
          instructions.push(`• Full body or 3/4 shot showing the outfit`);
          instructions.push(`• Natural pose in context: urban street, gym, cafe`);
          instructions.push(`• Logo/brand visible on the worn garment`);
        }
      }

      instructions.push(`\n⛔ FASHION FORBIDDEN:`);
      instructions.push(`• DO NOT show person holding shirt like holding a bottle`);
      instructions.push(`• DO NOT show person holding up garment to camera`);
      instructions.push(`• DO NOT show folded garment being presented`);
      instructions.push(`• DO NOT show wrong brand/logo on the garment`);
      instructions.push(`• The garment must be WORN or laid flat - NEVER held`);
      instructions.push(`• NO mirror reflections showing duplicate/second person`);
      instructions.push(`• SINGLE PERSON ONLY in frame - no reflections, no doubles`);
      instructions.push(`• Logo must NOT be mirrored/reversed - text reads correctly left-to-right`);
      instructions.push(`• Logo position: typically LEFT CHEST area, facing forward`);
      instructions.push(`• If mirror selfie, the LOGO should still read correctly (not backwards)`);

    } else if (category === 'skincare') {
      instructions.push(`\nSKINCARE HANDLING:`);
      instructions.push(`• Hold product naturally in one hand`);
      instructions.push(`• Product size should match typical skincare (5-10cm)`);
      instructions.push(`• Label facing camera`);
    } else if (category === 'supplement') {
      instructions.push(`\nSUPPLEMENT HANDLING:`);
      instructions.push(`• Hold pouch/bottle naturally`);
      instructions.push(`• Show brand name prominently`);
      instructions.push(`• Realistic supplement packaging size`);
    }

    // Direction-specific instructions
    if (direction === 'hand_holding') {
      instructions.push(`\nHAND HOLDING SPECIFIC:`);
      instructions.push(`• Single hand holding product`);
      instructions.push(`• EXACTLY 5 fingers visible`);
      instructions.push(`• Natural grip, not posed awkwardly`);
    }

    if (direction === 'bedroom_selfie' || direction === 'car_selfie') {
      instructions.push(`\nSELFIE SPECIFIC:`);
      instructions.push(`• ONE hand holding product, other hand holding phone (implied)`);
      instructions.push(`• Natural casual pose`);
      instructions.push(`• Product at realistic distance from camera`);
    }

    if (direction.includes('closeup')) {
      if (targetGender === 'male') {
        instructions.push(`\nMALE CLOSEUP SPECIFIC:`);
        instructions.push(`• Background: dark/moody (NOT pink, NOT pastel, NOT bright)`);
        instructions.push(`• Colors: deep blues, grays, blacks, earth tones`);
        instructions.push(`• Lighting: dramatic, directional shadows`);
        instructions.push(`• Expression: confident, subtle, masculine`);
      }
    }

    return instructions.join('\n');
  }

  /**
   * Get NOT section for prompt
   * @param {string} imageType
   * @param {string} direction
   * @param {string} targetGender
   * @param {string} category
   * @returns {string} - NOT section
   */
  getNotSection(imageType, direction, targetGender = 'female', category = 'general') {
    const commonNots = [
      'symmetrical framing',
      'centered product',
      'vibrant saturated colors',
      'HDR',
      'CGI textures',
      'magical glow',
      'dreamy lighting',
      'stock photo generic',
      'wrong product',
      'different brand',
      'oversized product',
      'tiny product'
    ];

    const personNots = [
      'airbrushed skin',
      'plastic texture',
      'extra fingers',
      'floating hands',
      'dead eyes',
      'uncanny valley',
      'two hands holding product (use one hand)',
      'wrong number of fingers'
    ];

    const aestheticNots = [
      'luminous surfaces',
      'uniform AI green',
      'pristine leaves',
      'fantasy aesthetic'
    ];

    const fashionNots = [
      'person holding shirt like a bottle',
      'holding garment up to camera',
      'folded clothing being presented',
      'wrong logo on garment',
      'different brand name on clothing',
      'treating clothing like a handheld product',
      'mirrored/reversed logo text',
      'backwards text on garment',
      'mirror reflection showing two people',
      'duplicate person in reflection',
      'double heads'
    ];

    const maleNots = [
      'female model',
      'woman',
      'pink background',
      'pastel colors',
      'feminine styling',
      'soft romantic lighting',
      'flowers',
      'floral elements'
    ];

    const femaleNots = [
      'male model',
      'man',
      'masculine styling'
    ];

    let nots = [...commonNots];

    if (['influencer', 'ugc', 'model'].includes(imageType)) {
      nots = [...nots, ...personNots];
      if (targetGender === 'male') {
        nots = [...nots, ...maleNots];
      } else {
        nots = [...nots, ...femaleNots];
      }
    }

    if (imageType === 'aesthetic') {
      nots = [...nots, ...aestheticNots];
      if (targetGender === 'male') {
        nots.push('feminine styling', 'pink', 'pastel', 'flowers', 'soft lighting');
      }
    }

    // Add fashion-specific NOTs
    if (category === 'fashion') {
      nots = [...nots, ...fashionNots];
    }

    return `NOT: ${nots.join(', ')}.`;
  }
}

module.exports = PromptBuilder;
