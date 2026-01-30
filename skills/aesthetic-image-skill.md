# AESTHETIC IMAGE SKILL

**Status:** VALIDATED ✅  
**Last Updated:** January 29, 2026

Generate brand-matched aesthetic product photography using the product grid as reference.

---

## WORKFLOW

```
1. Product Grid exists (from Product Grid Skill)
2. Analyze brand DNA from website
3. Select appropriate direction(s)
4. System pulls angle from grid based on direction
5. Generate prompt with brand-matched surface + lighting
6. Apply all realism blocks
7. Output: Photorealistic styled product shot
```

---

## ANGLE MAPPING

| Direction | Default Angles | Why |
|-----------|---------------|-----|
| `botanical_ingredient` | front_hero, flat_lay | Front = full design visible. Flat Lay = overhead spread |
| `calm_wellness` | front_hero, 3/4_left | Front = hero. 3/4 = discovered feel |
| `lifestyle_moment` | 3/4_left, flat_lay | 3/4 = candid. Flat Lay = overhead |
| `bold_color_pop` | front_hero | Clean, graphic, design-forward |
| `texture_immersion` | 3/4_left, front_hero | 3/4 = depth against textures |

---

## BRAND-MATCHED SURFACE SELECTION

```
FOR FEMININE / NURTURING / MOTHER-FOCUSED BRANDS:
→ Light natural wood with soft grain
→ Cream linen with natural texture
→ White marble with grey veining
→ Warm honey-toned butcher block

FOR MASCULINE / RUGGED / PERFORMANCE BRANDS:
→ Dark walnut wood
→ Raw concrete
→ Black slate
→ Aged leather
→ Brushed steel

FOR LUXURY / PREMIUM / SOPHISTICATED BRANDS:
→ Dark marble with gold veining
→ Black velvet
→ Smoked glass
→ Brass accents

FOR NATURAL / ORGANIC / EARTH-FOCUSED BRANDS:
→ Raw wood with heavy grain
→ Natural stone
→ Terracotta
→ Cork

FOR CLINICAL / SCIENCE / MODERN BRANDS:
→ White corian
→ Light grey concrete
→ Frosted glass
→ Minimal white
```

---

## BRAND-MATCHED LIGHTING SELECTION

```
FOR FEMININE / NURTURING BRANDS:
→ Soft morning window light
→ Warm golden hour quality
→ Gentle shadows
→ Inviting, calm energy

FOR MASCULINE / RUGGED BRANDS:
→ Dramatic directional light
→ Hard shadows
→ High contrast
→ Bold, confident energy

FOR LUXURY / PREMIUM BRANDS:
→ Controlled studio light
→ Elegant shadow play
→ Rich and moody
→ Sophisticated energy

FOR NATURAL / ORGANIC BRANDS:
→ Soft natural daylight
→ Dappled light acceptable
→ Warm earth tones
→ Authentic, real energy

FOR CLINICAL / MODERN BRANDS:
→ Clean diffused light
→ Minimal shadows
→ Bright but not harsh
→ Professional energy
```

---

## REQUIRED REALISM BLOCKS

**Include ALL relevant blocks in every prompt:**

### PRODUCT VISIBILITY (ALWAYS REQUIRED)
```
PRODUCT VISIBILITY — CRITICAL: Product is the HERO and must be fully visible. No leaves, props, or elements overlapping or blocking ANY part of the packaging. Clear buffer zone around product. Elements frame from BEHIND and SIDES but never cross in front. Full packaging text readable.
```

### COLOR GRADE (ALWAYS REQUIRED)
```
COLOR GRADE — CRITICAL: 35mm film look. DESATURATED 15-20%. Muted earthy tones. Shadows TRUE BLACK, not lifted grey. Highlights WARM CREAM, not blown white. No glow, nothing luminous. Grain visible. Slight softness — not razor sharp digital. Greens lean yellow, reds lean brown.
```

### ASYMMETRIC COMPOSITION (ALWAYS REQUIRED)
```
ASYMMETRIC COMPOSITION — CRITICAL: Avoid balanced/symmetrical framing. MORE elements on one side than the other. Product slightly OFF-CENTER (rule of thirds). One element larger/more prominent. Documentary photography, not staged portrait.
```

