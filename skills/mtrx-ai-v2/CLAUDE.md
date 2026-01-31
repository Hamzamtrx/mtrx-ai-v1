# MTRX AI V2 — Static Ad Generator

## Project Overview

V2 of the MTRX AI platform — generates static ad creatives with text baked into AI-generated images.

**Key Difference from V1:** 
- V1 = Product photography only
- V2 = Complete static ads (image + copy + layout)

**Architecture:**
```
Category (what product is) × Static Type (what ad style)
```

---

## Categories

| Category | Examples | Notes |
|----------|----------|-------|
| **Apparel** | UndrDog, True Classic, BYLT | T-shirts, hoodies, pants |
| **Supplements** | Primal Queen, AG1 | Pouches, bottles, capsules |
| **Skincare** | Drunk Elephant, Glossier | Serums, creams, tubes |
| **Fragrance** | Dossier, Le Labo | Perfumes, colognes |
| **Food/Bev** | Liquid Death, RXBAR | Drinks, snacks, bars |
| **Tech** | Anker, Oura | Devices, accessories |

---

## Static Types

| Type | Name | Description | Best For |
|------|------|-------------|----------|
| **Type 1** | Product Hero | Clean product + bold headline + offer | Launches, retargeting, brand awareness |
| **Type 2** | Meme Style | Internet meme format with product | TOF, viral, younger audiences |
| **Type 3** | Aesthetic + Offer | Premium photo + announcement | Drops, limited editions, restocks |
| **Type 4** | Animated Benefits | Cartoon style + benefit callouts | Education, comparison, shareable |

---

## User Flow

```
1. User uploads product image + enters website URL
2. System detects category (or user selects)
3. User selects static type (1-4)
4. System loads: skills/{category}/type{N}-{name}.md
5. User fills variables OR system auto-generates copy
6. System builds prompt with copy baked in
7. Sends to Kie.ai Nano Banana API
8. User previews and downloads
```

---

## Folder Structure

```
mtrx-ai-v2/
├── CLAUDE.md
├── config/
│   └── static-types.json      # Categories + types config
├── skills/
│   ├── apparel/
│   │   ├── type1-product-hero.md
│   │   ├── type2-meme.md
│   │   ├── type3-aesthetic-offer.md
│   │   └── type4-animated-benefits.md
│   ├── supplements/
│   │   ├── type1-product-hero.md
│   │   ├── type2-meme.md
│   │   └── ...
│   ├── skincare/
│   ├── fragrance/
│   ├── food_beverage/
│   └── tech/
└── src/
    └── [application code]
```

---

## Copy Frameworks by Type

### Type 1: Product Hero
```
HEADLINE: [SUPERLATIVE] + [PRODUCT] + YOU'LL EVER + [VERB]
Example: "THE STRONGEST SHIRT YOU'LL EVER OWN."

OFFER LINE: ✓ + [Benefit/Guarantee]
Example: "✓ Lifetime Guarantee"

CTA: SHOP NOW | GET YOURS | BUY NOW
```

### Type 2: Meme Style
```
TOP PANEL: [Emotional overreaction]
Example: "Thank you for changing my life"

BOTTOM PANEL: "I'm literally just a [product] made from [material] 
that you can [use case 1], [use case 2], [use case 3] that's [benefit]."
```

### Type 3: Aesthetic + Offer
```
PRODUCT CODE: [CODE]: [NAME]
Example: "007: AGENT GOLD"

ANNOUNCEMENT: [2-3 words, huge]
Example: "WE ARE LIVE"

BADGE: [Urgency indicator]
Example: "LIMITED EDITION"
```

### Type 4: Animated Benefits
```
HEADLINE: [PRODUCT]. [COMPARISON].
Example: "HEMP T-SHIRT. HEMP > POLYESTER."

BENEFITS: 3 pill badges, 2-3 words each
Example: "ALL NATURAL" | "ZERO MICROPLASTICS" | "LIFETIME GUARANTEE"

CTA: [ACTION] + [BRAND IDENTITY]
Example: "BECOME AN UNDRDOG TODAY"
```

---

## API Integration

Same as V1 — uses Kie.ai Nano Banana API.

```
POST https://api.kie.ai/api/v1/jobs/createTask

{
  "model": "google/nano-banana-pro",
  "input": {
    "prompt": "[Full prompt with baked-in text]",
    "image_urls": ["[product reference URL]"],
    "output_format": "png",
    "image_size": "4:5"
  }
}
```

---

## Current Status

### Apparel Category ✅
- [x] Type 1: Product Hero
- [x] Type 2: Meme Style  
- [x] Type 3: Aesthetic + Offer
- [x] Type 4: Animated Benefits

### Supplements Category ⏳
- [ ] Type 1: Product Hero
- [ ] Type 2: Meme Style
- [ ] Type 3: Aesthetic + Offer
- [ ] Type 4: Animated Benefits

### Other Categories ⏳
- [ ] Skincare
- [ ] Fragrance
- [ ] Food/Beverage
- [ ] Tech

---

## Next Steps

1. Test Apparel Type 1-4 prompts in Nano Banana
2. Iterate based on results
3. Build Supplements category skills
4. Create application code for prompt building
5. Add copy generation with Claude API

---

## Key Learnings from V1

1. **Category matters** — A t-shirt needs completely different prompts than a supplement pouch
2. **Text rendering** — Nano Banana Pro handles text better, but still needs clear specifications
3. **Reference images** — Must be public URLs (not base64)
4. **Copy frameworks** — Each static type needs its own copy structure
5. **Aspect ratios** — 4:5 for feed, 9:16 for stories, 1:1 for square
