/**
 * MTRX AI V1 - Web Server with Real-time Grid & Campaign History
 */

require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const MTRXImageGenerator = require('./src/index');
const ImageHost = require('./src/utils/image-host');
const CopyResearchService = require('./src/services/copy-research');

/**
 * Create a 4:5 version from a 9:16 image by center cropping
 * @param {string} imageUrl - URL of the 9:16 image
 * @returns {Promise<string>} - Public URL of the cropped 4:5 image
 */
async function create45FromTall(imageUrl) {
  try {
    // Download the image
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    // Get image dimensions
    const metadata = await sharp(buffer).metadata();
    const { width, height } = metadata;

    // Calculate 4:5 crop dimensions (keep width, calculate target height)
    const targetHeight = Math.round(width * (5 / 4));

    // Center crop - remove equal amounts from top and bottom
    const cropTop = Math.round((height - targetHeight) / 2);

    // Extract center portion
    const croppedBuffer = await sharp(buffer)
      .extract({
        left: 0,
        top: cropTop,
        width: width,
        height: targetHeight
      })
      .png()
      .toBuffer();

    // Save to temp file and upload
    const tempPath = path.join('./output', `temp_45_${Date.now()}.png`);
    await fs.writeFile(tempPath, croppedBuffer);

    // Upload to get public URL
    const publicUrl = await ImageHost.upload(tempPath);

    // Clean up temp file
    await fs.unlink(tempPath).catch(() => {});

    return publicUrl;
  } catch (err) {
    console.error('   Error creating 4:5 crop:', err.message);
    return null;
  }
}

