/**
 * SQLite Database — lazy-initialized at data/mtrx.db
 * Manages schema for Facebook Ads integration (brands, connections, ads, insights, cache)
 */

const path = require('path');
const fs = require('fs');

let _db = null;

function getDb() {
  if (_db) return _db;

  const Database = require('better-sqlite3');
  const dbDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'mtrx.db');
  _db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  initSchema(_db);
  return _db;
}

function initSchema(db) {
  db.exec(`
    -- Brands table: multi-tenant key
    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      website_url TEXT,
      logo_url TEXT,
      product_image_url TEXT,
      founder_image_url TEXT,
      category TEXT DEFAULT 'apparel' CHECK(category IN ('apparel', 'supplements', 'perfume', 'other')),
      target_roas REAL DEFAULT 0,
      target_cpa REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Facebook connections: one per brand
    CREATE TABLE IF NOT EXISTS fb_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id INTEGER NOT NULL UNIQUE,
      access_token_encrypted TEXT NOT NULL,
      token_expires_at TEXT,
      ad_account_id TEXT,
      ad_account_name TEXT,
      fb_user_id TEXT,
      fb_user_name TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'disconnected', 'expired')),
      last_sync_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
    );

    -- Facebook ads: stores ad metadata + creative info
    CREATE TABLE IF NOT EXISTS fb_ads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id INTEGER NOT NULL,
      fb_ad_id TEXT NOT NULL,
      fb_adset_id TEXT,
      fb_campaign_id TEXT,
      ad_name TEXT,
      status TEXT,
      -- Creative fields
      headline TEXT,
      body TEXT,
      image_url TEXT,
      thumbnail_url TEXT,
      video_url TEXT,
      call_to_action TEXT,
      -- Parsed MTRX naming fields (null if not MTRX format)
      parsed_brand TEXT,
      parsed_batch TEXT,
      parsed_copy_style TEXT,
      parsed_awareness TEXT,
      parsed_angle_type TEXT,
      parsed_angle_num TEXT,
      parsed_audience TEXT,
      parsed_creator TEXT,
      parsed_editor TEXT,
      parsed_version TEXT,
      naming_format TEXT DEFAULT 'unparsed' CHECK(naming_format IN ('mtrx', 'unparsed')),
      -- Performance snapshot (latest)
      spend REAL DEFAULT 0,
      impressions INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      ctr REAL DEFAULT 0,
      cpm REAL DEFAULT 0,
      cpc REAL DEFAULT 0,
      purchases INTEGER DEFAULT 0,
      cpa REAL DEFAULT 0,
      revenue REAL DEFAULT 0,
      roas REAL DEFAULT 0,
      -- Classification
      classification TEXT DEFAULT 'new' CHECK(classification IN ('winner', 'potential', 'loser', 'new')),
      -- Ad launch date from Facebook
      fb_created_time TEXT,
      -- Timestamps
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
      UNIQUE(brand_id, fb_ad_id)
    );

    -- Insights history: daily snapshots for trend analysis
    CREATE TABLE IF NOT EXISTS fb_insights_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id INTEGER NOT NULL,
      fb_ad_id TEXT NOT NULL,
      date TEXT NOT NULL,
      spend REAL DEFAULT 0,
      impressions INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      ctr REAL DEFAULT 0,
      cpm REAL DEFAULT 0,
      cpc REAL DEFAULT 0,
      purchases INTEGER DEFAULT 0,
      cpa REAL DEFAULT 0,
      revenue REAL DEFAULT 0,
      roas REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
      UNIQUE(brand_id, fb_ad_id, date)
    );

    -- Analysis cache: stores computed analysis results
    CREATE TABLE IF NOT EXISTS fb_analysis_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id INTEGER NOT NULL,
      analysis_type TEXT NOT NULL CHECK(analysis_type IN ('classification', 'patterns', 'brief', 'strategic_insights', 'test_suggestions')),
      data TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT,
      FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
    );

    -- Test campaigns: stores test ideas with their generated statics
    CREATE TABLE IF NOT EXISTS test_campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id INTEGER NOT NULL,
      -- Test info (from AI suggestions)
      title TEXT NOT NULL,
      hook TEXT,
      angle TEXT,
      hypothesis TEXT,
      copy_direction TEXT,
      visual_direction TEXT,
      priority TEXT,
      rationale TEXT,
      based_on TEXT,
      recommended_formats TEXT,
      -- Generated statics (JSON array of {type, format, imageUrl, aspectRatio})
      statics TEXT,
      -- Status tracking
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'ready', 'launched', 'completed')),
      -- Performance (linked when ad is created)
      fb_ad_ids TEXT,
      total_spend REAL DEFAULT 0,
      total_purchases INTEGER DEFAULT 0,
      avg_roas REAL DEFAULT 0,
      -- Notes
      notes TEXT,
      -- Timestamps
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
    );

    -- Test suggestions: tracks individual suggestions and their state
    CREATE TABLE IF NOT EXISTS test_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand_id INTEGER NOT NULL,
      -- Unique identifier for this suggestion (hash of type + hook + source)
      suggestion_hash TEXT NOT NULL,
      -- Suggestion data
      type TEXT NOT NULL CHECK(type IN ('new_angle', 'double_down', 'iteration')),
      hook TEXT NOT NULL,
      title TEXT,
      source_ad_id TEXT,
      source_ad_name TEXT,
      format_key TEXT,
      angle_key TEXT,
      -- Full suggestion data as JSON
      data TEXT,
      -- State tracking
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'saved', 'dismissed')),
      -- Timestamps
      created_at TEXT DEFAULT (datetime('now')),
      saved_at TEXT,
      dismissed_at TEXT,
      -- Campaign ID if saved
      campaign_id INTEGER,
      FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
      FOREIGN KEY (campaign_id) REFERENCES test_campaigns(id) ON DELETE SET NULL,
      UNIQUE(brand_id, suggestion_hash)
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_fb_ads_brand ON fb_ads(brand_id);
    CREATE INDEX IF NOT EXISTS idx_fb_ads_classification ON fb_ads(brand_id, classification);
    CREATE INDEX IF NOT EXISTS idx_fb_insights_date ON fb_insights_history(brand_id, fb_ad_id, date);
    CREATE INDEX IF NOT EXISTS idx_fb_analysis_type ON fb_analysis_cache(brand_id, analysis_type);
    CREATE INDEX IF NOT EXISTS idx_test_campaigns_brand ON test_campaigns(brand_id);
    CREATE INDEX IF NOT EXISTS idx_test_campaigns_status ON test_campaigns(brand_id, status);
    CREATE INDEX IF NOT EXISTS idx_test_suggestions_brand ON test_suggestions(brand_id, status);
    CREATE INDEX IF NOT EXISTS idx_test_suggestions_hash ON test_suggestions(brand_id, suggestion_hash);
  `);

  // Migrations for existing databases
  migrate(db);
}