### DISCOVERED NOT DISPLAYED (REQUIRED for natural scenes)
```
PRODUCT PLACEMENT — DISCOVERED NOT DISPLAYED: Product SET DOWN naturally with slight lean — not perfectly upright on pedestal. Has weight, sits INTO environment, not ON TOP like a showroom.
```

### IMPERFECTION REALISM (ALWAYS REQUIRED)
```
IMPERFECTION REALISM: One botanical with brown spot or wilted edge. Surface wear marks. One ingredient scattered "too far." Tiny debris on surface. Fabric with natural wrinkles. NOT pristine, NOT perfect.
```

### COLOR VARIATION (REQUIRED for botanicals)
```
COLOR VARIATION — CRITICAL: No two similar elements same shade. Greens: olive, yellow-green, dark forest, brown-green, grey-green — NOT uniform AI green. Botanicals: DUSTY and MUTED with brown edges, not vibrant.
```

### PLANT DAMAGE (REQUIRED for botanicals)
```
REALISTIC PLANT DAMAGE — NOT UNIFORM: Holes different sizes. Damage at EDGES, not centered. Some leaves pristine, others damaged. Natural variation.
```

### LIGHTING REALISM (ALWAYS REQUIRED)
```
LIGHTING — REAL NOT DREAMY: High contrast with true black shadows. No magical glow. Background DARKER than AI default. No rim lighting on everything. Light falls off at frame edges.
```

### NOT SECTION (ALWAYS REQUIRED — end of every prompt)
```
NOT: Symmetrical framing, centered product, clean foreground, vibrant saturated colors, HDR, glowing ingredients, luminous surfaces, uniform AI green, pristine leaves, CGI textures, magical glow, dreamy lighting, even lighting, rim lighting, fantasy aesthetic, stock photo generic.
```

---

## DIRECTION TEMPLATES

### DIRECTION 1: BOTANICAL INGREDIENT

```
Editorial product photography with botanical ingredient story.

REFERENCE IMAGE:
Use the 3x3 product grid. SELECT THE [ANGLE] (position).
CLONE exact design — do NOT modify.

BRAND-MATCHED SURFACE:
[SELECT BASED ON BRAND DNA]

BRAND-MATCHED LIGHTING:
[SELECT BASED ON BRAND DNA]

SCENE:
Product positioned off-center on [SURFACE]. Surrounded by actual botanical ingredients:
• [INGREDIENT 1] — DUSTY, imperfect
• [INGREDIENT 2] — varied colors
• [INGREDIENT 3] — natural browning
• [INGREDIENT 4] — scattered naturally
• [INGREDIENT 5] — clustered irregularly

MORE ingredients on one side. Asymmetric, organic scatter. NOT a wreath.

[ALL REALISM BLOCKS]

CAMERA:
Overhead 25°. 50mm. f/4 selective focus.

NOT: [FULL NOT SECTION]
```

---

### DIRECTION 2: CALM WELLNESS

```
Editorial wellness product photography evoking calm self-care ritual.

REFERENCE IMAGE:
Use the 3x3 product grid. SELECT THE [ANGLE] (position).
CLONE exact design — do NOT modify.

BRAND-MATCHED SURFACE:
[SELECT — marble vanity, wood shelf, stone counter]

BRAND-MATCHED LIGHTING:
[SELECT — soft bathroom light, morning window, spa-like]

SCENE:
Product placed naturally on [SURFACE]. Self-care context:
• Soft towel with natural folds (NOT steamed flat)
• Small plant or succulent — slightly dusty
• Glass of water or tea
• [BRAND-APPROPRIATE ACCENT — jewelry, candle, book]

Breathing room between elements. Minimal but warm.

[ALL REALISM BLOCKS]

CAMERA:
Eye-level to slight overhead. 35mm. f/2.8 depth.

NOT: [FULL NOT SECTION]
```

---

### DIRECTION 3: LIFESTYLE MOMENT