// Legacy function - kept for reference but no longer used
async function create916Version_legacy(imageUrl, outputPath) {
  try {
    // Download the image
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    // Get image dimensions
    const metadata = await sharp(buffer).metadata();
    const { width, height } = metadata;

    // Target 9:16 dimensions (keep width, calculate new height)
    const targetHeight = Math.round(width * (16 / 9));
    const extraHeight = targetHeight - height;
    const topPadding = Math.round(extraHeight / 2);
    const bottomPadding = extraHeight - topPadding;

    // Sample colors from top and bottom edges for natural extension
    const topStrip = await sharp(buffer).extract({ left: 0, top: 0, width: width, height: 5 }).raw().toBuffer();
    const bottomStrip = await sharp(buffer).extract({ left: 0, top: height - 5, width: width, height: 5 }).raw().toBuffer();

    // Calculate average color from top strip
    let topR = 0, topG = 0, topB = 0;
    for (let i = 0; i < topStrip.length; i += 3) {
      topR += topStrip[i];
      topG += topStrip[i + 1];
      topB += topStrip[i + 2];
    }
    const topPixels = topStrip.length / 3;
    topR = Math.round(topR / topPixels);
    topG = Math.round(topG / topPixels);
    topB = Math.round(topB / topPixels);

    // Calculate average color from bottom strip
    let botR = 0, botG = 0, botB = 0;
    for (let i = 0; i < bottomStrip.length; i += 3) {
      botR += bottomStrip[i];
      botG += bottomStrip[i + 1];
      botB += bottomStrip[i + 2];
    }
    const botPixels = bottomStrip.length / 3;
    botR = Math.round(botR / botPixels);
    botG = Math.round(botG / botPixels);
    botB = Math.round(botB / botPixels);

    // Check if colors are too bright/saturated (like red banners) - fall back to dark
    const isTooBright = (r, g, b) => {
      const brightness = (r + g + b) / 3;
      const maxChannel = Math.max(r, g, b);
      const minChannel = Math.min(r, g, b);
      const saturation = maxChannel > 0 ? (maxChannel - minChannel) / maxChannel : 0;
      // Too bright (>80) or too saturated with non-grey color
      return brightness > 80 || (saturation > 0.4 && brightness > 40);
    };

    // Use dark fallback if edge colors are too bright/saturated
    if (isTooBright(topR, topG, topB)) {
      topR = 15; topG = 15; topB = 15;
    }
    if (isTooBright(botR, botG, botB)) {
      botR = 15; botG = 15; botB = 15;
    }

    // Create top extension with sampled color
    const topExtension = await sharp({
      create: { width: width, height: topPadding, channels: 3, background: { r: topR, g: topG, b: topB } }
    }).png().toBuffer();

    // Create bottom extension with sampled color
    const bottomExtension = await sharp({
      create: { width: width, height: bottomPadding, channels: 3, background: { r: botR, g: botG, b: botB } }
    }).png().toBuffer();

    // Composite: stack top extension + original + bottom extension
    await sharp({
      create: { width: width, height: targetHeight, channels: 3, background: { r: topR, g: topG, b: topB } }
    })
      .composite([
        { input: topExtension, top: 0, left: 0 },
        { input: buffer, top: topPadding, left: 0 },
        { input: bottomExtension, top: topPadding + height, left: 0 }
      ])
      .png()
      .toFile(outputPath);

    return outputPath;
  } catch (err) {
    console.error('   Failed to create 9:16 version:', err.message);
    return null;
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

let publicUrl = null;
const CAMPAIGNS_FILE = './data/campaigns.json';
const REGEN_CACHE_FILE = './data/regen-cache.json';

// Store image generation params for regeneration (persisted to file)
let imageParamsCache = new Map();

async function loadRegenCache() {
  try {
    const data = await fs.readFile(REGEN_CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    imageParamsCache = new Map(Object.entries(parsed));
  } catch {
    imageParamsCache = new Map();
  }
}

async function saveRegenCache() {
  const obj = Object.fromEntries(imageParamsCache);
  await fs.writeFile(REGEN_CACHE_FILE, JSON.stringify(obj, null, 2));
}

const storage = multer.diskStorage({
  destination: './uploads',
  filename: (req, file, cb) => {
    cb(null, 'product_' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

async function ensureDirs() {
  await fs.mkdir('./uploads', { recursive: true });
  await fs.mkdir('./output', { recursive: true });
  await fs.mkdir('./data', { recursive: true });
}

// Campaign storage functions
async function loadCampaigns() {
  try {
    const data = await fs.readFile(CAMPAIGNS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveCampaign(campaign) {
  const campaigns = await loadCampaigns();
  campaigns.unshift(campaign); // Add to beginning
  await fs.writeFile(CAMPAIGNS_FILE, JSON.stringify(campaigns, null, 2));
  return campaigns;
}

app.use('/output', express.static('output'));
app.use('/uploads', express.static('uploads'));
app.use(express.json());

// Load directions config
let directionsConfig = null;
async function loadDirectionsConfig() {
  const configPath = path.join(__dirname, 'config/directions.json');
  const content = await fs.readFile(configPath, 'utf-8');
  directionsConfig = JSON.parse(content);
}

// HTML Frontend - Real-time Grid with Campaign History
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MTRX AI</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #0a0a0a; min-height: 100vh; color: #fff; }
    .container { max-width: 1400px; margin: 0 auto; padding: 40px 24px; }
    .badge { display: inline-block; background: linear-gradient(90deg, #06b6d4, #3b82f6); color: #fff; font-size: 11px; font-weight: 600; padding: 6px 12px; border-radius: 20px; margin-bottom: 16px; text-transform: uppercase; }
    h1 { font-size: 42px; font-weight: 700; margin-bottom: 8px; }
    .subtitle { color: #666; font-size: 15px; margin-bottom: 32px; }
    h2 { font-size: 20px; font-weight: 600; margin-bottom: 16px; color: #fff; }

    /* Setup Panel */
    .setup-panel { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 40px; }
    @media (max-width: 900px) { .setup-panel { grid-template-columns: 1fr; } }
    .card { background: #111; border: 1px solid #222; border-radius: 12px; padding: 20px; }
    .card-title { color: #666; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 16px; letter-spacing: 0.5px; }

    /* Type Grid */
    .type-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .type-btn { background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 12px; color: #888; font-size: 12px; cursor: pointer; text-align: left; transition: all 0.15s; }
    .type-btn:hover { border-color: #444; color: #fff; }
    .type-btn.selected { background: rgba(6, 182, 212, 0.1); border-color: #06b6d4; color: #06b6d4; }
    .type-btn .name { font-weight: 600; display: block; }
    .type-btn .desc { font-size: 10px; color: #555; margin-top: 2px; }
    .type-btn.selected .desc { color: rgba(6, 182, 212, 0.6); }

    /* Upload */
    .upload-box { border: 2px dashed #333; border-radius: 10px; padding: 40px; text-align: center; cursor: pointer; transition: all 0.15s; }
    .upload-box:hover { border-color: #06b6d4; }
    .upload-box.has-file { border-style: solid; border-color: #06b6d4; padding: 16px; }
    .upload-box h3 { font-size: 13px; margin-bottom: 4px; }
    .upload-box p { color: #555; font-size: 11px; }
    #preview, #staticPreview { max-width: 100%; max-height: 150px; border-radius: 8px; display: none; }
    .url-input { margin-top: 12px; }
    .url-input input { width: 100%; background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 10px 14px; color: #fff; font-size: 13px; outline: none; }
    .url-input input:focus { border-color: #06b6d4; }

    /* Launch Button */
    .launch-btn { width: 100%; background: linear-gradient(90deg, #06b6d4, #3b82f6); border: none; border-radius: 10px; padding: 14px; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; margin-top: 16px; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .launch-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .launch-btn .count { background: rgba(0,0,0,0.2); padding: 3px 10px; border-radius: 10px; font-size: 12px; }

    /* Campaign Status */
    .campaign-status { display: none; margin-bottom: 24px; }
    .campaign-status.active { display: flex; align-items: center; justify-content: space-between; }
    .status-left { display: flex; align-items: center; gap: 16px; }
    .status-label { color: #666; font-size: 11px; text-transform: uppercase; }
    .status-count { font-size: 14px; font-weight: 600; }
    .progress-bar { width: 200px; height: 4px; background: #222; border-radius: 2px; overflow: hidden; }
    .progress-fill { height: 100%; background: #06b6d4; transition: width 0.3s; }
    .download-all { background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 8px 16px; color: #888; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; }
    .download-all:hover { border-color: #06b6d4; color: #fff; }

    /* Image Grid */
    .image-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-bottom: 48px; }
    .image-card { background: #111; border: 1px solid #222; border-radius: 10px; overflow: hidden; transition: all 0.2s; }
    .image-card.forging { border-color: #06b6d4; }
    .image-card.error { border-color: #ef4444; background: rgba(239, 68, 68, 0.1); }
    .image-placeholder { aspect-ratio: 1; background: #0a0a0a; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .spinner { width: 32px; height: 32px; border: 2px solid #333; border-top-color: #06b6d4; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 12px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .status-text { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
    .status-text.queue { color: #555; }
    .status-text.forging { color: #06b6d4; }
    .image-card img { width: 100%; aspect-ratio: 4/5; object-fit: contain; display: block; background: #0a0a0a; }
    .image-card .info { padding: 12px; }
    .image-card .direction { font-weight: 600; font-size: 12px; text-transform: uppercase; margin-bottom: 4px; }
    .image-card .type-badge { color: #06b6d4; font-size: 10px; }
    .image-card .error-msg { color: #ef4444; font-size: 11px; margin-top: 8px; }
    .image-card .actions { display: flex; gap: 6px; margin-top: 10px; }
    .image-card .actions a { flex: 1; text-align: center; padding: 8px; font-size: 11px; font-weight: 500; border-radius: 6px; text-decoration: none; }
    .view-btn { background: #1a1a1a; color: #fff; border: 1px solid #333; }
    .download-btn { background: #06b6d4; color: #000; }
    .regen-btn { background: #f59e0b; color: #000; cursor: pointer; border: none; font-family: inherit; }
    .regen-btn:hover { background: #d97706; }
    .regen-btn.loading { opacity: 0.6; cursor: wait; }
    .flip-btn { background: #8b5cf6; color: #fff; cursor: pointer; border: none; font-family: inherit; }
    .flip-btn:hover { background: #7c3aed; }
    .image-card img.flipped { transform: scaleX(-1); }

    /* Aspect ratio preview tabs */
    .aspect-tab { background: #1a1a1a; border: 1px solid #333; border-radius: 4px; padding: 4px 10px; color: #888; font-size: 11px; cursor: pointer; font-family: inherit; }
    .aspect-tab:hover { border-color: #444; color: #fff; }
    .aspect-tab.active { background: #06b6d4; border-color: #06b6d4; color: #000; font-weight: 600; }

    /* Hide setup when generating */
    .setup-panel.hidden { display: none; }
    .new-btn { background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 10px 20px; color: #fff; font-size: 13px; cursor: pointer; margin-bottom: 24px; }
    .new-btn:hover { border-color: #06b6d4; }

    /* Previous Campaigns Section */
    .campaigns-section { margin-top: 48px; padding-top: 32px; border-top: 1px solid #222; }
    .campaigns-section h2 { margin-bottom: 20px; }
    .campaigns-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .campaign-card { background: #111; border: 1px solid #222; border-radius: 12px; overflow: hidden; cursor: pointer; transition: all 0.2s; }
    .campaign-card:hover { border-color: #333; transform: translateY(-2px); }
    .campaign-thumb { position: relative; aspect-ratio: 16/10; overflow: hidden; }
    .campaign-thumb img { width: 100%; height: 100%; object-fit: cover; }
    .campaign-thumb .overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%); }
    .campaign-thumb .date-overlay { position: absolute; bottom: 12px; left: 12px; font-size: 13px; font-weight: 600; }
    .campaign-thumb .asset-count { position: absolute; bottom: 12px; right: 12px; background: rgba(0,0,0,0.6); padding: 4px 10px; border-radius: 12px; font-size: 11px; color: #888; }
    .campaign-info { padding: 14px; }
    .campaign-name { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
    .campaign-brand { color: #666; font-size: 12px; }
    .empty-state { text-align: center; padding: 60px 20px; color: #555; }
    .empty-state svg { width: 48px; height: 48px; margin-bottom: 16px; opacity: 0.3; }
    .empty-state p { font-size: 14px; }

    /* Mode Toggle */
    .mode-toggle { display: flex; gap: 8px; margin-bottom: 24px; }
    .mode-btn { background: #1a1a1a; border: 1px solid #333; border-radius: 10px; padding: 12px 20px; color: #888; font-size: 13px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.15s; }
    .mode-btn:hover { border-color: #444; color: #fff; }
    .mode-btn.active { background: linear-gradient(90deg, rgba(6, 182, 212, 0.15), rgba(59, 130, 246, 0.15)); border-color: #06b6d4; color: #06b6d4; }
    .mode-btn svg { opacity: 0.6; }
    .mode-btn.active svg { opacity: 1; }

    /* Static Designer Styles */
    .static-grid { grid-template-columns: repeat(3, 1fr); }
    @media (max-width: 700px) { .static-grid { grid-template-columns: repeat(2, 1fr); } }
    .static-launch { background: linear-gradient(90deg, #8b5cf6, #ec4899); }
    .hidden { display: none !important; }
    #staticDropZone { padding: 24px; min-height: auto; }
    #staticDropZone.has-file { padding: 16px; }
    #staticPreview { max-height: 120px; object-fit: contain; }

    /* Campaign Detail Modal */
    .modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 1000; overflow-y: auto; }
    .modal.active { display: block; }
    .modal-content { max-width: 1200px; margin: 40px auto; padding: 24px; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .modal-header h2 { font-size: 24px; }
    .close-modal { background: #222; border: none; color: #fff; width: 40px; height: 40px; border-radius: 8px; cursor: pointer; font-size: 20px; }
    .close-modal:hover { background: #333; }
    .modal-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
    .modal-image { border-radius: 8px; overflow: hidden; background: #111; }
    .modal-image img { width: 100%; aspect-ratio: 1; object-fit: cover; }
    .modal-image .info { padding: 10px; }
    .modal-image .direction { font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .modal-image .type { color: #06b6d4; font-size: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <span class="badge">AI Campaign Generator</span>
    <h1>MTRX AI</h1>
    <p class="subtitle">Upload a product to instantly generate high-fidelity campaign assets.</p>

    <!-- Mode Toggle -->
    <div class="mode-toggle">
      <button class="mode-btn active" data-mode="photography">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        Photography
      </button>
      <button class="mode-btn" data-mode="static-designer">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        Static Designer
      </button>
    </div>

    <!-- PHOTOGRAPHY SECTION -->
    <div class="setup-panel" id="setupPanel">
      <div class="card">
        <div class="card-title">Image Types (select multiple)</div>
        <div class="type-grid">
          <button class="type-btn selected" data-type="aesthetic"><span class="name">Aesthetic</span><span class="desc">Styled product shots</span></button>
          <button class="type-btn" data-type="influencer"><span class="name">Influencer</span><span class="desc">Person + product</span></button>
          <button class="type-btn" data-type="ugc"><span class="name">UGC</span><span class="desc">Selfie style</span></button>
          <button class="type-btn" data-type="model"><span class="name">Model</span><span class="desc">Face/body shots</span></button>
        </div>
      </div>
      <div class="card">
        <div class="upload-box" id="dropZone">
          <img id="preview" alt="Preview">
          <h3 id="uploadText">Upload Product Image</h3>
          <p>PNG, JPG up to 50MB</p>
          <input type="file" id="imageInput" accept="image/*" hidden>
        </div>
        <div class="url-input">
          <input type="url" id="urlInput" placeholder="Brand website URL">
        </div>
        <button class="launch-btn" id="launchBtn" disabled>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          Launch Campaign
          <span class="count" id="imageCount">2 images</span>
        </button>
      </div>
    </div>

    <!-- STATIC DESIGNER SECTION -->
    <div class="setup-panel hidden" id="staticDesignerPanel">
      <div class="card">
        <div class="card-title">Static Ad Types (select multiple)</div>
        <div class="type-grid static-grid">
          <button class="type-btn selected" data-static="type1"><span class="name">Product Hero</span><span class="desc">Clean product focus</span></button>
          <button class="type-btn" data-static="type2"><span class="name">Meme Static</span><span class="desc">Viral meme format</span></button>
          <button class="type-btn" data-static="type3"><span class="name">Aesthetic Offer</span><span class="desc">Lifestyle + promo</span></button>
          <button class="type-btn" data-static="type4"><span class="name">Illustrated</span><span class="desc">Hand-drawn style</span></button>
          <button class="type-btn" data-static="type5"><span class="name">Vintage Magazine</span><span class="desc">Retro editorial</span></button>
          <button class="type-btn" data-static="type6"><span class="name">UGC Caption</span><span class="desc">Model + handwritten text</span></button>
        </div>
        <div style="margin-top: 16px;">
          <label style="color: #888; font-size: 12px; display: block; margin-bottom: 8px;">Variants per type (different angles)</label>
          <div class="variant-selector" style="display: flex; gap: 8px;">
            <button class="variant-btn" data-variants="1" style="padding: 8px 16px; background: #1a1a1a; border: 1px solid #333; color: #fff; border-radius: 6px; cursor: pointer;">1</button>
            <button class="variant-btn selected" data-variants="2" style="padding: 8px 16px; background: #3b82f6; border: 1px solid #3b82f6; color: #fff; border-radius: 6px; cursor: pointer;">2</button>
            <button class="variant-btn" data-variants="3" style="padding: 8px 16px; background: #1a1a1a; border: 1px solid #333; color: #fff; border-radius: 6px; cursor: pointer;">3</button>
            <button class="variant-btn" data-variants="4" style="padding: 8px 16px; background: #1a1a1a; border: 1px solid #333; color: #fff; border-radius: 6px; cursor: pointer;">4</button>
          </div>
        </div>
      </div>
      <div class="card">
        <div style="display: flex; gap: 12px;">
          <div class="upload-box" id="staticDropZone" style="flex: 1;">
            <img id="staticPreview" alt="Preview">
            <h3 id="staticUploadText">Product Image</h3>
            <p>PNG, JPG up to 50MB</p>
            <input type="file" id="staticImageInput" accept="image/*" hidden>
          </div>
          <div class="upload-box" id="logoDropZone" style="flex: 0 0 120px; min-height: 100px;">
            <img id="logoPreview" alt="Logo" style="max-height: 60px;">
            <h3 id="logoUploadText" style="font-size: 12px;">Logo (optional)</h3>
            <p style="font-size: 10px;">PNG with transparency</p>
            <input type="file" id="logoInput" accept="image/*" hidden>
          </div>
        </div>
        <div class="url-input">
          <input type="url" id="staticUrlInput" placeholder="Landing page URL">
        </div>
        <div class="url-input" style="margin-top: 8px;">
          <input type="text" id="angleInput" placeholder="Proposed angle (e.g., durability, anti-fast-fashion, fit/confidence, health/toxicity)">
        </div>
        <button class="launch-btn static-launch" id="staticLaunchBtn" disabled>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          Generate Statics
          <span class="count" id="staticCount">1 static</span>
        </button>
      </div>
    </div>

    <button class="new-btn" id="newBtn" style="display:none;">+ New Campaign</button>

    <div class="campaign-status" id="campaignStatus">
      <div class="status-left">
        <div><span class="status-label">Campaign Status</span><br><span class="status-count" id="progressText">0 / 0</span></div>
        <div class="progress-bar"><div class="progress-fill" id="progressBar" style="width:0%"></div></div>
      </div>
      <button class="download-all" id="downloadAll">Download All (<span id="completedCount">0</span>)</button>
    </div>

    <div class="image-grid" id="imageGrid"></div>

    <!-- Previous Campaigns Section -->
    <div class="campaigns-section" id="campaignsSection">
      <h2>Your Campaigns</h2>
      <div class="campaigns-grid" id="campaignsGrid">
        <div class="empty-state" id="emptyState">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          <p>No campaigns yet. Generate your first one above!</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Campaign Detail Modal -->
  <div class="modal" id="campaignModal">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="modalTitle">Campaign</h2>
        <button class="close-modal" id="closeModal">&times;</button>
      </div>
      <div class="modal-grid" id="modalGrid"></div>
    </div>
  </div>

  <script>
    const setupPanel = document.getElementById('setupPanel');
    const dropZone = document.getElementById('dropZone');
    const imageInput = document.getElementById('imageInput');
    const preview = document.getElementById('preview');
    const uploadText = document.getElementById('uploadText');
    const urlInput = document.getElementById('urlInput');
    const launchBtn = document.getElementById('launchBtn');
    const imageCount = document.getElementById('imageCount');
    const campaignStatus = document.getElementById('campaignStatus');
    const progressText = document.getElementById('progressText');
    const progressBar = document.getElementById('progressBar');
    const completedCount = document.getElementById('completedCount');
    const imageGrid = document.getElementById('imageGrid');
    const newBtn = document.getElementById('newBtn');
    const campaignsGrid = document.getElementById('campaignsGrid');
    const emptyState = document.getElementById('emptyState');
    const campaignModal = document.getElementById('campaignModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalGrid = document.getElementById('modalGrid');
    const closeModal = document.getElementById('closeModal');

    let selectedFile = null;
    let selectedTypes = ['aesthetic'];
    let imageCards = {};
    let totalImages = 0;
    let completed = 0;
    let currentCampaignImages = [];
    let currentCampaignId = null;

    // Static Designer state
    let currentMode = 'photography';
    let staticSelectedFile = null;
    let selectedStaticTypes = ['type1'];
    let variantsPerType = 2; // Default to 2 variants per type
    const staticDesignerPanel = document.getElementById('staticDesignerPanel');
    const staticDropZone = document.getElementById('staticDropZone');
    const staticImageInput = document.getElementById('staticImageInput');
    const staticPreview = document.getElementById('staticPreview');
    const staticUploadText = document.getElementById('staticUploadText');
    const staticUrlInput = document.getElementById('staticUrlInput');
    const angleInput = document.getElementById('angleInput');
    const logoDropZone = document.getElementById('logoDropZone');
    const logoInput = document.getElementById('logoInput');
    const logoPreview = document.getElementById('logoPreview');
    const logoUploadText = document.getElementById('logoUploadText');
    let logoFile = null;
    const staticLaunchBtn = document.getElementById('staticLaunchBtn');
    const staticCount = document.getElementById('staticCount');

    // Mode toggle
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.mode;

        if (currentMode === 'photography') {
          setupPanel.classList.remove('hidden');
          staticDesignerPanel.classList.add('hidden');
        } else {
          setupPanel.classList.add('hidden');
          staticDesignerPanel.classList.remove('hidden');
        }
      });
    });

    // Static type selection
    document.querySelectorAll('.static-grid .type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('selected');
        const type = btn.dataset.static;
        if (btn.classList.contains('selected')) {
          if (!selectedStaticTypes.includes(type)) selectedStaticTypes.push(type);
        } else {
          selectedStaticTypes = selectedStaticTypes.filter(t => t !== type);
        }
        updateStaticCount();
      });
    });

    // Variant selector
    document.querySelectorAll('.variant-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.variant-btn').forEach(b => {
          b.classList.remove('selected');
          b.style.background = '#1a1a1a';
          b.style.borderColor = '#333';
        });
        btn.classList.add('selected');
        btn.style.background = '#3b82f6';
        btn.style.borderColor = '#3b82f6';
        variantsPerType = parseInt(btn.dataset.variants);
        updateStaticCount();
      });
    });

    function updateStaticCount() {
      const totalCount = selectedStaticTypes.length * variantsPerType;
      staticCount.textContent = totalCount + (totalCount === 1 ? ' static' : ' statics');
      updateStaticLaunchBtn();
    }

    // Static upload handlers
    staticDropZone.addEventListener('click', () => staticImageInput.click());
    staticDropZone.addEventListener('dragover', e => { e.preventDefault(); staticDropZone.style.borderColor = '#8b5cf6'; });
    staticDropZone.addEventListener('dragleave', () => { staticDropZone.style.borderColor = '#333'; });
    staticDropZone.addEventListener('drop', e => { e.preventDefault(); staticDropZone.style.borderColor = '#333'; if (e.dataTransfer.files.length) handleStaticFile(e.dataTransfer.files[0]); });
    staticImageInput.addEventListener('change', () => { if (staticImageInput.files[0]) handleStaticFile(staticImageInput.files[0]); });

    // Logo upload handlers
    logoDropZone.addEventListener('click', () => logoInput.click());
    logoDropZone.addEventListener('dragover', e => { e.preventDefault(); logoDropZone.style.borderColor = '#8b5cf6'; });
    logoDropZone.addEventListener('dragleave', () => { logoDropZone.style.borderColor = '#333'; });
    logoDropZone.addEventListener('drop', e => { e.preventDefault(); logoDropZone.style.borderColor = '#333'; if (e.dataTransfer.files.length) handleLogoFile(e.dataTransfer.files[0]); });
    logoInput.addEventListener('change', () => { if (logoInput.files[0]) handleLogoFile(logoInput.files[0]); });

    function handleLogoFile(file) {
      logoFile = file;
      const reader = new FileReader();
      reader.onload = e => {
        logoPreview.src = e.target.result;
        logoPreview.style.display = 'block';
        logoUploadText.style.display = 'none';
        logoDropZone.querySelector('p').style.display = 'none';
      };
      reader.readAsDataURL(file);
    }

    function handleStaticFile(file) {
      staticSelectedFile = file;
      const reader = new FileReader();
      reader.onload = e => {
        staticPreview.src = e.target.result;
        staticPreview.style.display = 'block';
        staticUploadText.style.display = 'none';
        staticDropZone.querySelector('p').style.display = 'none';
        staticDropZone.classList.add('has-file');
        updateStaticLaunchBtn();
      };
      reader.readAsDataURL(file);
    }

    staticUrlInput.addEventListener('input', updateStaticLaunchBtn);
    function updateStaticLaunchBtn() {
      staticLaunchBtn.disabled = !(staticSelectedFile && staticUrlInput.value.trim() && selectedStaticTypes.length > 0);
    }

    // Static Designer Launch
    staticLaunchBtn.addEventListener('click', async () => {
      if (!staticSelectedFile || !staticUrlInput.value.trim() || selectedStaticTypes.length === 0) return;

      staticDesignerPanel.classList.add('hidden');
      document.querySelector('.mode-toggle').style.display = 'none';
      newBtn.style.display = 'block';
      campaignStatus.classList.add('active');
      imageGrid.innerHTML = '';
      imageCards = {};
      completed = 0;
      totalImages = selectedStaticTypes.length * variantsPerType;
      progressText.textContent = '0 / ' + totalImages;
      completedCount.textContent = '0';
      currentCampaignImages = [];
      currentCampaignId = Date.now().toString();

      const formData = new FormData();
      formData.append('image', staticSelectedFile);
      formData.append('url', staticUrlInput.value.trim());
      formData.append('angle', angleInput.value.trim());
      formData.append('staticTypes', JSON.stringify(selectedStaticTypes));
      formData.append('variantsPerType', variantsPerType.toString());
      formData.append('campaignId', currentCampaignId);
      if (logoFile) {
        formData.append('logo', logoFile);
      }

      try {
        const response = await fetch('/generate-statics', { method: 'POST', body: formData });
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                handleEvent(data);
              } catch (e) {}
            }
          }
        }

        loadCampaigns();
      } catch (err) {
        console.error('Error:', err);
      }
    });

    // Load previous campaigns on page load
    loadCampaigns();

    async function loadCampaigns() {
      try {
        const res = await fetch('/api/campaigns');
        const campaigns = await res.json();
        renderCampaigns(campaigns);
      } catch (err) {
        console.error('Failed to load campaigns:', err);
      }
    }

    function renderCampaigns(campaigns) {
      if (campaigns.length === 0) {
        emptyState.style.display = 'block';
        return;
      }
      emptyState.style.display = 'none';

      // Remove old campaign cards (keep empty state)
      const oldCards = campaignsGrid.querySelectorAll('.campaign-card');
      oldCards.forEach(card => card.remove());

      campaigns.forEach(campaign => {
        const card = document.createElement('div');
        card.className = 'campaign-card';
        card.onclick = () => openCampaignModal(campaign);

        const successfulImages = campaign.images.filter(img => img.success);
        const thumbUrl = successfulImages[0]?.url || '';
        const date = new Date(campaign.createdAt);
        const dateStr = (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();

        card.innerHTML =
          '<div class="campaign-thumb">' +
            (thumbUrl ? '<img src="' + thumbUrl + '" alt="Campaign thumbnail">' : '<div style="background:#1a1a1a;width:100%;height:100%;"></div>') +
            '<div class="overlay"></div>' +
            '<div class="date-overlay">' + (campaign.name || 'Campaign ' + dateStr) + '</div>' +
            '<div class="asset-count">' + successfulImages.length + ' assets</div>' +
          '</div>' +
          '<div class="campaign-info">' +
            '<div class="campaign-name">' + (campaign.brand || 'Unknown Brand') + '</div>' +
            '<div class="campaign-brand">' + campaign.types.join(', ') + '</div>' +
          '</div>';

        campaignsGrid.appendChild(card);
      });
    }

    function openCampaignModal(campaign) {
      const date = new Date(campaign.createdAt);
      const dateStr = (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();
      modalTitle.textContent = campaign.name || 'Campaign ' + dateStr;

      modalGrid.innerHTML = '';
      campaign.images.filter(img => img.success).forEach(img => {
        const div = document.createElement('div');
        div.className = 'modal-image';
        div.innerHTML =
          '<img src="' + img.url + '" alt="' + img.direction + '">' +
          '<div class="info">' +
            '<div class="direction">' + img.direction.replace(/_/g, ' ') + '</div>' +
            '<div class="type">' + img.imageType.toUpperCase() + '</div>' +
          '</div>';
        modalGrid.appendChild(div);
      });

      campaignModal.classList.add('active');
    }

    closeModal.addEventListener('click', () => {
      campaignModal.classList.remove('active');
    });

    campaignModal.addEventListener('click', (e) => {
      if (e.target === campaignModal) {
        campaignModal.classList.remove('active');
      }
    });

    // Type selection (photography only - scope to setupPanel)
    document.querySelectorAll('#setupPanel .type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('selected');
        const type = btn.dataset.type;
        if (btn.classList.contains('selected')) {
          if (!selectedTypes.includes(type)) selectedTypes.push(type);
        } else {
          selectedTypes = selectedTypes.filter(t => t !== type);
        }
        updateCount();
      });
    });

    function updateCount() {
      const count = selectedTypes.length * 2;
      imageCount.textContent = count + ' images';
      updateLaunchBtn();
    }

    // Upload
    dropZone.addEventListener('click', () => imageInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = '#06b6d4'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = '#333'; });
    dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.style.borderColor = '#333'; if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });
    imageInput.addEventListener('change', () => { if (imageInput.files[0]) handleFile(imageInput.files[0]); });

    function handleFile(file) {
      selectedFile = file;
      const reader = new FileReader();
      reader.onload = e => {
        preview.src = e.target.result;
        preview.style.display = 'block';
        uploadText.style.display = 'none';
        dropZone.querySelector('p').style.display = 'none';
        dropZone.classList.add('has-file');
        updateLaunchBtn();
      };
      reader.readAsDataURL(file);
    }

    urlInput.addEventListener('input', updateLaunchBtn);
    function updateLaunchBtn() {
      launchBtn.disabled = !(selectedFile && urlInput.value.trim() && selectedTypes.length > 0);
    }

    // Launch
    launchBtn.addEventListener('click', async () => {
      if (!selectedFile || !urlInput.value.trim() || selectedTypes.length === 0) return;

      setupPanel.classList.add('hidden');
      document.querySelector('.mode-toggle').style.display = 'none';
      newBtn.style.display = 'block';
      campaignStatus.classList.add('active');
      imageGrid.innerHTML = '';
      imageCards = {};
      completed = 0;
      totalImages = selectedTypes.length * 2;
      progressText.textContent = '0 / ' + totalImages;
      completedCount.textContent = '0';
      currentCampaignImages = [];
      currentCampaignId = Date.now().toString();

      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('url', urlInput.value.trim());
      formData.append('types', JSON.stringify(selectedTypes));
      formData.append('campaignId', currentCampaignId);

      try {
        const response = await fetch('/generate', { method: 'POST', body: formData });
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                handleEvent(data);
              } catch (e) {}
            }
          }
        }

        // Reload campaigns after generation
        loadCampaigns();
      } catch (err) {
        console.error('Error:', err);
      }
    });

    function handleEvent(data) {
      if (data.type === 'init') {
        totalImages = data.images.length;
        progressText.textContent = '0 / ' + totalImages;
        data.images.forEach(img => createCard(img));
      } else if (data.type === 'start') {
        updateCardStatus(data.id, 'forging');
      } else if (data.type === 'complete') {
        updateCardComplete(data.id, data.url, data.url916, data.direction, data.imageType);
        currentCampaignImages.push({ id: data.id, url: data.url, url916: data.url916, success: true, direction: data.direction, imageType: data.imageType });
        completed++;
        progressText.textContent = completed + ' / ' + totalImages;
        progressBar.style.width = (completed / totalImages * 100) + '%';
        completedCount.textContent = completed;
      } else if (data.type === 'error') {
        updateCardError(data.id, data.error);
        currentCampaignImages.push({ id: data.id, success: false, error: data.error, direction: data.direction, imageType: data.imageType });
        completed++;
        progressText.textContent = completed + ' / ' + totalImages;
        progressBar.style.width = (completed / totalImages * 100) + '%';
      }
    }

    function createCard(img) {
      const card = document.createElement('div');
      card.className = 'image-card';
      card.id = 'card-' + img.id;
      card.innerHTML = '<div class="image-placeholder"><div class="spinner" style="display:none;"></div><span class="status-text queue">Queue</span></div><div class="info"><div class="direction">' + img.direction.replace(/_/g, ' ') + '</div><div class="type-badge">' + img.imageType.toUpperCase() + '</div></div>';
      imageGrid.appendChild(card);
      imageCards[img.id] = card;
    }

    function updateCardStatus(id, status) {
      const card = imageCards[id];
      if (!card) return;
      card.classList.add('forging');
      const placeholder = card.querySelector('.image-placeholder');
      placeholder.querySelector('.spinner').style.display = 'block';
      placeholder.querySelector('.status-text').className = 'status-text forging';
      placeholder.querySelector('.status-text').textContent = 'FORGING';
    }

    function updateCardComplete(id, url, url916, direction, imageType) {
      const card = imageCards[id];
      if (!card) return;
      card.classList.remove('forging');
      card.dataset.direction = direction;
      card.dataset.imageType = imageType;
      card.dataset.url = url;
      card.dataset.url916 = url916 || '';
      const placeholder = card.querySelector('.image-placeholder');

      // Add aspect ratio toggle tabs above image
      let tabsHtml = '<div class="aspect-tabs" style="display:flex;gap:4px;margin-bottom:8px;padding:0 8px;">';
      tabsHtml += '<button class="aspect-tab active" data-aspect="4:5" onclick="switchAspect(' + id + ', \\'4:5\\')">4:5</button>';
      if (url916) {
        tabsHtml += '<button class="aspect-tab" data-aspect="9:16" onclick="switchAspect(' + id + ', \\'9:16\\')">9:16</button>';
      }
      tabsHtml += '</div>';

      placeholder.outerHTML = tabsHtml + '<img src="' + url + '" alt="Generated" id="img-' + id + '" data-url45="' + url + '" data-url916="' + (url916 || '') + '">';
      const info = card.querySelector('.info');

      // Build action buttons
      let actions = '<div class="actions">';
      actions += '<a href="' + url + '" target="_blank" class="view-btn">4:5</a>';
      if (url916) {
        actions += '<a href="' + url916 + '" target="_blank" class="view-btn" style="background:#8b5cf6;color:#fff;">9:16</a>';
      }
      actions += '<button class="download-btn" onclick="downloadImage(\\'' + url + '\\', \\'' + direction + '_4x5.png\\')">DL</button>';
      if (url916) {
        actions += '<button class="download-btn" style="background:#8b5cf6;" onclick="downloadImage(\\'' + url916 + '\\', \\'' + direction + '_9x16.png\\')">DL</button>';
      }
      actions += '<button class="regen-btn" onclick="regenerateImage(' + id + ')">Regen</button>';
      actions += '</div>';
      info.innerHTML += actions;
    }

    // Switch between 4:5 and 9:16 preview
    function switchAspect(id, aspect) {
      const img = document.getElementById('img-' + id);
      if (!img) return;
      const card = imageCards[id];
      if (!card) return;

      // Update image source
      if (aspect === '9:16' && img.dataset.url916) {
        img.src = img.dataset.url916;
        img.style.aspectRatio = '9/16';
      } else {
        img.src = img.dataset.url45;
        img.style.aspectRatio = '4/5';
      }

      // Update active tab
      const tabs = card.querySelectorAll('.aspect-tab');
      tabs.forEach(tab => {
        if (tab.dataset.aspect === aspect) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });
    }

    // Download single image as blob (handles cross-origin)
    async function downloadImage(url, filename) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } catch (err) {
        console.error('Download failed:', err);
        window.open(url, '_blank');
      }
    }

    function updateCardError(id, error) {
      const card = imageCards[id];
      if (!card) return;
      card.classList.remove('forging');
      card.classList.add('error');
      const placeholder = card.querySelector('.image-placeholder');
      placeholder.innerHTML = '<span class="status-text" style="color:#ef4444;">FAILED</span>';
      const info = card.querySelector('.info');
      info.innerHTML += '<div class="error-msg">' + error + '</div>';
    }

    // Download All button - handles cross-origin images (both 4:5 and 9:16)
    document.getElementById('downloadAll').addEventListener('click', async () => {
      const successfulImages = currentCampaignImages.filter(img => img.success && img.url);
      if (successfulImages.length === 0) {
        alert('No images to download yet');
        return;
      }

      // Download each image by fetching as blob (both 4:5 and 9:16)
      for (let i = 0; i < successfulImages.length; i++) {
        const img = successfulImages[i];
        // Download 4:5 version
        try {
          const response = await fetch(img.url);
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = img.imageType + '_' + img.direction + '_4x5.png';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
          await new Promise(r => setTimeout(r, 300));
        } catch (err) {
          console.error('Failed to download 4:5:', img.url, err);
        }

        // Download 9:16 version if available
        if (img.url916) {
          try {
            const response = await fetch(img.url916);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = img.imageType + '_' + img.direction + '_9x16.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
            await new Promise(r => setTimeout(r, 300));
          } catch (err) {
            console.error('Failed to download 9:16:', img.url916, err);
          }
        }
      }
    });

    // Flip/mirror an image horizontally
    function flipImage(id) {
      const card = imageCards[id];
      if (!card) return;
      const img = card.querySelector('img');
      if (!img) return;

      // Toggle flipped class
      img.classList.toggle('flipped');

      // Update flip button text
      const flipBtn = card.querySelector('.flip-btn');
      if (flipBtn) {
        flipBtn.textContent = img.classList.contains('flipped') ? 'Unflip' : 'Flip';
      }

      // Mark as flipped in campaign data for download
      const imgIndex = currentCampaignImages.findIndex(i => i.id === id);
      if (imgIndex !== -1) {
        currentCampaignImages[imgIndex].flipped = img.classList.contains('flipped');
      }
    }

    // Regenerate a single image
    async function regenerateImage(id) {
      const card = imageCards[id];
      if (!card) return;

      const direction = card.dataset.direction;
      const imageType = card.dataset.imageType;

      // Show loading state
      const regenBtn = card.querySelector('.regen-btn');
      if (regenBtn) {
        regenBtn.classList.add('loading');
        regenBtn.textContent = '...';
      }

      // Replace image with placeholder
      const img = card.querySelector('img');
      if (img) {
        img.outerHTML = '<div class="image-placeholder"><div class="spinner" style="display:block;"></div><span class="status-text forging">REGENERATING</span></div>';
      }

      try {
        const res = await fetch('/regenerate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            direction,
            imageType,
            campaignId: currentCampaignId
          })
        });

        const data = await res.json();

        if (data.success) {
          // Update card with new image
          const placeholder = card.querySelector('.image-placeholder');
          if (placeholder) {
            placeholder.outerHTML = '<img src="' + data.url + '" alt="Generated">';
          }
          // Update the actions
          const actions = card.querySelector('.actions');
          if (actions) {
            actions.innerHTML = '<a href="' + data.url + '" target="_blank" class="view-btn">View</a><a href="' + data.url + '" download class="download-btn">DL</a><button class="flip-btn" onclick="flipImage(' + id + ')">Flip</button><button class="regen-btn" onclick="regenerateImage(' + id + ')">Regen</button>';
          }
          // Update campaign images array
          const imgIndex = currentCampaignImages.findIndex(img => img.id === id);
          if (imgIndex !== -1) {
            currentCampaignImages[imgIndex].url = data.url;
          }
        } else {
          console.error('Regenerate failed:', data.error);
          alert('Regeneration failed: ' + data.error);
          const placeholder = card.querySelector('.image-placeholder');
          if (placeholder) {
            placeholder.innerHTML = '<span class="status-text" style="color:#ef4444;">FAILED</span><br><small style="color:#888;font-size:10px;">' + data.error + '</small>';
          }
        }
      } catch (err) {
        console.error('Regenerate failed:', err);
        alert('Regeneration failed: ' + err.message);
        const placeholder = card.querySelector('.image-placeholder');
        if (placeholder) {
          placeholder.innerHTML = '<span class="status-text" style="color:#ef4444;">FAILED</span>';
        }
      }
    }

    newBtn.addEventListener('click', () => {
      // Show mode toggle
      document.querySelector('.mode-toggle').style.display = 'flex';

      // Show appropriate panel based on current mode
      if (currentMode === 'photography') {
        setupPanel.classList.remove('hidden');
        staticDesignerPanel.classList.add('hidden');
      } else {
        setupPanel.classList.add('hidden');
        staticDesignerPanel.classList.remove('hidden');
      }

      newBtn.style.display = 'none';
      campaignStatus.classList.remove('active');
      imageGrid.innerHTML = '';

      // Reset photography state
      selectedFile = null;
      preview.style.display = 'none';
      uploadText.style.display = 'block';
      dropZone.querySelector('p').style.display = 'block';
      dropZone.classList.remove('has-file');
      urlInput.value = '';
      imageInput.value = '';
      launchBtn.disabled = true;

      // Reset static designer state
      staticSelectedFile = null;
      staticPreview.style.display = 'none';
      staticUploadText.style.display = 'block';
      staticDropZone.querySelector('p').style.display = 'block';
      staticDropZone.classList.remove('has-file');
      staticUrlInput.value = '';
      staticImageInput.value = '';
      staticLaunchBtn.disabled = true;

      progressBar.style.width = '0%';
      currentCampaignImages = [];
    });
  </script>
</body>
</html>
  `);
});

// API endpoint to get campaigns
app.get('/api/campaigns', async (req, res) => {
  const campaigns = await loadCampaigns();
  res.json(campaigns);
});

// API endpoint with real-time streaming
app.post('/generate', upload.single('image'), async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const keepAlive = setInterval(() => { res.write(': keepalive\n\n'); }, 10000);

  const send = (data) => res.write('data: ' + JSON.stringify(data) + '\n\n');

  const campaignImages = [];
  const campaignId = req.body.campaignId || Date.now().toString();

  try {
    if (!req.file) {
      clearInterval(keepAlive);
      send({ type: 'error', error: 'No image uploaded' });
      res.end();
      return;
    }

    // Upload image to reliable hosting service instead of using localtunnel
    console.log('📤 Uploading product image to hosting service...');
    let imagePublicUrl = null;
    try {
      imagePublicUrl = await ImageHost.upload(req.file.path);
    } catch (err) {
      console.error('Image upload failed:', err.message);
      // Fallback to localtunnel if available
      imagePublicUrl = publicUrl ? publicUrl + '/uploads/' + req.file.filename : null;
    }

    const types = JSON.parse(req.body.types || '["aesthetic"]');

    // Get all images to generate
    const images = [];
    let id = 0;
    for (const type of types) {
      const typeConfig = directionsConfig.image_types[type];
      if (!typeConfig) continue;
      const directions = Object.keys(typeConfig.directions).slice(0, 2); // 2 per type
      for (const direction of directions) {
        images.push({ id: id++, imageType: type, direction });
      }
    }

    // Send init with all images
    send({ type: 'init', images });

    const generator = new MTRXImageGenerator();

    // Analyze product once and cache
    console.log('🔍 Analyzing product...');
    let cachedAnalysis = null;
    let brandName = 'Unknown Brand';
    try {
      cachedAnalysis = await generator.analyzeProduct({
        productImagePath: req.file.path,
        websiteUrl: req.body.url
      });
      brandName = cachedAnalysis.product_info?.brand || 'Unknown Brand';
      console.log('   Brand:', brandName);
      console.log('   Category:', cachedAnalysis.product_info?.category);
    } catch (err) {
      console.error('Analysis error:', err.message);
    }

    // Store params for regeneration (persist to file)
    imageParamsCache.set(campaignId, {
      productImagePath: req.file.path,
      productImageUrl: imagePublicUrl,
      websiteUrl: req.body.url,
      cachedAnalysis: cachedAnalysis
    });
    await saveRegenCache();

    // Generate ALL images in PARALLEL
    const generatePromises = images.map(async (img) => {
      send({ type: 'start', id: img.id });

      try {
        const results = await generator.generateSingle({
          productImagePath: req.file.path,
          productImageUrl: imagePublicUrl,
          websiteUrl: req.body.url,
          imageType: img.imageType,
          direction: img.direction,
          outputDir: './output',
          cachedAnalysis: cachedAnalysis
        });

        if (results.success) {
          send({ type: 'complete', id: img.id, url: results.url, direction: img.direction, imageType: img.imageType });
          return { id: img.id, url: results.url, success: true, direction: img.direction, imageType: img.imageType };
        } else {
          send({ type: 'error', id: img.id, error: results.error, direction: img.direction, imageType: img.imageType });
          return { id: img.id, success: false, error: results.error, direction: img.direction, imageType: img.imageType };
        }
      } catch (err) {
        send({ type: 'error', id: img.id, error: err.message, direction: img.direction, imageType: img.imageType });
        return { id: img.id, success: false, error: err.message, direction: img.direction, imageType: img.imageType };
      }
    });

    // Wait for ALL parallel generations to complete
    const results = await Promise.all(generatePromises);
    campaignImages.push(...results);

    // Save campaign to history
    const campaign = {
      id: campaignId,
      createdAt: new Date().toISOString(),
      brand: brandName,
      types: types,
      images: campaignImages
    };
    await saveCampaign(campaign);
    console.log('📁 Campaign saved:', campaignId);

    clearInterval(keepAlive);
    res.end();
  } catch (error) {
    console.error('Generation error:', error);
    clearInterval(keepAlive);
    send({ type: 'error', error: error.message });
    res.end();
  }
});

// Regenerate single image endpoint
app.post('/regenerate', async (req, res) => {
  try {
    const { id, direction, imageType, campaignId } = req.body;

    console.log('🔄 Regenerate request:', { id, direction, imageType, campaignId });
    console.log('   Cache has', imageParamsCache.size, 'campaigns');

    // Get cached params
    const params = imageParamsCache.get(campaignId);
    if (!params) {
      console.log('   Campaign not found in cache. Available:', Array.from(imageParamsCache.keys()));
      return res.json({ success: false, error: 'Campaign expired. Please run a new campaign first.' });
    }

    console.log('   Found campaign params, regenerating...');

    const generator = new MTRXImageGenerator();
    const results = await generator.generateSingle({
      productImagePath: params.productImagePath,
      productImageUrl: params.productImageUrl,
      websiteUrl: params.websiteUrl,
      imageType,
      direction,
      outputDir: './output',
      cachedAnalysis: params.cachedAnalysis
    });

    if (results.success) {
      console.log('✅ Regeneration complete:', results.url);
      res.json({ success: true, url: results.url });
    } else {
      console.log('❌ Regeneration failed:', results.error);
      res.json({ success: false, error: results.error });
    }
  } catch (error) {
    console.error('Regeneration error:', error);
    res.json({ success: false, error: error.message });
  }
});

// Static Designer generation endpoint
app.post('/generate-statics', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'logo', maxCount: 1 }]), async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const keepAlive = setInterval(() => { res.write(': keepalive\n\n'); }, 10000);
  const send = (data) => res.write('data: ' + JSON.stringify(data) + '\n\n');

  const campaignImages = [];
  const campaignId = req.body.campaignId || Date.now().toString();

  try {
    const productImageFile = req.files?.image?.[0];
    const logoImageFile = req.files?.logo?.[0];

    if (!productImageFile) {
      clearInterval(keepAlive);
      send({ type: 'error', error: 'No image uploaded' });
      res.end();
      return;
    }

    // Upload product image to hosting service
    console.log('📤 Uploading product image for static designer...');
    let imagePublicUrl = null;
    try {
      imagePublicUrl = await ImageHost.upload(productImageFile.path);
    } catch (err) {
      console.error('Image upload failed:', err.message);
      imagePublicUrl = publicUrl ? publicUrl + '/uploads/' + productImageFile.filename : null;
    }

    // Upload logo image if provided
    let logoPublicUrl = null;
    if (logoImageFile) {
      console.log('📤 Uploading brand logo...');
      try {
        logoPublicUrl = await ImageHost.upload(logoImageFile.path);
        console.log('   ✓ Logo uploaded:', logoPublicUrl);
      } catch (err) {
        console.error('Logo upload failed:', err.message);
      }
    }

    const staticTypes = JSON.parse(req.body.staticTypes || '["type1"]');
    const variantsPerType = parseInt(req.body.variantsPerType) || 1; // Default to 1, can be 1-4

    // Static type names for display
    const staticTypeNames = {
      type1: 'product_hero',
      type2: 'meme_static',
      type3: 'aesthetic_offer',
      type4: 'illustrated',
      type5: 'vintage_magazine',
      type6: 'ugc_caption'
    };

    // Build image queue with multiple variants per type
    const images = [];
    let imgId = 0;
    staticTypes.forEach(type => {
      for (let v = 0; v < variantsPerType; v++) {
        images.push({
          id: imgId++,
          imageType: 'static',
          direction: `${staticTypeNames[type] || type}_v${v + 1}`,
          staticType: type,
          variantIndex: v  // Track which variant to use
        });
      }
    });

    console.log(`   Generating ${images.length} statics (${variantsPerType} variants per type)`);

    // Send init
    send({ type: 'init', images });

    const generator = new MTRXImageGenerator();

    // Analyze product and scrape landing page
    console.log('🔍 Analyzing product for statics...');
    console.log('   Landing page:', req.body.url);
    let cachedAnalysis = null;
    let brandName = 'Unknown Brand';
    let copyResearch = null;

    try {
      cachedAnalysis = await generator.analyzeProduct({
        productImagePath: productImageFile.path,
        websiteUrl: req.body.url
      });
      brandName = cachedAnalysis.product_info?.brand || 'Unknown Brand';
      console.log('   ✓ Brand:', brandName);
      console.log('   ✓ Category:', cachedAnalysis.product_info?.category);
      console.log('   ✓ Tone:', cachedAnalysis.brand_voice?.tone);
      console.log('   ✓ Target:', cachedAnalysis.brand_voice?.target_gender, cachedAnalysis.brand_voice?.target_age);
      if (cachedAnalysis.key_phrases?.length > 0) {
        console.log('   ✓ Key phrases:', cachedAnalysis.key_phrases.slice(0, 3).join(' | '));
      }
      if (cachedAnalysis.benefits?.length > 0) {
        console.log('   ✓ Benefits:', cachedAnalysis.benefits.slice(0, 3).join(', '));
      }
    } catch (err) {
      console.error('Analysis error:', err.message);
    }

    // Do AI-powered research and copy generation
    try {
      const copyService = new CopyResearchService();

      // Fetch landing page content for research
      let pageContent = '';
      try {
        const pageResponse = await fetch(req.body.url);
        const html = await pageResponse.text();
        // Strip HTML tags for cleaner text
        pageContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      } catch (e) {
        console.log('   Could not fetch page content');
      }

      const proposedAngle = req.body.angle || '';
      if (proposedAngle) {
        console.log('   🎯 Proposed angle:', proposedAngle);
      }

      copyResearch = await copyService.researchAndGenerateCopy({
        websiteUrl: req.body.url,
        websiteContent: pageContent,
        brandName: brandName,
        productName: cachedAnalysis?.product_info?.product_name || 'product',
        category: cachedAnalysis?.product_info?.category || 'apparel',
        proposedAngle: proposedAngle
      });
    } catch (err) {
      console.error('   Copy research error:', err.message);
    }

    // Store params for regeneration
    imageParamsCache.set(campaignId, {
      productImagePath: productImageFile.path,
      productImageUrl: imagePublicUrl,
      logoUrl: logoPublicUrl,
      websiteUrl: req.body.url,
      cachedAnalysis: cachedAnalysis,
      isStatic: true
    });
    await saveRegenCache();

    // Skill folder mapping
    const skillFolders = {
      type1: 'type1-product-hero',
      type2: 'type2-meme-static',
      type3: 'type3-aesthetic-offer',
      type4: 'type4-illustrated-static',
      type5: 'type5-vintage-magazine',
      type6: 'type6-ugc-caption'
    };

    // Create the copy service for building prompts
    const copyService = new CopyResearchService();

    // Generate ALL statics in PARALLEL
    const generatePromises = images.map(async (img) => {
      send({ type: 'start', id: img.id });

      try {
        // Use the variant index from the image object (set during queue building)
        const variantIndex = img.variantIndex || 0;

        let prompt = '';

        // PRIORITY: Use AI-generated complete prompts if research is available
        if (copyResearch && copyResearch.copy) {
          const generatedPrompt = copyService.buildCompletePrompt(
            img.staticType,
            copyResearch,
            variantIndex,
            brandName,
            logoPublicUrl  // Pass uploaded logo URL if available
          );

          if (generatedPrompt) {
            prompt = generatedPrompt;
            const variant = copyService.getVariant(img.staticType, copyResearch, variantIndex);
            console.log(`   ${img.staticType} using variant ${variantIndex}:`);
            if (variant?.angle) console.log(`      Angle: ${variant.angle}`);
            if (variant?.format) console.log(`      Format: ${variant.format}`);
            if (variant?.composition) console.log(`      Composition: ${variant.composition}`);
            if (variant?.setting) console.log(`      Setting: ${variant.setting}`);
            if (variant?.headline) console.log(`      Headline: ${variant.headline.substring(0, 40)}...`);
            if (variant?.caption) console.log(`      Caption: ${variant.caption.substring(0, 40)}...`);
          }
        }

        // FALLBACK: Load skill file if no AI prompt was generated
        if (!prompt) {
          const skillFolder = skillFolders[img.staticType] || img.staticType;
          const skillPath = path.join(__dirname, 'skills/static-designer/apparel', skillFolder, 'SKILL.md');
          let skillContent = '';
          try {
            skillContent = await fs.readFile(skillPath, 'utf-8');
            console.log('   Loaded skill:', skillFolder);
          } catch (err) {
            console.log('   Skill not found at:', skillPath);
          }

          // Extract the WORKING prompt from skill (not the ASCII diagram)
          if (skillContent) {
            // Look for "Example" section which contains the actual working prompt
            const exampleMatch = skillContent.match(/## .*Example.*\n+```\n?([\s\S]*?)```/i);
            if (exampleMatch) {
              prompt = exampleMatch[1].trim();
            } else {
              // Fallback: find code blocks and get the longest one that's not a diagram
              const codeBlockRegex = /```\n?([\s\S]*?)```/g;
              let match;
              let longestPrompt = '';
              while ((match = codeBlockRegex.exec(skillContent)) !== null) {
                const block = match[1].trim();
                // Skip diagrams and short blocks
                if (block.length > 100 && !block.includes('┌') && !block.includes('└') && !block.includes('───')) {
                  if (block.length > longestPrompt.length) {
                    longestPrompt = block;
                  }
                }
              }
              prompt = longestPrompt;
            }
            console.log('   Extracted prompt length:', prompt.length);
            if (prompt.length > 0) {
              console.log('   Prompt preview:', prompt.substring(0, 80) + '...');
            }
          }

          // Apply AI copy as replacement in skill prompt if available
          if (copyResearch && copyResearch.copy) {
            prompt = copyService.buildCustomPrompt(img.staticType, copyResearch, prompt, variantIndex);
          }
        }

        // Replace remaining placeholders with product info from analysis
        if (cachedAnalysis && prompt) {
          const brandNameLocal = cachedAnalysis.product_info?.brand || 'Brand';
          const productName = cachedAnalysis.product_info?.product_name || 'product';
          const category = cachedAnalysis.product_info?.category || 'apparel';
          const benefits = cachedAnalysis.benefits || [];
          const keyPhrases = cachedAnalysis.key_phrases || [];

          // Build a caption from key phrases or benefits
          let keyPhrase = keyPhrases[0] || benefits[0] || 'Quality that lasts. Style that fits.';

          // Build benefits list for prompts that need it
          const benefitsList = benefits.length > 0
            ? benefits.slice(0, 3).join(', ')
            : 'durable, comfortable, premium quality';

          // Replace example brand/product names (case insensitive)
          prompt = prompt.replace(/UndrDog/gi, brandNameLocal);
          prompt = prompt.replace(/hemp t-shirt/gi, productName);
          prompt = prompt.replace(/hemp tee/gi, productName);

          // Replace ALL bracket placeholders (various formats)
          prompt = prompt.replace(/\[BRAND\]/gi, brandNameLocal);
          prompt = prompt.replace(/\[Brand\]/g, brandNameLocal);
          prompt = prompt.replace(/\[PRODUCT\]/gi, productName);
          prompt = prompt.replace(/\[CAPTION\]/gi, keyPhrase);
          prompt = prompt.replace(/\[PRODUCT TYPE\]/gi, category);
          prompt = prompt.replace(/\[BRAND NAME\]/gi, brandNameLocal);
          prompt = prompt.replace(/\[BENEFITS\]/gi, benefitsList);
          prompt = prompt.replace(/\[OFFER TEXT\]/gi, 'Lifetime Guarantee');
          prompt = prompt.replace(/\[CTA TEXT\]/gi, 'SHOP NOW');
          prompt = prompt.replace(/\[HEADLINE[^\]]*\]/gi, keyPhrase);

          console.log('   Brand applied:', brandNameLocal);
        }

        // Generate at 9:16 first (taller format), then crop to 4:5
        // This ensures both versions share the EXACT same content
        const results = await generator.generateSingle({
          productImagePath: productImageFile.path,
          productImageUrl: imagePublicUrl,
          websiteUrl: req.body.url,
          imageType: 'aesthetic', // Use aesthetic as base
          direction: 'bold_color_pop', // Default direction
          outputDir: './output',
          aspectRatio: '9:16', // Generate tall first, then crop to 4:5
          cachedAnalysis: cachedAnalysis,
          customPrompt: prompt || undefined,
          logoUrl: logoPublicUrl  // Pass logo as second reference image
        });

        if (results.success) {
          const url916 = results.url; // The 9:16 is our master image

          // Create 4:5 by center cropping the 9:16
          let url45 = null;
          try {
            console.log('   Creating 4:5 crop from 9:16...');
            url45 = await create45FromTall(url916);
            if (url45) {
              console.log('   ✓ Created 4:5 version (center crop)');
            }
          } catch (err45) {
            console.error('   4:5 crop failed:', err45.message);
          }

          // Use the cropped 4:5 as primary, with 9:16 as the tall version
          const primaryUrl = url45 || url916; // Fall back to 9:16 if crop fails
          send({ type: 'complete', id: img.id, url: primaryUrl, url916: url916, direction: img.direction, imageType: 'static' });
          return { id: img.id, url: primaryUrl, url916: url916, success: true, direction: img.direction, imageType: 'static' };
        } else {
          send({ type: 'error', id: img.id, error: results.error, direction: img.direction, imageType: 'static' });
          return { id: img.id, success: false, error: results.error, direction: img.direction, imageType: 'static' };
        }
      } catch (err) {
        send({ type: 'error', id: img.id, error: err.message, direction: img.direction, imageType: 'static' });
        return { id: img.id, success: false, error: err.message, direction: img.direction, imageType: 'static' };
      }
    });

    // Wait for ALL parallel generations to complete
    const results = await Promise.all(generatePromises);
    campaignImages.push(...results);

    // Save campaign
    const campaign = {
      id: campaignId,
      createdAt: new Date().toISOString(),
      brand: brandName,
      types: ['static-designer'],
      staticTypes: staticTypes,
      images: campaignImages
    };
    await saveCampaign(campaign);
    console.log('📁 Static campaign saved:', campaignId);

    clearInterval(keepAlive);
    res.end();
  } catch (error) {
    console.error('Static generation error:', error);
    clearInterval(keepAlive);
    send({ type: 'error', error: error.message });
    res.end();
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start() {
  await ensureDirs();
  await loadDirectionsConfig();
  await loadRegenCache();

  app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🚀 MTRX AI Server running at http://localhost:' + PORT + '\n');
  });

  if (process.env.NODE_ENV !== 'production') {
    try {
      const localtunnel = require('localtunnel');
      const tunnel = await localtunnel({ port: PORT });
      publicUrl = tunnel.url;
      console.log('🌐 Public URL: ' + tunnel.url + '\n');
      tunnel.on('close', () => {
        publicUrl = null;
        console.log('Tunnel closed');
      });
      tunnel.on('error', (err) => {
        console.log('Tunnel error:', err.message);
        publicUrl = null;
      });
    } catch (err) {
      console.log('Could not create tunnel:', err.message);
    }
  }
}

// Handle uncaught errors gracefully
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err.message);
});

start();
