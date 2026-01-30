# 3x3 PRODUCT GRID — APPAREL

**Purpose:** Generate a single composite image showing 9 angles of the same garment in a 3x3 grid layout. This becomes the master reference for all downstream image generation.

**Why This Matters:** AI image generators interpret product photos differently each time. By generating a locked 9-angle reference sheet FIRST, all aesthetic shots can reference a specific angle with pixel-perfect consistency.

---

## WHEN TO USE

Run this skill ONCE per product before generating any aesthetic/lifestyle shots.

**Input:** Clean product photo (flat lay or on model)
**Output:** 9-angle reference grid
**Use for:** All Type 3 Aesthetic shots, Type 2 Meme shots, any prompt needing product accuracy

---

## THE PROMPT — T-SHIRTS

```
Professional apparel product photography composite. 3x3 grid layout showing 9 different angles of the SAME t-shirt.

REFERENCE IMAGE (CRITICAL — NON-NEGOTIABLE):
Use the uploaded product image as EXACT reference. CLONE the garment precisely for ALL 9 frames — same color, same fit, same fabric texture, same labels, same details. Every frame shows the SAME shirt from a different angle. Do NOT modify the design in any frame.

PRODUCT DETAILS:
[INSERT FROM RESEARCH BRIEF - Product Details Extraction section]

GRID LAYOUT (3 rows × 3 columns):

ROW 1 (TOP) — FLAT LAY ANGLES:
[Top-Left] FLAT LAY FRONT — Shirt spread completely open, both sleeves extended outward, collar at top, hem at bottom. Full t-shirt silhouette visible. Camera directly above.
[Top-Center] FLAT LAY ANGLED — Same spread position, rotated 15° clockwise on surface. Shows natural fabric drape.
[Top-Right] FLAT LAY REVERSE — Back of shirt facing up. Spread open, sleeves extended. Shows back panel and neck tag area.

ROW 2 (MIDDLE) — DETAIL SHOTS:
[Middle-Left] COLLAR DETAIL — Close-up of neckline and collar. Shows stitching quality, neck tag/label, collar shape.
[Middle-Center] HEM + LABEL DETAIL — Close-up of bottom hem area showing the brand label/tag. Curved hem visible. Label clearly legible.
[Middle-Right] FABRIC TEXTURE — Extreme close-up of fabric weave. Shows cotton texture, thread detail, material quality.

ROW 3 (BOTTOM) — FOLDED/STYLED:
[Bottom-Left] RETAIL FOLD FRONT — Neatly folded retail-style, collar visible at top, sleeves tucked under. Front facing.
[Bottom-Center] RETAIL FOLD ANGLED — Same fold, rotated 30° showing depth of folded stack.
[Bottom-Right] CASUAL TOSS — Shirt loosely tossed/draped naturally, not perfectly arranged. Shows natural fabric behavior.

BACKGROUND:
ALL 9 frames have identical pure white (#FFFFFF) seamless background. No gradients. Consistent soft shadow beneath each item.

LIGHTING:
Identical soft diffused studio lighting across all 9 frames. Soft directional light from upper-left creating gentle shadows. Consistent exposure and color temperature in every frame.

GRID STRUCTURE:
• Equal spacing between all 9 frames
• Thin white border/gap separating each frame
• All 9 garments same scale relative to their frame
• Clean, organized, professional product catalog layout

FABRIC REALISM (CRITICAL):
• Real cotton/fabric texture visible — NOT CGI plastic
• Natural soft wrinkles from fabric weight
• Fabric has drape and softness
• Visible weave/thread texture in detail shots
• Human-folded imperfection in folded shots (not robotic symmetry)

PRODUCT FIDELITY (CRITICAL — NON-NEGOTIABLE):
• Design IDENTICAL across all 9 frames — same exact garment
• ALL labels/tags correct: [INSERT LABEL DETAILS FROM RESEARCH]
• Colors consistent across all frames
• Stitching, seams, and construction details accurate
• Natural fabric properties maintained

CAMERA/TECHNICAL:
• Product photography studio setup
• Each frame shot at equivalent of 85mm lens
• Sharp focus on product in every frame
• Color-accurate, no color cast

NOT (FORBIDDEN IN ALL FRAMES):
• Modified or reimagined design
• Different garments in different frames
• CGI/plastic/artificial fabric appearance
• Wrong labels or invented branding
• Harsh shadows or uneven lighting between frames
• Colored backgrounds
• Props or additional elements
• Inconsistent product scale between frames
• Mannequin or model (flat lay only)
• Perfectly robotic folds (needs human imperfection)
```

---

## THE PROMPT — PANTS/SHORTS

