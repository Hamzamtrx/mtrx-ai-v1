# SKILL: Aspect Ratio Extension

## Purpose

Convert a 4:5 static ad to 9:16 format while keeping it visually identical. Uses the 4:5 output as a reference image to ensure consistency.

---

## When to Use

After generating any static ad at 4:5, automatically trigger this skill to create the 9:16 version for:
- Instagram Stories
- TikTok
- Reels
- Any vertical full-screen placement

---

## Workflow

```
STEP 1: Generate primary creative at 4:5
         ↓
STEP 2: Use 4:5 output as reference image
         ↓
STEP 3: Run extension prompt
         ↓
STEP 4: Output both 4:5 and 9:16 versions
```

---

## Extension Prompt

**Reference Image:** The 4:5 output from Step 1

**Prompt:**
```
Recreate this exact image for 9:16 vertical format.

Keep IDENTICAL:
- Same scene/composition
- Same colors/lighting
- Same text (exact wording, same fonts, same placement)
- Same product placement
- Same style

ONLY CHANGE:
- Extend background vertically (top and bottom) to fill 9:16 frame
- Keep main subject centered in frame

9:16 aspect ratio.
```

---

## Supported Static Types

| Type | Extension Works | Notes |
|------|-----------------|-------|
| Type 1: Product Hero | ✅ | Extends gradient/background |
| Type 2: Meme | ✅ | Extends around meme panels |
| Type 3: Aesthetic + Offer | ✅ | Extends environment |
| Type 4: Illustrated | ✅ | Extends illustration background |
| Type 5: Vintage Magazine | ✅ | Extends vintage scene |
| Type 6: UGC Caption | ✅ | Extends room/environment |

---

## What Gets Extended

The AI will add more of whatever background exists:
- **Gradients** → More gradient above/below
- **Sky/clouds** → More sky above, more clouds below
- **Room/environment** → More ceiling above, more floor below
- **Solid color** → More solid color
- **Illustrated scenes** → Extended illustration matching style

---

## What Stays Locked

- Main subject position (centered)
- All text (headlines, subheads, CTAs)
- Product placement
- Color palette
- Lighting direction
- Style/aesthetic

---

## App Implementation

```javascript
// After generating 4:5 static
async function generateAspectRatios(prompt, referenceImage) {
  
  // Step 1: Generate 4:5
  const output_4x5 = await generateImage({
    prompt: prompt,
    reference: referenceImage,
    aspectRatio: '4:5'
  });
  
  // Step 2: Generate 9:16 using 4:5 as reference
  const extensionPrompt = `Recreate this exact image for 9:16 vertical format.

Keep IDENTICAL:
- Same scene/composition
- Same colors/lighting
- Same text (exact wording, same fonts, same placement)
- Same product placement
- Same style

ONLY CHANGE:
- Extend background vertically (top and bottom) to fill 9:16 frame
- Keep main subject centered in frame

9:16 aspect ratio.`;

  const output_9x16 = await generateImage({
    prompt: extensionPrompt,
    reference: output_4x5, // Use 4:5 output as reference
    aspectRatio: '9:16'
  });
  
  return {
    feed: output_4x5,    // 4:5 for feed
    story: output_9x16   // 9:16 for stories/reels
  };
}
```

---

## Other Aspect Ratio Conversions

### 4:5 → 1:1 (Square)

```
Recreate this exact image for 1:1 square format.

Keep IDENTICAL:
- Same scene/composition
- Same colors/lighting
- Same text (exact wording, same fonts, same placement)
- Same product placement
- Same style

ONLY CHANGE:
- Crop or adjust to fit 1:1 square frame
- Keep main subject centered

1:1 aspect ratio.
```

### 4:5 → 16:9 (Landscape/YouTube)

```
Recreate this exact image for 16:9 horizontal format.

Keep IDENTICAL:
- Same scene/composition
- Same colors/lighting
- Same text (exact wording, same fonts, same placement)
- Same product placement
- Same style

ONLY CHANGE:
- Extend background horizontally (left and right) to fill 16:9 frame
- Keep main subject centered in frame

16:9 aspect ratio.
```

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Text changes | AI regenerating instead of extending | Emphasize "IDENTICAL" and "exact wording" in prompt |
| Subject moves | Composition shift | Add "Keep main subject in exact same position" |
| Style changes | Weak reference adherence | Use higher reference strength if available |
| Background doesn't match | Complex backgrounds | Add specific background description to prompt |

---

## Quality Checklist

- [ ] Text is identical (check every word)
- [ ] Product placement matches
- [ ] Colors/lighting consistent
- [ ] Style matches (illustration stays illustration, photo stays photo)
- [ ] Extended areas blend seamlessly
- [ ] No weird artifacts at edges

---

## Status: VALIDATED ✅

**Tested on:**
- Illustrated split comparisons
- Product hero gradients
- Photography with environments

**Platform:** Nano Banana Pro / Kie.ai
