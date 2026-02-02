# PRODUCT GRID SKILL

**Status:** VALIDATED ✅  
**Last Updated:** January 29, 2026

Generate a 3x3 composite image showing 9 angles of the same product. Use as master reference for all downstream aesthetic image generation.

---

## INPUT

- Clean product reference image (front-facing preferred)
- Product type (pouch, bottle, jar, tube)

---

## OUTPUT

Single composite image with 9 labeled angles:
- Front Hero (×3 variants)
- 3/4 Left View
- 3/4 Right View
- Top Down View
- Side Profile
- Back Panel
- Flat Lay

---

## THE PROMPT

```
Professional commercial product photography composite. 3x3 grid layout showing 9 different angles of the SAME product.

REFERENCE IMAGE (CRITICAL — NON-NEGOTIABLE):
Use the uploaded product image as EXACT reference. CLONE the product design precisely for ALL 9 frames — same colors, same graphics, same text. Every frame shows the SAME product from a different angle. Do NOT modify the design.

PRODUCT:
Flexible stand-up mylar pouch. THIN profile — flexible film packaging, NOT a rigid box. Shows natural soft creases.

GRID LAYOUT (3 rows × 3 columns):

ROW 1 (TOP):
[Left] FRONT HERO — Straight-on front view, standing upright.
[Center] FRONT HERO VARIANT — Front view with very slight 5° rotation.
[Right] 3/4 RIGHT VIEW — Rotated 30° showing front + thin right side edge.

ROW 2 (MIDDLE):
[Left] 3/4 LEFT VIEW — Rotated 30° showing front + thin left side edge.
[Center] TOP DOWN VIEW — Camera above looking down at top seal.
[Right] SIDE PROFILE — Pure side view showing thin depth.

ROW 3 (BOTTOM):
[Left] FRONT HERO — Same as top-left.
[Center] BACK PANEL — Back of pouch with nutrition facts, barcode.
[Right] FLAT LAY — Product laying down flat on its side.

BACKGROUND:
ALL 9 frames: Pure white (#FFFFFF). Consistent soft shadow beneath each product.

LIGHTING:
Identical soft studio lighting all frames. Upper-left light source.

GRID STRUCTURE:
Equal spacing, thin white borders between frames, same product scale in each.

PRODUCT FIDELITY (CRITICAL):
• Design IDENTICAL all 9 frames
• ALL text LEGIBLE
• Flexible pouch — thin profile, soft creases
• NOT rigid, NOT puffy, NOT inflated

NOT: Modified design, different products, rigid box shape, thick pouch, colored backgrounds, props, blurry text.
```

---

## PRODUCT TYPE VARIATIONS

### For Bottle:
Replace "Flexible stand-up mylar pouch" with:
```
Glass/plastic bottle with cap. Shows material properties — transparency, reflections, label wrap. Natural bottle shape with proper proportions.
```

### For Jar:
```
Glass/plastic jar with lid. Shows material — transparency/opacity, proper reflections. Lid sits naturally on jar.
```

### For Tube:
```
Squeezable tube with cap. Shows flexibility of tube material, proper crimp at bottom, cap detail.
```

---

## KEY SUCCESS FACTORS

1. **Grid format with labels** — AI understands positions better than individual prompts
2. **"SAME product" repeated** — Prevents AI from inventing variations
3. **Explicit angle descriptions** — "Rotated 30°", "Camera above looking down"
4. **Material properties** — "THIN profile", "flexible", "NOT rigid"
5. **Reference lock** — "CLONE the product design precisely"

---

## KNOWN LIMITATIONS

- Back panel nutrition facts will be hallucinated (AI invents ingredients)
- Minor text variations may occur between frames
- Some frames may have slightly different lighting despite instructions

---

## WORKFLOW POSITION

```
STEP 1: Product Grid Skill ← YOU ARE HERE
   ↓
   Auto-crop into individual angle files
   ↓
STEP 2: Aesthetic/Influencer Image Skill (pulls specific angles)
   ↓
STEP 3: Static Ad Skill (adds copy to aesthetic images)
```

---

## ANGLE MAPPING BY SKILL

### Aesthetic Image Directions

| Direction | Default Angles | Reasoning |
|-----------|---------------|-----------|
| `botanical_ingredient` | front_hero, flat_lay | Front = see full design with ingredients around. Flat Lay = overhead ingredient spread |
| `calm_wellness` | front_hero, 3/4_left | Front = hero shot. 3/4 = more "discovered" natural feel |
| `lifestyle_moment` | 3/4_left, flat_lay | 3/4 = candid/natural. Flat Lay = overhead desk/counter shot |
| `bold_color_pop` | front_hero | Clean, graphic, design-forward |
| `texture_immersion` | 3/4_left, front_hero | 3/4 = depth against textures |

### Influencer Image Directions

| Direction | Default Angles | Reasoning |
|-----------|---------------|-----------|
| `hand_holding` | side_profile, 3/4_left | Fits naturally in hand grip |
| `presenting_to_camera` | front_hero, 3/4_left | Person showing product to viewer |
| `in_scene` | flat_lay, 3/4_left | Natural placement on table, in bag, etc. |

---

## ANGLE REFERENCE IDS

For software implementation, use these IDs:

```json
{
  "angle_ids": {
    "front_hero": "top_left",
    "front_hero_variant": "top_center", 
    "3/4_right": "top_right",
    "3/4_left": "middle_left",
    "top_down": "middle_center",
    "side_profile": "middle_right",
    "front_hero_alt": "bottom_left",
    "back_panel": "bottom_center",
    "flat_lay": "bottom_right"
  }
}
```

---

## AUTO-CROP LOGIC

After grid generation, system crops into 9 individual files:

```
/product_angles/
  ├── front_hero.png
  ├── front_hero_variant.png
  ├── 3_4_right.png
  ├── 3_4_left.png
  ├── top_down.png
  ├── side_profile.png
  ├── front_hero_alt.png
  ├── back_panel.png
  └── flat_lay.png
```

Downstream skills pull from this folder based on direction → angle mapping.

---

## TEST RESULTS

| Angle | Individual Prompt | Grid Prompt |
|-------|-------------------|-------------|
| Front Hero | ✅ | ✅ |
| 3/4 Left | ✅ | ✅ |
| 3/4 Right | ❌ Failed | ✅ |
| Top Down | ❌ Failed | ✅ |
| Side Profile | ✅ | ✅ |
| Back Panel | ✅ | ✅ |
| Flat Lay | ❌ Failed | ✅ |

**Conclusion:** Always use grid approach for complete angle coverage.
