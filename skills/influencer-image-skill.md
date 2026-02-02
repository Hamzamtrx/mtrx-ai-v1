# INFLUENCER IMAGE SKILL

**Status:** IN DEVELOPMENT 🔄  
**Last Updated:** January 29, 2026

Generate realistic influencer-style product photography — product held by or near a person.

---

## WORKFLOW

```
1. Product Grid exists (from Product Grid Skill)
2. Analyze brand DNA from website
3. Select influencer direction
4. System pulls appropriate angle from grid
5. Generate prompt with brand-matched persona + setting
6. Apply all realism blocks (person-specific)
7. Output: Realistic UGC-style product shot
```

---

## INFLUENCER DIRECTIONS

| Direction | Description | Best Angles | Use Case |
|-----------|-------------|-------------|----------|
| `hand_holding` | Hand holding product, product is hero | side_profile, 3/4_left | Close-up product focus |
| `presenting_to_camera` | Person showing product to viewer | front_hero, 3/4_left | Direct recommendation |
| `product_in_scene` | Product on surface, person soft in BG | flat_lay, 3/4_left | Lifestyle context |
| `using_product` | Person actively using/taking product | front_hero, 3/4_left | Demonstration |
| `selfie_with_product` | Selfie-style, person + product | front_hero | Social proof |

---

## ANGLE MAPPING

| Direction | Default Angles | Why |
|-----------|---------------|-----|
| `hand_holding` | side_profile, 3/4_left | Fits naturally in hand grip |
| `presenting_to_camera` | front_hero, 3/4_left | Person showing product face to viewer |
| `product_in_scene` | flat_lay, 3/4_left | Natural placement on surface |
| `using_product` | front_hero, 3/4_left | Clear view of product during use |
| `selfie_with_product` | front_hero | Product next to face |

---

## BRAND-MATCHED PERSONA SELECTION

```
FOR FEMININE / NURTURING / MOM BRANDS:
→ Woman, 28-40, warm natural makeup
→ Soft smile, relatable "real mom" energy
→ Casual but put-together (soft sweater, minimal jewelry)
→ Natural hair, not overly styled

FOR MASCULINE / PERFORMANCE BRANDS:
→ Man, 25-45, athletic or rugged
→ Confident expression, direct eye contact
→ Active wear or casual masculine (henley, simple tee)
→ Natural stubble acceptable

FOR LUXURY / PREMIUM BRANDS:
→ Woman or man, 30-50, refined
→ Subtle elegance, understated confidence
→ Elevated casual (cashmere, quality fabrics)
→ Polished but not overdone

FOR YOUNG / TRENDY BRANDS:
→ Woman or man, 20-30, contemporary
→ Authentic, approachable energy
→ Current casual style (oversized, minimal)
→ Natural, effortless look

FOR WELLNESS / NATURAL BRANDS:
→ Woman, 25-45, healthy glow
→ Calm, centered expression
→ Athleisure or soft naturals
→ Minimal makeup, dewy skin
```

---

## BRAND-MATCHED SETTING SELECTION

```
FOR FEMININE / MOM BRANDS:
→ Bright kitchen, morning light
→ Cozy living room corner
→ Clean bathroom vanity
→ Bedroom morning routine

FOR MASCULINE / PERFORMANCE BRANDS:
→ Gym or home workout space
→ Kitchen (meal prep context)
→ Outdoor/nature setting
→ Simple neutral background

FOR LUXURY / PREMIUM BRANDS:
→ Elegant minimal interior
→ High-end bathroom
→ Sophisticated neutral space
→ Clean architectural background

FOR WELLNESS / NATURAL BRANDS:
→ Bright airy space with plants
→ Yoga/meditation corner
→ Natural light bathroom
→ Outdoor soft background
```

---

## REQUIRED REALISM BLOCKS (PERSON-SPECIFIC)

