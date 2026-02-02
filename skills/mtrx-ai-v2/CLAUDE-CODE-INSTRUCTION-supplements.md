# INSTRUCTION: Add Supplement Category to Static Ad Generator

## Task

Add a new category called **"Supplements"** to the static ad generator section of MTRX AI V2.

---

## Folder Structure

```
skills/
└── supplements/
    ├── SKILL.md                    # Category overview + general guidelines
    └── types/
        ├── ingredient-halo/
        │   └── SKILL.md            # Ingredient Halo static type
        └── benefit-checklist/
            └── SKILL.md            # Benefit Checklist static type
```

---

## Category: Supplements

### Overview
Generate static ads for supplement brands. Contains multiple static ad types optimized for supplement marketing.

### Static Types

| Type | File | Purpose |
|------|------|---------|
| Ingredient Halo | `types/ingredient-halo/SKILL.md` | Product with ingredients floating in orbit, each labeled |
| Benefit Checklist | `types/benefit-checklist/SKILL.md` | Product + checkmark benefit list + headline + CTA |

---

## Required Inputs (All Types)

Before generating any supplement static, the system must collect:

### Product Assets
- **Product image** - Reference image of pouch/bottle/box
- **Product name** - Exact name as shown on packaging
- **Capsule/pill style** - Color, shape, size (e.g., "tan capsules", "white tablets", "clear softgels")

### Brand Assets  
- **Primary color** - For buttons, accents
- **Secondary color** - For text highlights
- **Background preference** - Dark, light, gradient, solid

### Content (Type-Specific)
- **Ingredient list** - For Ingredient Halo type
- **Key benefits** - For Benefit Checklist type
- **Guarantee** - Money-back period (e.g., "365-Day Money Back Guarantee")

### Avatar Selection
User must select target avatar. Options:
1. Skeptic
2. Food Noise Sufferer
3. 3PM Crash
4. Ozempic-Curious
5. Emotional Eater
6. Perimenopause Gainer
7. Diet Veteran

---

## Type 1: Ingredient Halo

### Input Form Fields
- Product description (text)
- Brand name (text)
- Accent color (color picker or text)
- Background style (dropdown: dark gradient, light, custom)
- Ingredients (repeater field):
  - Ingredient name
  - Visual description (e.g., "golden root", "red threads")
- Avatar (dropdown)
- H1 (text)
- H2 (text)
- CTA (text)
- Aspect ratio (dropdown: 4:5, 9:16, 1:1)

### Prompt Template
See `types/ingredient-halo/SKILL.md` for full template.

### Pre-written Copy
Each avatar has 2 pre-written copy variations. See skill file for all options.

---

## Type 2: Benefit Checklist

### Input Form Fields
- Product description (text)
- Brand name (text)
- Capsule style (text) - **CRITICAL: Must match actual product**
- Accent color (color picker or text)
- Text color 1 (color picker or text)
- Text color 2 (color picker or text)
- Background color (color picker or text)
- Avatar (dropdown)
- H1 Line 1 (text)
- H1 Line 2 (text, optional)
- Benefits (4 text fields)
- CTA (text)
- Trust element (text, default: "365-Day Money Back Guarantee")
- Aspect ratio (dropdown: 4:5, 9:16, 1:1)

### Prompt Template
See `types/benefit-checklist/SKILL.md` for full template.

### Pre-written Copy
Each avatar has 2 pre-written copy variations. See skill file for all options.

---

## Avatar Framework

Store this as reference data for copy suggestions:

| Avatar | Core Problem | Key Language |
|--------|--------------|--------------|
| Skeptic | Been burned before | "No proprietary blends", "full transparency" |
| Food Noise Sufferer | Can't stop thinking about food | "The radio won't turn off", "mental quiet" |
| 3PM Crash | Afternoon energy crash | "Hit a wall", "afternoon slump" |
| Ozempic-Curious | Wants GLP-1 results naturally | "Same pathways", "no needles" |
| Emotional Eater | Eats when not hungry | "Not actually hungry", "stress eating" |
| Perimenopause Gainer | Body changed in 40s | "What used to work doesn't work" |
| Diet Veteran | Tried everything | "You don't need another diet" |

---

## Language Guidelines

### Recommended Words
- "Food noise" / "food chatter"
- "The radio that won't turn off"
- "3pm crash" / "afternoon slump"
- "What used to work doesn't work anymore"
- Specific ingredient names
- Specific timeframes

### Avoid
- "Cravings" (too generic)
- "Appetite suppressant" (sounds like drug)
- "Burn fat" / "melt pounds" (scam language)
- "Revolutionary" / "breakthrough"
- "Proprietary blend"

---

## Platform Integration

**Higgsfield (Nano Banana Pro)**
- Pass product image as reference when calling API
- Include aspect ratio in prompt
- May need retry logic for text placement issues

---

## Files to Reference

The complete skill files with all copy variations, prompt templates, and quality checklists are in:

1. `/skills/supplements/SKILL.md` - Category overview
2. `/skills/supplements/types/ingredient-halo/SKILL.md` - Ingredient Halo type
3. `/skills/supplements/types/benefit-checklist/SKILL.md` - Benefit Checklist type
