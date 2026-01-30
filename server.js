/**
 * MTRX AI V1 - Web Server with Real-time Grid & Campaign History
 */

require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const MTRXImageGenerator = require('./src/index');
const ImageHost = require('./src/utils/image-host');

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
    #preview { max-width: 100%; max-height: 150px; border-radius: 8px; display: none; }
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
    .image-card img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
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

    // Type selection
    document.querySelectorAll('.type-btn').forEach(btn => {
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
        updateCardComplete(data.id, data.url, data.direction, data.imageType);
        currentCampaignImages.push({ id: data.id, url: data.url, success: true, direction: data.direction, imageType: data.imageType });
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

    function updateCardComplete(id, url, direction, imageType) {
      const card = imageCards[id];
      if (!card) return;
      card.classList.remove('forging');
      card.dataset.direction = direction;
      card.dataset.imageType = imageType;
      const placeholder = card.querySelector('.image-placeholder');
      placeholder.outerHTML = '<img src="' + url + '" alt="Generated">';
      const info = card.querySelector('.info');
      info.innerHTML += '<div class="actions"><a href="' + url + '" target="_blank" class="view-btn">View</a><a href="' + url + '" download class="download-btn">Download</a><button class="regen-btn" onclick="regenerateImage(' + id + ')">Regen</button></div>';
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

    // Download All button - handles cross-origin images
    document.getElementById('downloadAll').addEventListener('click', async () => {
      const successfulImages = currentCampaignImages.filter(img => img.success && img.url);
      if (successfulImages.length === 0) {
        alert('No images to download yet');
        return;
      }

      // Download each image by fetching as blob
      for (let i = 0; i < successfulImages.length; i++) {
        const img = successfulImages[i];
        try {
          const response = await fetch(img.url);
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = img.imageType + '_' + img.direction + '.png';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
          // Small delay between downloads
          await new Promise(r => setTimeout(r, 500));
        } catch (err) {
          console.error('Failed to download:', img.url, err);
          // Fallback: open in new tab
          window.open(img.url, '_blank');
        }
      }
    });

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
            actions.innerHTML = '<a href="' + data.url + '" target="_blank" class="view-btn">View</a><a href="' + data.url + '" download class="download-btn">Download</a><button class="regen-btn" onclick="regenerateImage(' + id + ')">Regen</button>';
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
      setupPanel.classList.remove('hidden');
      newBtn.style.display = 'none';
      campaignStatus.classList.remove('active');
      imageGrid.innerHTML = '';
      selectedFile = null;
      preview.style.display = 'none';
      uploadText.style.display = 'block';
      dropZone.querySelector('p').style.display = 'block';
      dropZone.classList.remove('has-file');
      urlInput.value = '';
      imageInput.value = '';
      launchBtn.disabled = true;
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

    // Generate each image and stream results
    for (const img of images) {
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
          campaignImages.push({ id: img.id, url: results.url, success: true, direction: img.direction, imageType: img.imageType });
        } else {
          send({ type: 'error', id: img.id, error: results.error, direction: img.direction, imageType: img.imageType });
          campaignImages.push({ id: img.id, success: false, error: results.error, direction: img.direction, imageType: img.imageType });
        }
      } catch (err) {
        send({ type: 'error', id: img.id, error: err.message, direction: img.direction, imageType: img.imageType });
        campaignImages.push({ id: img.id, success: false, error: err.message, direction: img.direction, imageType: img.imageType });
      }
    }

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

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start() {
  await ensureDirs();
  await loadDirectionsConfig();
  await loadRegenCache();

  app.listen(PORT, () => {
    console.log('\n🚀 MTRX AI Server running at http://localhost:' + PORT + '\n');
  });

  if (process.env.NODE_ENV !== 'production') {
    try {
      const localtunnel = require('localtunnel');
      const tunnel = await localtunnel({ port: PORT });
      publicUrl = tunnel.url;
      console.log('🌐 Public URL: ' + tunnel.url + '\n');
      tunnel.on('close', () => { publicUrl = null; });
    } catch (err) {
      console.log('Could not create tunnel:', err.message);
    }
  }
}

start();