### SKIN REALISM (CRITICAL)
```
SKIN REALISM — CRITICAL: Real human skin, NOT airbrushed. Include:
- Visible pores on nose, forehead, cheeks
- Natural skin texture like unedited iPhone photo
- Subtle under-eye shadows (not dark circles)
- Light freckles or small moles natural to ethnicity
- Slight healthy flush on cheeks
- Natural lip texture, not glossy plastic
- If hands visible: visible knuckle wrinkles, natural nail beds, slight vein visibility

NO: Porcelain smooth skin, plastic texture, over-smoothed, airbrushed, uncanny valley.
```

### AGE-APPROPRIATE DETAILS (REQUIRED)
```
AGE-APPROPRIATE DETAILS: For age [X], include natural signs:
- 25-30: Minimal lines, youthful but real skin texture
- 30-40: Light smile lines, subtle forehead movement lines, real skin
- 40-50: Visible laugh lines, natural forehead lines, authentic aging
- Expression lines that appear when smiling

NO: Ageless plastic face, Benjamin Button smooth, uncanny perfection.
```

### HAND REALISM (REQUIRED when hands visible)
```
HAND REALISM — CRITICAL: Hands must look real and natural:
- Correct finger count (5 fingers)
- Natural finger proportions and lengths
- Visible knuckle creases and skin texture
- Natural nail shape and cuticles
- Slight vein visibility on back of hand
- Proper grip — fingers wrap naturally around product
- Wrist visible with natural transition to arm

NO: Plastic hands, extra fingers, merged fingers, impossible grip angles, floating hands.
```

### HAIR REALISM (REQUIRED)
```
HAIR REALISM: Natural hair with real texture:
- Individual strand visibility at edges
- Natural flyaways and baby hairs
- Appropriate texture for ethnicity
- Not perfectly styled every strand
- Natural hairline

NO: Plastic helmet hair, uniform strands, wig-like, anime hair.
```

### CLOTHING REALISM (REQUIRED)
```
CLOTHING REALISM: Real fabric behavior:
- Natural wrinkles at joints and folds
- Fabric weight visible in drape
- Appropriate texture (knit, woven, etc.)
- Seams visible where appropriate
- Not vacuum-sealed to body

NO: Painted-on clothes, CGI fabric, impossibly smooth, shrink-wrapped.
```

### PRODUCT IN HAND (CRITICAL)
```
PRODUCT IN HAND — CRITICAL: Product must look real when held:
- Product size proportionate to hand
- Fingers grip naturally — some fingers may be hidden behind product
- Product has weight — hand shows slight tension
- Shadow where hand contacts product
- Product design EXACTLY matches reference — do NOT modify

NO: Floating product, impossible grip, oversized/undersized product, distorted product design.
```

---

## DIRECTION TEMPLATES

### DIRECTION 1: HAND HOLDING

```
Realistic UGC-style product photography. Close-up of hand holding product.

REFERENCE IMAGE:
Use the 3x3 product grid. SELECT THE [ANGLE] (side_profile or 3/4_left recommended).
CLONE exact product design — do NOT modify.

BRAND-MATCHED PERSONA:
[SELECT BASED ON BRAND DNA — age, gender, skin tone, style]

SCENE:
Close crop on hand holding product. [SETTING] softly blurred in background.

Hand enters frame from [bottom/side]. Natural feminine/masculine hand with:
- [NAIL STYLE — natural, soft polish, bare]
- [JEWELRY — minimal ring, bracelet, or none]
- Relaxed natural grip, fingers wrapped around product

Product angled slightly toward camera. Product is HERO — sharp focus. Hand in focus, background soft.

HAND REALISM — CRITICAL:
- 5 fingers, natural proportions
- Visible knuckle creases and skin texture
- Natural nail beds and cuticles
- Slight vein visibility
- Natural grip — fingers wrap around product realistically

SKIN REALISM — CRITICAL:
- Real skin texture, visible pores
- NOT airbrushed or plastic
- Natural skin tone variation
- Age-appropriate texture

PRODUCT FIDELITY — CRITICAL:
- Product design EXACTLY matches reference
- ALL text legible
- Product size proportionate to hand
- Real shadow where hand grips product

LIGHTING:
[BRAND-MATCHED — soft natural for feminine, directional for masculine]
Real shadows. No magical glow.

CAMERA:
Tight framing on hand + product. 85mm. f/2.8 shallow depth. Product sharp.

NOT: Extra fingers, plastic skin, floating product, airbrushed, distorted product, impossible grip, CGI hands, uncanny valley.
```

