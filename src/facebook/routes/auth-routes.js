/**
 * Facebook Auth Routes — /api/auth/facebook/*
 * Handles OAuth connect flow, account selection, status, disconnect
 */

const { Router } = require('express');
const oauth = require('../auth/oauth');
const { getDb } = require('../../database/db');
const { encrypt, decrypt } = require('../../database/encryption');

const router = Router();

/**
 * POST /api/auth/facebook/connect
 * Body: { brandId } (optional — creates brand if not provided)
 * Returns: { loginUrl }
 */
router.post('/connect', (req, res) => {
  try {
    const { brandId, brandName } = req.body;
    const db = getDb();

    let resolvedBrandId = brandId;
    if (!resolvedBrandId) {
      // Create a new brand
      const result = db.prepare('INSERT INTO brands (name) VALUES (?)').run(brandName || 'My Brand');
      resolvedBrandId = result.lastInsertRowid;
    }

    const loginUrl = oauth.getLoginUrl(String(resolvedBrandId));
    res.json({ loginUrl, brandId: resolvedBrandId });
  } catch (err) {
    console.error('[FB Auth] Connect error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/auth/facebook/callback
 * Facebook redirects here with ?code=...&state=brandId
 * Exchanges code for long-lived token, stores encrypted
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state: brandId, error: fbError } = req.query;

    if (fbError) {
      return res.status(400).send(`
        <html><body>
          <h2>Facebook Authorization Failed</h2>
          <p>${fbError}</p>
          <script>window.opener && window.opener.postMessage({ type: 'fb-auth-error', error: '${fbError}' }, '*'); window.close();</script>
        </body></html>
      `);
    }

    if (!code || !brandId) {
      return res.status(400).json({ error: 'Missing code or brand ID' });
    }

    // Exchange code for short-lived token
    const { accessToken: shortToken } = await oauth.exchangeCodeForToken(code);

    // Exchange for long-lived token
    const { accessToken: longToken, expiresIn } = await oauth.getLongLivedToken(shortToken);

    // Get user info
    const userInfo = await oauth.getUserInfo(longToken);

    // Store encrypted token
    const db = getDb();
    const encryptedToken = encrypt(longToken);
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Upsert connection (one per brand)
    db.prepare(`
      INSERT INTO fb_connections (brand_id, access_token_encrypted, token_expires_at, fb_user_id, fb_user_name, status)
      VALUES (?, ?, ?, ?, ?, 'active')
      ON CONFLICT(brand_id) DO UPDATE SET
        access_token_encrypted = excluded.access_token_encrypted,
        token_expires_at = excluded.token_expires_at,
        fb_user_id = excluded.fb_user_id,
        fb_user_name = excluded.fb_user_name,
        status = 'active',
        updated_at = datetime('now')
    `).run(brandId, encryptedToken, expiresAt, userInfo.id, userInfo.name);

    // Return HTML that communicates back to opener and lists ad accounts
    const accounts = await oauth.listAdAccounts(longToken);

    res.send(`
      <html>
      <head>
        <title>Facebook Connected — MTRX AI</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Inter', sans-serif; background: #0a0a0a; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
          .container { max-width: 480px; width: 100%; padding: 40px 32px; }
          .check { width: 48px; height: 48px; background: rgba(34,197,94,0.12); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }
          h2 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
          .subtitle { color: #555; font-size: 13px; margin-bottom: 28px; }
          .account-list { display: flex; flex-direction: column; gap: 8px; max-height: 60vh; overflow-y: auto; padding-right: 4px; }
          .account-btn { display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px 16px; background: #111; border: 1px solid #1a1a1a; border-radius: 10px; color: #fff; font-size: 13px; font-family: inherit; cursor: pointer; transition: all 0.15s; text-align: left; }
          .account-btn:hover { border-color: #06b6d4; background: rgba(6,182,212,0.05); }
          .account-btn .icon { width: 36px; height: 36px; background: rgba(6,182,212,0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
          .account-btn .name { font-weight: 600; }
          .account-btn .id { color: #555; font-size: 11px; margin-top: 2px; }
          .account-btn.selected { border-color: #22c55e; background: rgba(34,197,94,0.08); }
          .empty { color: #555; font-size: 13px; text-align: center; padding: 40px; }
          .account-list::-webkit-scrollbar { width: 4px; }
          .account-list::-webkit-scrollbar-track { background: transparent; }
          .account-list::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="check">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2>Connected as ${userInfo.name}</h2>
          <p class="subtitle">Select the ad account you want to analyze</p>
          <div id="accounts" class="account-list"></div>
        </div>
        <script>
          const accounts = ${JSON.stringify(accounts)};
          const brandId = ${JSON.stringify(brandId)};
          const container = document.getElementById('accounts');
          if (accounts.length === 0) {
            container.innerHTML = '<div class="empty">No ad accounts found for this user.</div>';
          }
          accounts.forEach(acc => {
            const btn = document.createElement('button');
            btn.className = 'account-btn';
            btn.innerHTML = '<div class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div><div><div class="name">' + acc.name + '</div><div class="id">' + acc.accountId + '</div></div>';
            btn.onclick = async () => {
              btn.classList.add('selected');
              btn.innerHTML = '<div class="icon" style="background:rgba(34,197,94,0.15)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></div><div><div class="name">' + acc.name + '</div><div class="id">Connecting...</div></div>';
              const res = await fetch('/api/auth/facebook/select-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brandId, adAccountId: acc.id, adAccountName: acc.name })
              });
              if (res.ok) {
                if (window.opener) {
                  window.opener.postMessage({ type: 'fb-auth-success', brandId }, '*');
                  window.close();
                } else {
                  document.querySelector('.container').innerHTML = '<div class="check"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></div><h2>Account Connected</h2><p class="subtitle">' + acc.name + ' is now linked. You can close this window.</p>';
                }
              }
            };
            container.appendChild(btn);
          });
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('[FB Auth] Callback error:', err.message);
    res.status(500).send(`
      <html><body>
        <h2>Error</h2>
        <p>${err.message}</p>
      </body></html>
    `);
  }
});

/**
 * POST /api/auth/facebook/select-account
 * Body: { brandId, adAccountId, adAccountName }
 */
router.post('/select-account', (req, res) => {
  try {
    const { brandId, adAccountId, adAccountName } = req.body;
    if (!brandId || !adAccountId) {
      return res.status(400).json({ error: 'Missing brandId or adAccountId' });
    }

    const db = getDb();
    const result = db.prepare(`
      UPDATE fb_connections
      SET ad_account_id = ?, ad_account_name = ?, updated_at = datetime('now')
      WHERE brand_id = ?
    `).run(adAccountId, adAccountName || '', brandId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'No connection found for this brand' });
    }

    res.json({ success: true, adAccountId, adAccountName });
  } catch (err) {
    console.error('[FB Auth] Select account error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/auth/facebook/status/:brandId
 * Returns connection status for a brand
 */
router.get('/status/:brandId', (req, res) => {
  try {
    const db = getDb();
    const conn = db.prepare(`
      SELECT id, brand_id, ad_account_id, ad_account_name, fb_user_name, status,
             token_expires_at, last_sync_at, created_at
      FROM fb_connections WHERE brand_id = ?
    `).get(req.params.brandId);

    if (!conn) {
      return res.json({ connected: false });
    }

    const isExpired = conn.token_expires_at && new Date(conn.token_expires_at) < new Date();

    res.json({
      connected: conn.status === 'active' && !isExpired,
      status: isExpired ? 'expired' : conn.status,
      adAccountId: conn.ad_account_id,
      adAccountName: conn.ad_account_name,
      fbUserName: conn.fb_user_name,
      lastSyncAt: conn.last_sync_at,
      tokenExpiresAt: conn.token_expires_at,
    });
  } catch (err) {
    console.error('[FB Auth] Status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/facebook/disconnect/:brandId
 */
router.post('/disconnect/:brandId', (req, res) => {
  try {
    const db = getDb();
    db.prepare(`
      UPDATE fb_connections SET status = 'disconnected', updated_at = datetime('now')
      WHERE brand_id = ?
    `).run(req.params.brandId);

    res.json({ success: true });
  } catch (err) {
    console.error('[FB Auth] Disconnect error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/auth/facebook/brands
 * List all brands with their connection status
 */
router.get('/brands', (req, res) => {
  try {
    const db = getDb();
    const brands = db.prepare(`
      SELECT b.id, b.name, b.website_url, b.logo_url, b.category, b.target_roas, b.target_cpa, b.created_at,
             fc.status as fb_status, fc.ad_account_name, fc.fb_user_name, fc.last_sync_at
      FROM brands b
      LEFT JOIN fb_connections fc ON fc.brand_id = b.id
      ORDER BY b.created_at DESC
    `).all();

    res.json(brands);
  } catch (err) {
    console.error('[FB Auth] Brands list error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/facebook/brands
 * Create a new brand
 * Body: { name, websiteUrl, logoUrl, category }
 */
router.post('/brands', (req, res) => {
  try {
    const { name, websiteUrl, logoUrl, category, targetRoas, targetCpa } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Brand name is required' });
    }

    const validCategories = ['apparel', 'supplements', 'perfume', 'other'];
    const cat = validCategories.includes(category) ? category : 'apparel';
    const tRoas = parseFloat(targetRoas) || 0;
    const tCpa = parseFloat(targetCpa) || 0;

    const db = getDb();
    const result = db.prepare('INSERT INTO brands (name, website_url, logo_url, category, target_roas, target_cpa) VALUES (?, ?, ?, ?, ?, ?)').run(name, websiteUrl || null, logoUrl || null, cat, tRoas, tCpa);

    res.json({ id: result.lastInsertRowid, name, websiteUrl, logoUrl, category: cat, targetRoas: tRoas, targetCpa: tCpa });
  } catch (err) {
    console.error('[FB Auth] Create brand error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/auth/facebook/brands/:brandId
 * Update brand details
 * Body: { name, websiteUrl, logoUrl, category }
 */
router.patch('/brands/:brandId', (req, res) => {
  try {
    const brandId = parseInt(req.params.brandId);
    const { name, websiteUrl, logoUrl, category, targetRoas, targetCpa } = req.body;
    const db = getDb();

    const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(brandId);
    if (!brand) return res.status(404).json({ error: 'Brand not found' });

    const validCategories = ['apparel', 'supplements', 'perfume', 'other'];
    const updates = {
      name: name || brand.name,
      website_url: websiteUrl !== undefined ? websiteUrl : brand.website_url,
      logo_url: logoUrl !== undefined ? logoUrl : brand.logo_url,
      category: validCategories.includes(category) ? category : brand.category,
      target_roas: targetRoas !== undefined ? (parseFloat(targetRoas) || 0) : brand.target_roas,
      target_cpa: targetCpa !== undefined ? (parseFloat(targetCpa) || 0) : brand.target_cpa,
    };

    db.prepare('UPDATE brands SET name = ?, website_url = ?, logo_url = ?, category = ?, target_roas = ?, target_cpa = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(updates.name, updates.website_url, updates.logo_url, updates.category, updates.target_roas, updates.target_cpa, brandId);

    res.json({ id: brandId, ...updates });
  } catch (err) {
    console.error('[FB Auth] Update brand error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
