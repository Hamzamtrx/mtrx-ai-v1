# MTRX AI — PRODUCT IMAGE PIPELINE

**Version:** 1.0  
**Last Updated:** January 29, 2026

Complete workflow from product input to final ad-ready images.

---

## PIPELINE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────┐
│  INPUT: Product Image + Website URL                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: PRODUCT GRID SKILL                                     │
│  ─────────────────────────────                                  │
│  • Generates 3x3 grid with 9 angles                             │
│  • Auto-crops into individual angle files                       │
│  • Output: /product_angles/ folder                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2A: AESTHETIC IMAGE SKILL                                 │
│  ─────────────────────────────                                  │
│  • Analyzes brand DNA from website                              │
│  • Selects direction (botanical, wellness, lifestyle, etc.)     │
│  • Pulls DEFAULT_ANGLES for direction                           │
│  • Generates prompt with all realism blocks                     │
│  • Output: Styled product photography                           │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│  STEP 2B: INFLUENCER     │    │  STEP 2C: PLAIN IMAGE    │
│  IMAGE SKILL             │    │  SKILL                   │
│  ────────────────────    │    │  ──────────────────      │
│  • Hand holding          │    │  • Clean white BG        │
│  • Presenting to camera  │    │  • No styling            │
│  • In scene placement    │    │  • Product only          │
└──────────────────────────┘    └──────────────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: STATIC AD SKILL                                        │
│  ───────────────────────                                        │
│  • Takes aesthetic/influencer images                            │
│  • Adds headline, body copy, CTA                                │
│  • Applies brand typography                                     │
│  • Output: Final ad-ready creative                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## SKILL STATUS

| Skill | Status | Notes |
|-------|--------|-------|
| Product Grid | ✅ VALIDATED | 3x3 grid working reliably |
| Aesthetic Image | ✅ VALIDATED | 5 directions, brand-matched surfaces/lighting |
| Influencer Image | 🔄 READY TO TEST | 5 directions built, needs testing |
| Plain Image | ⏳ TODO | Not started |
| Static Ad | ⏳ TODO | Not started |

---

## ANGLE MAPPING REFERENCE

### Grid Positions → Angle IDs

```
┌────────────────┬────────────────────┬────────────────┐
│  front_hero    │  front_hero_variant│  3/4_right     │
│  (top_left)    │  (top_center)      │  (top_right)   │
├────────────────┼────────────────────┼────────────────┤
│  3/4_left      │  top_down          │  side_profile  │
│  (middle_left) │  (middle_center)   │  (middle_right)│
├────────────────┼────────────────────┼────────────────┤
│  front_hero_alt│  back_panel        │  flat_lay      │
│  (bottom_left) │  (bottom_center)   │  (bottom_right)│
└────────────────┴────────────────────┴────────────────┘
```

### Direction → Angle Defaults

**Aesthetic Directions:**
```json
{
  "botanical_ingredient": ["front_hero", "flat_lay"],
  "calm_wellness": ["front_hero", "3/4_left"],
  "lifestyle_moment": ["3/4_left", "flat_lay"],
  "bold_color_pop": ["front_hero"],
  "texture_immersion": ["3/4_left", "front_hero"]
}
```

**Influencer Directions:**
```json
{
  "hand_holding": ["side_profile", "3/4_left"],
  "presenting_to_camera": ["front_hero", "3/4_left"],
  "in_scene": ["flat_lay", "3/4_left"]
}
```

---

## FILE STRUCTURE

```
/product_name/
├── input/
│   ├── product_reference.png      # Original upload
│   └── website_analysis.json      # Brand DNA
│
├── grid/
│   └── product_grid.png           # 3x3 composite
│
├── angles/                        # Auto-cropped from grid
│   ├── front_hero.png
│   ├── front_hero_variant.png
│   ├── 3_4_right.png
│   ├── 3_4_left.png
│   ├── top_down.png
│   ├── side_profile.png
│   ├── front_hero_alt.png
│   ├── back_panel.png
│   └── flat_lay.png
│
├── aesthetic/                     # Styled shots
│   ├── botanical_ingredient_01.png
│   ├── calm_wellness_01.png
│   └── ...
│
├── influencer/                    # Influencer shots
│   ├── hand_holding_01.png
│   └── ...
│
└── ads/                           # Final ads with copy
    ├── ad_botanical_v1.png
    └── ...
```

---

## BRAND ANALYSIS SCHEMA

```json
{
  "brand_analysis": {
    "product_info": {
      "name": "",
      "category": "",
      "price_point": "",
      "key_ingredients": [],
      "key_benefits": [],
      "unique_mechanism": ""
    },
    "brand_voice": {
      "tone": "aggressive | nurturing | clinical | playful | luxurious | rebellious",
      "energy": "high | calm | balanced",
      "language_style": "scientific | conversational | empowering | emotional",
      "key_phrases": []
    },
    "target_customer": {
      "gender": "",
      "age_range": "",
      "life_stage": "",
      "pain_points": [],
      "aspirations": []
    },
    "visual_identity": {
      "packaging_colors": [],
      "packaging_style": "minimal | bold | natural | clinical | luxe",
      "existing_imagery_style": ""
    },
    "brand_story": {
      "founder_led": true,
      "origin_story": "",
      "core_values": [],
      "positioning": ""
    }
  }
}
```

---

## DIRECTION MATCHING RULES

```
IF brand_voice.tone = "nurturing" AND product has botanicals:
  → botanical_ingredient, calm_wellness, lifestyle_moment

IF brand_voice.tone = "aggressive" OR packaging_style = "bold":
  → bold_color_pop, texture_immersion

IF brand_story contains "ancestral" OR "primal" OR "natural":
  → botanical_ingredient, calm_wellness

IF target_customer.life_stage = "mom" OR "parent":
  → calm_wellness, lifestyle_moment

IF price_point = "premium" OR "luxury":
  → texture_immersion, bold_color_pop

IF category = "supplement" AND has natural_ingredients:
  → botanical_ingredient, calm_wellness
```

---

## NEXT STEPS

1. ✅ Product Grid Skill — DONE
2. 🔄 Aesthetic Image Skill — Testing botanical direction
3. ⏳ Complete Aesthetic Image testing (all 5 directions)
4. ⏳ Build Influencer Image Skill
5. ⏳ Build Plain Image Skill
6. ⏳ Build Static Ad Skill
7. ⏳ Integration into Claude Code tool