---

### DIRECTION 2: PRESENTING TO CAMERA

```
Realistic UGC-style product photography. Person presenting product to camera.

REFERENCE IMAGE:
Use the 3x3 product grid. SELECT THE FRONT HERO ANGLE (top-left).
CLONE exact product design — do NOT modify.

BRAND-MATCHED PERSONA:
[Age range], [gender], [ethnicity], [style description].
[Expression — warm smile, confident, approachable]
[Clothing — brand-appropriate casual]

SCENE:
Person in [SETTING], holding product up toward camera with one hand. "Look what I found" energy.

Person positioned [left/right] of frame, product held in space on opposite side. Person's face visible but product is the HERO.

Body angled slightly, not straight-on. Natural pose like mid-conversation.

FRAMING:
Chest-up or waist-up. Person takes ~40% of frame, product takes ~30%, environment ~30%.

SKIN REALISM — CRITICAL:
[Full skin realism block]

AGE-APPROPRIATE DETAILS:
[Include for selected age range]

HAND REALISM — CRITICAL:
[Full hand realism block]

PRODUCT FIDELITY — CRITICAL:
- Product design EXACTLY matches reference
- ALL text legible and correctly spelled
- Product size proportionate to person
- Product angled so front design visible to camera

LIGHTING:
[BRAND-MATCHED lighting]
Natural catchlights in eyes. Real shadows on face. No ring light perfection.

CAMERA:
35-50mm. f/2.8. Person and product in focus, background soft.

NOT: Plastic skin, airbrushed, stock photo pose, stiff unnatural, distorted product, extra fingers, dead eyes, ring light flat.
```

---

### DIRECTION 3: PRODUCT IN SCENE

```
Realistic UGC-style product photography. Product on surface with person soft in background.

REFERENCE IMAGE:
Use the 3x3 product grid. SELECT THE [ANGLE] (3/4_left or flat_lay).
CLONE exact product design — do NOT modify.

BRAND-MATCHED PERSONA:
[Age range], [gender], [style] — visible but SOFT FOCUS in background.

BRAND-MATCHED SETTING:
[Kitchen counter / bathroom vanity / desk / bedside table]

SCENE:
Product placed naturally on [SURFACE] in foreground — SHARP FOCUS, product is HERO.

Person in background, soft bokeh blur. Person is:
- [Reaching for product / sitting nearby / moving through frame / blurred silhouette]
- NOT looking at camera — candid moment
- Wearing [brand-appropriate clothing]

Context items around product: [2-3 relevant items for setting]

PRODUCT PLACEMENT:
Product SET DOWN naturally, slight angle. Discovered in real environment.

PRODUCT FIDELITY — CRITICAL:
- Product design EXACTLY matches reference
- ALL text legible
- Product in SHARP focus
- Real shadow beneath product

COMPOSITION:
Product in foreground (sharp), person in background (soft). Rule of thirds. Asymmetric.

LIGHTING:
Natural environmental light from [window/overhead]. Real shadows. Lived-in warmth.

CAMERA:
35mm. f/1.8-2.8 for strong separation. Product tack sharp, person soft blur.

NOT: Person in focus, product blurry, staged catalog, stock photo, both equally sharp, centered symmetrical.
```

---

### DIRECTION 4: USING PRODUCT