function migrate(db) {
  // --- Brands table migrations ---
  const brandCols = db.prepare("PRAGMA table_info('brands')").all().map(c => c.name);
  if (!brandCols.includes('category')) {
    db.exec("ALTER TABLE brands ADD COLUMN category TEXT DEFAULT 'apparel'");
  }
  if (!brandCols.includes('target_roas')) {
    db.exec("ALTER TABLE brands ADD COLUMN target_roas REAL DEFAULT 0");
  }
  if (!brandCols.includes('target_cpa')) {
    db.exec("ALTER TABLE brands ADD COLUMN target_cpa REAL DEFAULT 0");
  }
  if (!brandCols.includes('product_image_url')) {
    db.exec("ALTER TABLE brands ADD COLUMN product_image_url TEXT");
  }
  if (!brandCols.includes('founder_image_url')) {
    db.exec("ALTER TABLE brands ADD COLUMN founder_image_url TEXT");
  }
  if (!brandCols.includes('founder_description')) {
    db.exec("ALTER TABLE brands ADD COLUMN founder_description TEXT");
  }

  // --- test_suggestions table migration ---
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test_suggestions'").all();
  if (tables.length === 0) {
    db.exec(`
      CREATE TABLE test_suggestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        brand_id INTEGER NOT NULL,
        suggestion_hash TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('new_angle', 'double_down', 'iteration')),
        hook TEXT NOT NULL,
        title TEXT,
        source_ad_id TEXT,
        source_ad_name TEXT,
        format_key TEXT,
        angle_key TEXT,
        data TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'saved', 'dismissed')),
        created_at TEXT DEFAULT (datetime('now')),
        saved_at TEXT,
        dismissed_at TEXT,
        campaign_id INTEGER,
        FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
        FOREIGN KEY (campaign_id) REFERENCES test_campaigns(id) ON DELETE SET NULL,
        UNIQUE(brand_id, suggestion_hash)
      );
      CREATE INDEX idx_test_suggestions_brand ON test_suggestions(brand_id, status);
      CREATE INDEX idx_test_suggestions_hash ON test_suggestions(brand_id, suggestion_hash);
    `);
  }

  // --- fb_ads table migrations ---
  const adCols = db.prepare("PRAGMA table_info('fb_ads')").all().map(c => c.name);
  if (!adCols.includes('fb_created_time')) {
    db.exec("ALTER TABLE fb_ads ADD COLUMN fb_created_time TEXT");
  }
  if (!adCols.includes('video_id')) {
    db.exec("ALTER TABLE fb_ads ADD COLUMN video_id TEXT");
  }
  if (!adCols.includes('video_transcript')) {
    db.exec("ALTER TABLE fb_ads ADD COLUMN video_transcript TEXT");
  }
  if (!adCols.includes('video_description')) {
    db.exec("ALTER TABLE fb_ads ADD COLUMN video_description TEXT");
  }

  // Recreate fb_ads if CHECK constraint is outdated (old: winner/scalable/efficient/fatigued/loser/insufficient → new: winner/potential/loser/new)
  try {
    db.exec("UPDATE fb_ads SET classification = 'new' WHERE classification = 'new' AND 0"); // no-op to test
  } catch (e) {
    if (e.message.includes('CHECK constraint')) {
      // Need to rebuild the table with new CHECK
      db.exec(`
        CREATE TABLE fb_ads_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand_id INTEGER NOT NULL,
          fb_ad_id TEXT NOT NULL,
          fb_adset_id TEXT,
          fb_campaign_id TEXT,
          ad_name TEXT,
          status TEXT,
          headline TEXT,
          body TEXT,
          image_url TEXT,
          thumbnail_url TEXT,
          video_url TEXT,
          call_to_action TEXT,
          parsed_brand TEXT,
          parsed_batch TEXT,
          parsed_copy_style TEXT,
          parsed_awareness TEXT,
          parsed_angle_type TEXT,
          parsed_angle_num TEXT,
          parsed_audience TEXT,
          parsed_creator TEXT,
          parsed_editor TEXT,
          parsed_version TEXT,
          naming_format TEXT DEFAULT 'unparsed' CHECK(naming_format IN ('mtrx', 'unparsed')),
          spend REAL DEFAULT 0,
          impressions INTEGER DEFAULT 0,
          clicks INTEGER DEFAULT 0,
          ctr REAL DEFAULT 0,
          cpm REAL DEFAULT 0,
          cpc REAL DEFAULT 0,
          purchases INTEGER DEFAULT 0,
          cpa REAL DEFAULT 0,
          revenue REAL DEFAULT 0,
          roas REAL DEFAULT 0,
          classification TEXT DEFAULT 'new' CHECK(classification IN ('winner', 'potential', 'loser', 'new')),
          fb_created_time TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE,
          UNIQUE(brand_id, fb_ad_id)
        );
        INSERT INTO fb_ads_new (
          id, brand_id, fb_ad_id, fb_adset_id, fb_campaign_id, ad_name, status,
          headline, body, image_url, thumbnail_url, video_url, call_to_action,
          parsed_brand, parsed_batch, parsed_copy_style, parsed_awareness,
          parsed_angle_type, parsed_angle_num, parsed_audience, parsed_creator,
          parsed_editor, parsed_version, naming_format,
          spend, impressions, clicks, ctr, cpm, cpc, purchases, cpa, revenue, roas,
          classification, created_at, updated_at
        )
        SELECT
          id, brand_id, fb_ad_id, fb_adset_id, fb_campaign_id, ad_name, status,
          headline, body, image_url, thumbnail_url, video_url, call_to_action,
          parsed_brand, parsed_batch, parsed_copy_style, parsed_awareness,
          parsed_angle_type, parsed_angle_num, parsed_audience, parsed_creator,
          parsed_editor, parsed_version, naming_format,
          spend, impressions, clicks, ctr, cpm, cpc, purchases, cpa, revenue, roas,
          'new', created_at, updated_at
        FROM fb_ads;
        DROP TABLE fb_ads;
        ALTER TABLE fb_ads_new RENAME TO fb_ads;
        CREATE INDEX IF NOT EXISTS idx_fb_ads_brand ON fb_ads(brand_id);
        CREATE INDEX IF NOT EXISTS idx_fb_ads_classification ON fb_ads(brand_id, classification);
      `);
    }
  }

  // --- fb_analysis_cache migrations ---
  try {
    db.exec("INSERT INTO fb_analysis_cache (brand_id, analysis_type, data, expires_at) VALUES (0, 'test_suggestions', '{}', datetime('now', '-1 hour'))");
    db.exec("DELETE FROM fb_analysis_cache WHERE brand_id = 0 AND analysis_type = 'test_suggestions'");
  } catch (e) {
    if (e.message.includes('CHECK constraint')) {
      db.exec(`
        CREATE TABLE fb_analysis_cache_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand_id INTEGER NOT NULL,
          analysis_type TEXT NOT NULL CHECK(analysis_type IN ('classification', 'patterns', 'brief', 'strategic_insights', 'test_suggestions')),
          data TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          expires_at TEXT,
          FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE
        );
        INSERT INTO fb_analysis_cache_new (id, brand_id, analysis_type, data, created_at, expires_at)
          SELECT id, brand_id, analysis_type, data, created_at, expires_at FROM fb_analysis_cache;
        DROP TABLE fb_analysis_cache;
        ALTER TABLE fb_analysis_cache_new RENAME TO fb_analysis_cache;
        CREATE INDEX IF NOT EXISTS idx_fb_analysis_type ON fb_analysis_cache(brand_id, analysis_type);
      `);
    }
  }
}

function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

module.exports = { getDb, closeDb };