```
Professional apparel product photography composite. 3x3 grid layout showing 9 different angles of the SAME [pants/shorts].

REFERENCE IMAGE (CRITICAL — NON-NEGOTIABLE):
Use the uploaded product image as EXACT reference. CLONE the garment precisely for ALL 9 frames.

PRODUCT DETAILS:
[INSERT FROM RESEARCH BRIEF]

GRID LAYOUT (3 rows × 3 columns):

ROW 1 (TOP) — FLAT LAY ANGLES:
[Top-Left] FLAT LAY FRONT — Pants spread flat, legs extended, waistband at top. Full silhouette visible. Camera directly above.
[Top-Center] FLAT LAY ANGLED — Same spread position, rotated 15° clockwise.
[Top-Right] FLAT LAY BACK — Back of pants facing up. Shows back pockets, back panel.

ROW 2 (MIDDLE) — DETAIL SHOTS:
[Middle-Left] WAISTBAND DETAIL — Close-up of waistband, button/zipper area, belt loops.
[Middle-Center] POCKET DETAIL — Close-up of front or back pocket showing stitching and construction.
[Middle-Right] FABRIC TEXTURE — Extreme close-up of fabric weave and material quality.

ROW 3 (BOTTOM) — FOLDED/STYLED:
[Bottom-Left] RETAIL FOLD — Neatly folded, waistband visible at top.
[Bottom-Center] RETAIL FOLD ANGLED — Same fold, rotated 30°.
[Bottom-Right] CASUAL TOSS — Pants loosely draped naturally.

[Same BACKGROUND, LIGHTING, GRID STRUCTURE, FABRIC REALISM, FIDELITY, CAMERA, and NOT sections as t-shirt prompt]
```

---

## THE PROMPT — OUTERWEAR (Jackets, Hoodies)

```
Professional apparel product photography composite. 3x3 grid layout showing 9 different angles of the SAME [jacket/hoodie].

REFERENCE IMAGE (CRITICAL — NON-NEGOTIABLE):
Use the uploaded product image as EXACT reference. CLONE the garment precisely for ALL 9 frames.

PRODUCT DETAILS:
[INSERT FROM RESEARCH BRIEF]

GRID LAYOUT (3 rows × 3 columns):

ROW 1 (TOP) — FLAT LAY ANGLES:
[Top-Left] FLAT LAY FRONT — Jacket spread open, sleeves extended, front facing up. Zipper/buttons visible.
[Top-Center] FLAT LAY ANGLED — Same position, rotated 15° clockwise.
[Top-Right] FLAT LAY BACK — Back of jacket facing up, sleeves extended.

ROW 2 (MIDDLE) — DETAIL SHOTS:
[Middle-Left] COLLAR/HOOD DETAIL — Close-up of collar, hood, or neckline area.
[Middle-Center] CLOSURE DETAIL — Close-up of zipper, buttons, or closure mechanism.
[Middle-Right] FABRIC/MATERIAL TEXTURE — Extreme close-up showing material quality.

ROW 3 (BOTTOM) — FOLDED/STYLED:
[Bottom-Left] RETAIL FOLD — Neatly folded with collar/hood visible.
[Bottom-Center] RETAIL FOLD ANGLED — Same fold, rotated 30°.
[Bottom-Right] CASUAL DRAPE — Jacket draped over invisible surface or loosely tossed.

[Same supporting sections as t-shirt prompt]
```

---

## USAGE WORKFLOW

### Step 1: Complete Product Details Extraction
Before running 3x3 grid, fill out from Research Brief:

```
PRODUCT DETAILS TO INSERT:
- Product: [e.g., "Black hemp/bamboo blend t-shirt"]
- Fabric: [e.g., "51% Hemp, 31% Bamboo, 18% Organic Cotton"]
- Color: [e.g., "Jet black, matte finish"]
- Fit: [e.g., "Athletic fit, curved hem"]
- Label details: [e.g., "Tiny orange rectangular tag at bottom left hem, white 'UD' lettermark only"]
- Collar: [e.g., "Crew neck, ribbed collar"]
- Interior: [e.g., "Black interior neck tag with 'UndrDog' text and care instructions"]
```

### Step 2: Generate Grid
- Upload clean product photo
- Run appropriate prompt (t-shirt, pants, or outerwear)
- Save output as "[brand]-[product]-3x3-grid.png"

### Step 3: Reference in Aesthetic Prompts
When generating Type 3 aesthetic shots:

```
PRODUCT REFERENCE — CRITICAL:
Use the [FLAT LAY FRONT / FLAT LAY ANGLED / RETAIL FOLD / etc.