```
Realistic UGC-style product photography. Person actively using/taking product.

REFERENCE IMAGE:
Use the 3x3 product grid. SELECT THE FRONT HERO ANGLE (top-left).
CLONE exact product design — do NOT modify.

BRAND-MATCHED PERSONA:
[Age range], [gender], [style].
Natural "in the moment" expression — not posing for camera.

SCENE:
Person in [MORNING ROUTINE / POST-WORKOUT / SELF-CARE MOMENT].

Action: [Taking capsule with water / Opening product / About to use product]

Person's focus on the product/action, not camera. Candid documentary feel.

FRAMING:
Medium shot. Product visible in hand/use. Person's upper body and face visible.

SKIN REALISM — CRITICAL:
[Full block]

HAND REALISM — CRITICAL:
[Full block]

PRODUCT FIDELITY — CRITICAL:
- Product design EXACTLY matches reference
- Product size proportionate to person
- Natural interaction — product has weight

LIGHTING:
Natural environmental light. [Morning window / bathroom light / soft daylight]
Real shadows. Documentary feel.

CAMERA:
35-50mm. f/2.8. Action moment frozen naturally.

NOT: Looking at camera, posed, stock photo action, plastic skin, distorted product.
```

---

### DIRECTION 5: SELFIE WITH PRODUCT

```
Realistic UGC-style selfie. Person taking selfie holding product.

REFERENCE IMAGE:
Use the 3x3 product grid. SELECT THE FRONT HERO ANGLE (top-left).
CLONE exact product design — do NOT modify.

BRAND-MATCHED PERSONA:
[Age range], [gender], [style].
Genuine smile, approachable "sharing with friends" energy.

SCENE:
Selfie perspective — slight upward angle, arm extended (arm may be cropped).

Person holding product near face/chest with other hand. "Just got this!" energy.

Background: [Simple home interior / bathroom mirror / bright wall / outdoor]

FRAMING:
Selfie crop — face and upper chest. Product held in frame. Casual, not perfectly composed.

SELFIE CHARACTERISTICS:
- Slight wide-angle distortion (natural to phone selfie)
- Phone shadow or arm shadow acceptable
- Not perfectly centered — authentic selfie framing
- Catchlight suggesting phone screen

SKIN REALISM — CRITICAL:
[Full block — especially important for close selfie]

PRODUCT FIDELITY — CRITICAL:
- Product design EXACTLY matches reference
- Product readable even if slightly angled

LIGHTING:
Natural selfie lighting — window light or soft indoor. NOT ring light perfect.

CAMERA:
Wide angle (phone selfie ~24mm equivalent). f/2.4. Selfie depth of field.

NOT: Professional studio, ring light flat, airbrushed, stock photo, perfectly composed, dead expression.
```

---

## COMMON ISSUES & FIXES

| Issue | Cause | Fix |
|-------|-------|-----|
| Extra/missing fingers | AI hand generation | Add "EXACTLY 5 fingers" and hand realism block |
| Plastic skin | Over-smoothing | Emphasize pores, texture, "like unedited iPhone" |
| Product distorted | AI modifying design | Stronger reference lock language |
| Uncanny valley face | AI perfection | Add age-appropriate details, asymmetry |
| Stiff pose | Stock photo training | Specify "candid", "mid-motion", "documentary" |
| Product floating | No grip physics | Specify "fingers wrap around", "product has weight" |

---

## USAGE

1. Get product grid (Product Grid Skill)
2. Analyze brand from website URL
3. Select influencer direction based on content need
4. For selected direction:
   - Select brand-matched persona (age, gender, style)
   - Select brand-matched setting
   - Pull appropriate product angle from grid
   - Fill template with specifics
   - Include ALL realism blocks (especially skin, hands)
5. Generate in Nano Banana/Higgsfield with grid as reference
6. Review for:
   - Product fidelity (design matches)
   - Person realism (no uncanny valley)
   - Hand accuracy (5 fingers, natural grip)
7. Regenerate if major issues
