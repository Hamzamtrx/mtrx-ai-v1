# MTRX AI - Learnings & Documentation

## What Went Well (Skills/Patterns to Reuse)

### 1. Image Hosting Solution
**Problem:** External image hosting services (freeimage.host, imgbb, file.io) were failing/timing out.
**Solution:** Use `catbox.moe` with `axios` + `form-data` library (NOT formdata-node, NOT native fetch).
```javascript
const FormDataLib = require('form-data');
const axios = require('axios');
const form = new FormDataLib();
form.append('reqtype', 'fileupload');
form.append('fileToUpload', fsSync.createReadStream(filePath));
const response = await axios.post('https://catbox.moe/user/api.php', form, {
  headers: form.getHeaders()
});
```

### 2. 9:16 Extension Approach
**Pattern:** For both apparel AND supplements, use the same extension approach:
- Generate 4:5 first
- Use 4:5 output URL as reference image
- Send extension prompt to extend (not regenerate)
- DO NOT generate 9:16 natively - always extend from 4:5
- **Include exact brand colors in extension prompt** to prevent color drift:
```javascript
const brandColorInfo = `
EXACT BRAND COLORS TO PRESERVE:
• Background: ${sc.background}
• Accent color: ${sc.accent_color}
• Text colors: ${sc.text_color_1} and ${sc.text_color_2}
`;
```

### 5. H1-Benefits Thematic Linking
**Pattern:** For Benefit Checklist, H1 and benefits MUST be thematically connected:
- H1 hooks with the avatar's specific problem
- Benefits answer objections someone with THAT problem would have
- CTA resolves THAT specific problem

**Example (Emotional Eater):**
```
H1: "You're not eating because you're hungry."
Benefits:
✓ Saffron supports serotonin (your mood signal)
✓ Helps break the stress-eat cycle
✓ Reduces emotional snacking urges
✓ Works on the WHY, not just the what
CTA: "It's not about willpower. It's about chemistry."
```
DO NOT MIX AVATARS - if H1 is about emotional eating, benefits must be about emotional eating.

### 3. Supplement Variant System
**Pattern:** Supplements use the same variant system as apparel:
- User selects number of variants (1-4)
- AI generates 4 copy variants per static type
- Each variant uses different copy angle (problem-aware, skeptic, outcome-focused, urgency)

### 4. Capsule Analysis via Vision
**Pattern:** Analyze product image for capsule appearance using Claude Vision:
```javascript
const imageAnalysis = await this.client.messages.create({
  model: 'claude-sonnet-4-20250514',
  messages: [{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'url', url: productImageUrl } },
      { type: 'text', text: 'Describe ONLY the capsules/pills visible...' }
    ]
  }]
});
```

---

## What Went Wrong (Mistakes to Avoid)

### 1. DO NOT use formdata-node library
**Mistake:** Using `formdata-node` for catbox uploads caused 412 errors.
**Fix:** Always use `form-data` package with `axios`.

### 2. DO NOT generate 9:16 natively for supplements
**Mistake:** Tried to generate 9:16 version natively with adapted prompt instead of extending.
**Fix:** Always use the same 4:5 extension approach for ALL categories (apparel AND supplements).

### 3. DO NOT use localtunnel URLs for API references
**Mistake:** Falling back to localtunnel URLs when image hosting fails - Nano Banana API times out accessing them.
**Fix:** Ensure catbox upload works; localtunnel is unreliable for external API access.

### 4. DO NOT try base64 images
**Mistake:** Attempted to send base64 encoded images directly - this broke things.
**Fix:** Always use hosted URLs for image references.

### 5. DO NOT change approaches without checking apparel first
**Mistake:** Making supplements work differently from apparel.
**Fix:** ALWAYS check how apparel does it first and replicate that approach.

### 6. DO NOT generate mismatched H1 and benefits
**Mistake:** AI generated H1 about "food noise" but benefits about "emotional eating" (different avatars).
**Fix:** Explicitly require H1 and benefits to match the SAME avatar in the prompt:
- Add examples showing correct pairing
- Add rule: "DO NOT MIX AVATARS"

### 7. DO NOT use generic extension prompts
**Mistake:** Extension prompt said "same colors" generically without specifying which colors.
**Fix:** Include the EXACT brand colors extracted from copy research in the extension prompt.

---

## Prompt Guidelines for Supplements

### Benefit Checklist Layout
```
TOP SECTION (full width, centered):
- Large bold headline spanning width

MIDDLE SECTION (two columns):
- LEFT: Product from reference image
- RIGHT: Benefit checklist with brand-colored checkmarks

BOTTOM SECTION (centered):
- CTA button
- Trust text (stars + guarantee)
```

### Ingredient Halo Guidelines
- Background: Dark, premium gradient (brand colors)
- Ingredients: MUTED, DESATURATED tones (NOT bright/colorful)
- Product: Center, dominant, from reference image
- Labels: Brand accent color

### Brand Color Enforcement
Always include in prompts:
```
BRAND COLOR SCHEME — CRITICAL:
• Use ONLY brand colors - NO random colors
• Match the brand's landing page aesthetic
```

---

## Future Improvements (TODO)

1. [ ] Add regeneration support for failed images
2. [ ] Improve capsule detection for pouches without visible capsules
3. [ ] Add more supplement static types (testimonial, comparison, etc.)
4. [ ] Cache successful image uploads to avoid re-uploading same product
5. [ ] Add retry logic for catbox uploads if they fail
6. [ ] Consider adding Cloudinary as backup image host (more reliable, has free tier)

---

## Key Technical Notes

### Nano Banana API
- Does NOT support true outpainting/extension
- Treats extension prompt as guidance but regenerates
- Needs publicly accessible image URLs (not localhost/localtunnel)
- Times out if image URL is slow to respond

### Image Hosting Priority
1. catbox.moe (with axios + form-data)
2. 0x0.st (backup)
3. litterbox (backup)
4. localtunnel fallback (unreliable - avoid)

### File Structure for Supplements
```
server.js - Main server with supplements flow
src/services/copy-research.js - AI research + prompt builders
  - researchSupplementCopy() - Analyzes product, detects avatar, generates copy variants
  - buildSupplementBenefitChecklistPrompt() - Builds benefit checklist prompt
  - buildSupplementIngredientHaloPrompt() - Builds ingredient halo prompt
```
