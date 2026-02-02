# MTRX AI V1 — Product Image Generator

## Project Overview

This is V1 of the MTRX AI platform — a product image generator that replaces professional product photography using AI.

**User Flow:**
1. User uploads product image + enters website URL
2. System analyzes product (3x3 analysis runs in background)
3. User selects image type: Aesthetic / Influencer / UGC / Model
4. User picks specific directions within that type
5. System generates prompts using skills → sends to Nano Banana API
6. User previews generated images in gallery
7. User downloads selected images

---

## Tech Stack

- **Frontend:** React/Next.js (or simple HTML/JS for MVP)
- **Backend:** Node.js
- **AI Image Generation:** Nano Banana API
- **Web Scraping:** For brand analysis from URL

---

## Folder Structure

```
mtrx-ai-v1/
├── CLAUDE.md              # This file - project context
├── skills/                # All prompt generation skills
│   ├── 3x3-product-analysis.md
│   ├── product-grid.md
│   ├── aesthetic-image.md
│   ├── influencer-image.md
│   ├── ugc-image.md
│   ├── model-closeup.md
│   ├── model-lifestyle.md
│   └── model-couple.md
├── src/                   # Application code
│   ├── api/
│   │   └── nano-banana.js    # Nano Banana API integration
│   ├── services/
│   │   ├── product-analyzer.js  # Analyzes product from image + URL
│   │   ├── prompt-builder.js    # Builds prompts from skills
│   │   └── brand-scraper.js     # Scrapes brand info from URL
│   └── utils/
│       └── image-utils.js       # Image processing utilities
└── config/
    └── directions.json          # All available directions per image type
```

---

## Core Concepts

### Image Types

| Type | Description | Skills Used |
|------|-------------|-------------|
| **Aesthetic** | Styled product photography | aesthetic-image.md |
| **Influencer** | Person + product shots | influencer-image.md |
| **UGC** | iPhone selfie style | ugc-image.md |
| **Model Close-up** | Face + product, tight framing | model-closeup.md |
| **Model Lifestyle** | Full body, environment | model-lifestyle.md |

### Directions (per Image Type)

**Aesthetic Directions:**
1. `botanical_ingredient` — Product surrounded by raw ingredients
2. `calm_wellness` — Bathroom/self-care setting
3. `lifestyle_moment` — Kitchen/desk/real environment
4. `bold_color_pop` — Solid color backdrop
5. `texture_immersion` — Rich tactile textures

**Influencer Directions:**
1. `hand_holding` — Hand holding product close-up
2. `presenting_to_camera` — Person showing product
3. `product_in_scene` — Product on surface, person blurred
4. `using_product` — Person actively taking/using
5. `selfie_with_product` — Selfie style

**UGC Directions:**
1. `bedroom_selfie` — Cozy room, influencer pretty
2. `car_selfie` — Parked car, excited to share
3. `gym_selfie` — Post-workout, active lifestyle
4. `bathroom_mirror` — Morning routine
5. `kitchen_counter` — Lifestyle moment

**Model Directions:**
1. `closeup_warm` — Face + product, warm smile
2. `closeup_confident` — Face + product, subtle smile
3. `lifestyle_yoga` — Full body, wellness activity
4. `lifestyle_kitchen` — Full body, morning routine
5. `couple_romantic` — Two people, relationship context

---

## Nano Banana API Integration

### Endpoint
```
POST https://api.nanobanana.com/v1/generate
```

### Request Format
```json
{
  "prompt": "...",
  "reference_images": ["base64_encoded_image"],
  "aspect_ratio": "1:1",
  "model": "pro"
}
```

### Required Headers
```
Authorization: Bearer {NANO_BANANA_API_KEY}
Content-Type: application/json
```

---

## Product Analysis Schema

When analyzing a product, extract this information:

```json
{
  "product_info": {
    "brand": "",
    "product_name": "",
    "category": "",
    "packaging_type": "",
    "key_ingredients": [],
    "key_benefits": []
  },
  "visual_identity": {
    "primary_color": "",
    "secondary_colors": [],
    "accent_colors": [],
    "packaging_style": "",
    "finish": ""
  },
  "brand_voice": {
    "tone": "",
    "energy": "",
    "target_gender": "",
    "target_age": ""
  },
  "product_description_block": ""
}
```

---

## Prompt Building Process

1. **Load skill template** for selected direction
2. **Insert product description block** from analysis
3. **Select brand-matched elements:**
   - Surface (based on brand tone)
   - Lighting (based on brand energy)
   - Model persona (based on target customer)
   - Setting (based on product category)
4. **Apply all realism blocks** (skin, hands, product fidelity)
5. **Add NOT section** to prevent common AI issues

---

## Key Realism Blocks (Always Include)

### Product Fidelity
```
PRODUCT FIDELITY — CRITICAL:
• Product design EXACTLY matches reference
• ALL text legible and correctly spelled
• Colors, logos, packaging accurate
• Product scale realistic
```

### Skin Realism (for person shots)
```
SKIN REALISM — CRITICAL:
• Real skin texture, visible pores
• NOT airbrushed or plastic
• Natural skin tone variation
• Age-appropriate details
```

### Hand Realism (when hands visible)
```
HAND REALISM — CRITICAL:
• EXACTLY 5 fingers
• Natural proportions
• Visible knuckle creases
• Proper grip on product
```

---

## Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| Product design wrong | Stronger reference lock, add product description at TOP of prompt |
| Mirrored text | Add "text reads correctly left to right" |
| Extra fingers | Add "EXACTLY 5 fingers" and hand realism block |
| Plastic/AI skin | Add full skin realism block with pore detail |
| Product too big | Add "product SMALLER than face" or specific dimensions |

---

## Environment Variables

```
NANO_BANANA_API_KEY=xxx
```

---

## Acceptance Criteria (V1 Release)

1. ✅ Image upload completes in under 3 seconds
2. ✅ All images generate successfully 95% of the time
3. ✅ Product is recognizable in output 90% of the time
4. ✅ All 4 image types functional (Aesthetic, Influencer, UGC, Model)
5. ✅ Download works for all images
6. ✅ Total generation time under 60 seconds
7. ✅ Mobile responsive
8. ✅ No critical bugs

---

## Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Test Nano Banana connection
npm run test:api

# Generate images (CLI)
npm run generate -- --image ./product.png --url https://example.com --type aesthetic
```

---

## Next Steps After V1

- V2: Static Ad Designer (images + copy overlay)
- V3: Podcast/Debate Video Generator
- V4: B-Roll & Edit Features
