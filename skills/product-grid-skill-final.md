# PRODUCT GRID SKILL

Generate clean product reference images at multiple angles for use in downstream skills.

---

## INPUT

- Product reference image (upload)
- Product type (pouch, bottle, jar, tube, etc.)

---

## OUTPUT

2 clean product images on white background:
1. Front Hero
2. 3/4 Angle

---

## ANGLE 1: FRONT HERO

```
Professional commercial product photography.

REFERENCE IMAGE (CRITICAL — NON-NEGOTIABLE):
Use the uploaded product image as EXACT reference. CLONE the product design precisely — same colors, graphics, text, proportions. Do NOT interpret, modify, reimagine, or "improve" the design.

ANGLE:
Straight-on front view. Product centered, standing upright. Camera at eye-level, perpendicular to product face.

PRODUCT FORM:
[PRODUCT_TYPE] — matches reference exactly. Natural material properties, proper thickness/flexibility.

BACKGROUND:
Pure white (#FFFFFF) seamless backdrop. No gradients, no shadows on background.

LIGHTING:
Soft diffused studio light from front-left. Even illumination. Subtle shadow directly beneath product only.

PRODUCT FIDELITY (CRITICAL — NON-NEGOTIABLE):
• Product design EXACTLY matches reference — colors, graphics, text, layout
• ALL text LEGIBLE and CORRECTLY SPELLED
• Product appears as real photographed object
• Single product only

FORBIDDEN:
• Modified design elements
• Invented graphics or text
• Multiple products
• Background shadows or gradients
```

---

## ANGLE 2: 3/4 LEFT

```
Professional commercial product photography.

REFERENCE IMAGE (CRITICAL — NON-NEGOTIABLE):
Use the uploaded product image as EXACT reference. CLONE the product design precisely — same colors, graphics, text, proportions. Do NOT modify.

ANGLE:
Product rotated 25-30 degrees. Camera sees the front face at a slight angle, with a thin sliver of the LEFT side edge visible. Standard 3/4 product photography angle. Product standing upright.

PRODUCT FORM:
[PRODUCT_TYPE] — matches reference exactly. Shows natural material properties at angle. Thin profile visible on side.

BACKGROUND:
Pure white (#FFFFFF) seamless backdrop. No gradients.

LIGHTING:
Soft diffused studio light. Subtle shadow beneath product.

PRODUCT FIDELITY (CRITICAL — NON-NEGOTIABLE):
• Product design EXACTLY matches reference
• ALL text LEGIBLE and CORRECTLY SPELLED  
• Single product only
• Shows slight dimension/depth from angle

FORBIDDEN:
• Straight-on front view (must be angled)
• Multiple products
• Rigid box shape (if flexible packaging)
• Modified design
```

---

## PRODUCT TYPE VARIATIONS

### For Flexible Pouch (mylar, foil):
```
PRODUCT FORM:
Flexible stand-up mylar pouch — THIN profile, soft natural creases from flexible material. NOT rigid, NOT inflated, NOT puffy. Shows natural drape of flexible packaging.
```

### For Bottle:
```
PRODUCT FORM:
[Glass/plastic] bottle with [cap type]. Shows material properties — [transparency/opacity], proper reflections, label wrap. Natural bottle shape.
```

### For Jar:
```
PRODUCT FORM:
[Glass/plastic] jar with [lid type]. Shows material — [clear/opaque/frosted], proper reflections if glass. Lid sits naturally.
```

### For Tube:
```
PRODUCT FORM:
Squeezable tube with [cap type]. Shows flexibility of tube material, proper crimp at bottom, cap detail.
```

---

## USAGE

1. Upload product reference image
2. Identify product type
3. Generate ANGLE 1 (Front Hero)
4. Generate ANGLE 2 (3/4 Left)
5. Use outputs as references for Aesthetic Image Skill

---

## TESTED RESULTS

| Angle | Status | Notes |
|-------|--------|-------|
| Front Hero | ✅ Works | Reliable with reference lock |
| 3/4 Left | ✅ Works | 25-30° rotation reliable |
| 3/4 Right | ❌ Failed | AI duplicates or ignores |
| Flat Lay | ❌ Failed | AI keeps product upright |

Stick to Front Hero + 3/4 Left for consistent results.