```
Editorial lifestyle product photography showing real-world context.

REFERENCE IMAGE:
Use the 3x3 product grid. SELECT THE [ANGLE] (position).
CLONE exact design — do NOT modify.

BRAND-MATCHED SURFACE:
[SELECT — kitchen counter, desk, bedside table]

BRAND-MATCHED LIGHTING:
[SELECT — morning kitchen, afternoon desk, evening bedroom]

SCENE:
Product on [SURFACE] during [TIME OF DAY] routine:
• [CONTEXT ITEM 1 — coffee mug, water glass, laptop edge]
• [CONTEXT ITEM 2 — fruit, notebook, phone]
• [CONTEXT ITEM 3 — napkin, glasses, book]

Product is HERO but environment tells story.

[ALL REALISM BLOCKS]

CAMERA:
Eye-level lifestyle angle. 35mm wide. f/2.8.

NOT: [FULL NOT SECTION]
```

---

### DIRECTION 4: BOLD COLOR POP

```
Editorial product photography with bold color statement.

REFERENCE IMAGE:
Use the 3x3 product grid. SELECT THE FRONT HERO ANGLE (top-left).
CLONE exact design — do NOT modify.

BRAND-MATCHED COLOR:
Extract dominant or accent color from packaging → [COLOR] as background.

SCENE:
Product standing upright on [COLOR] painted surface curving into [COLOR] backdrop. Seamless infinity curve. Minimal, graphic.

Optional single accent: One organic element (flower, ingredient) — adds life without clutter.

[REALISM BLOCKS — adjusted for minimal scene]

LIGHTING:
Strong directional from upper left. Drama. Hard shadow acceptable. Background darker at edges.

CAMERA:
Straight-on or slight angle. 85mm. f/8 sharp.

NOT: Neon digital, flat CGI, floating product, HDR oversaturated, even flat lighting, cluttered.
```

---

### DIRECTION 5: TEXTURE IMMERSION

```
Editorial product photography with rich tactile textures.

REFERENCE IMAGE:
Use the 3x3 product grid. SELECT THE [ANGLE] (position).
CLONE exact design — do NOT modify.

BRAND-MATCHED TEXTURES:
[SELECT BASED ON BRAND DNA]

FOR FEMININE: cream linen, dried eucalyptus, blush velvet, rose quartz
FOR MASCULINE: dark leather, raw wood, metal, stone
FOR LUXURY: velvet, silk, marble, brass
FOR NATURAL: raw linen, dried botanicals, cork, natural stone

SCENE:
Product nestled among layered textures. Base texture beneath, accent textures around. Depth and tactile richness.

[ALL REALISM BLOCKS]

LIGHTING:
Dramatic side light. Raking light reveals texture depth. Strong shadows. Slightly moody.

CAMERA:
Close framing. 85mm. f/2.8 selective focus.

NOT: Flat textures, uniform colors, CGI, pristine, glowing, HDR, symmetrical, even lighting.
```

---

## BRAND ANALYSIS SCHEMA

```json
{
  "brand_analysis": {
    "product_info": {
      "name": "",
      "category": "",
      "key_ingredients": [],
      "key_benefits": []
    },
    "brand_voice": {
      "tone": "aggressive | nurturing | clinical | playful | luxurious | rebellious",
      "energy": "high | calm | balanced"
    },
    "target_customer": {
      "gender": "",
      "age_range": "",
      "life_stage": "",
      "pain_points": []
    },
    "visual_identity": {
      "packaging_colors": [],
      "packaging_style": "minimal | bold | natural | clinical | luxe"
    }
  }
}
```

---

## DIRECTION MATCHING RULES

```
IF tone = "nurturing" AND has botanicals:
  → botanical_ingredient, calm_wellness, lifestyle_moment

IF tone = "aggressive" OR style = "bold":
  → bold_color_pop, texture_immersion

IF life_stage = "mom" OR "parent":
  → calm_wellness, lifestyle_moment

IF price = "premium" OR "luxury":
  → texture_immersion, bold_color_pop

IF category = "supplement" AND natural_ingredients:
  → botanical_ingredient, calm_wellness
```

---

## USAGE

1. Get product grid (Product Grid Skill)
2. Analyze brand from website URL
3. Select 3-5 directions based on brand match
4. For each direction:
   - Pull appropriate angle from grid
   - Select brand-matched surface
   - Select brand-matched lighting
   - Fill template with product-specific details
   - Include ALL realism blocks
5. Generate in Nano Banana with grid as reference
6. Review for product fidelity and realism
