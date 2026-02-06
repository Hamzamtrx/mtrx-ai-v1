/**
 * Ad Performance Classifier
 * Classifications:
 *   Winner — Top performers by spend that hit the ROAS goal
 *            - Last 30 days: Top 5
 *            - Lifetime: Top 10
 *   Potential — Next tier by spend that hit the ROAS goal
 *            - Last 30 days: Top 6-20
 *            - Lifetime: Top 11-20
 *   New — Ad launched less than 7 days ago
 *   Loser — Everything else (turned off, not hitting ROAS, or outside top 20)
 */

const { getDb } = require('../../database/db');

/**
 * Calculate account benchmarks from all ads with sufficient data
 * @param {number} brandId
 * @returns {object} { medianSpend, medianCpa, avgCtr, totalAds }
 */
function calculateBenchmarks(brandId) {
  const db = getDb();
  const ads = db.prepare(`
    SELECT spend, cpa, ctr, purchases, roas
    FROM fb_ads
    WHERE brand_id = ? AND purchases >= 1 AND spend >= 10
    ORDER BY spend DESC
  `).all(brandId);

  if (ads.length === 0) {
    return { medianSpend: 0, medianCpa: 0, avgCtr: 0, avgRoas: 0, totalAds: 0 };
  }

  const spends = ads.map(a => a.spend).sort((a, b) => a - b);
  const cpas = ads.map(a => a.cpa).filter(c => c > 0).sort((a, b) => a - b);
  const ctrs = ads.map(a => a.ctr).filter(c => c > 0);
  const roass = ads.map(a => a.roas).filter(r => r > 0);

  return {
    medianSpend: median(spends),
    medianCpa: median(cpas),
    avgCtr: ctrs.length > 0 ? ctrs.reduce((s, c) => s + c, 0) / ctrs.length : 0,
    avgRoas: roass.length > 0 ? roass.reduce((s, r) => s + r, 0) / roass.length : 0,
    totalAds: ads.length,
  };
}

function median(sorted) {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Classify all ads for a brand using time-based thresholds:
 *   Last 30 days: Winner = Top 5, Potential = 6-20
 *   Lifetime: Winner = Top 10, Potential = 11-20
 *   New = launched < 7 days ago
 *   Loser = everything else
 *
 * @param {number} brandId
 * @param {string} datePreset - 'last_30d', 'last_90d', or 'lifetime'
 * @returns {object} Classification summary
 */
function classifyAllAds(brandId, datePreset = 'last_90d') {
  const db = getDb();
  const benchmarks = calculateBenchmarks(brandId);

  // Get brand goals
  const brand = db.prepare('SELECT target_roas, target_cpa FROM brands WHERE id = ?').get(brandId);
  let targetRoas = brand?.target_roas || 0;
  let targetCpa = brand?.target_cpa || 0;

  // If no goals set, fall back to account median as baseline
  if (targetRoas === 0 && targetCpa === 0) {
    targetRoas = benchmarks.avgRoas > 0 ? benchmarks.avgRoas : 1;
    targetCpa = benchmarks.medianCpa > 0 ? benchmarks.medianCpa : 999999;
  }
  // If only ROAS set, don't restrict by CPA for winners
  if (targetCpa === 0) targetCpa = 999999;
  // If only CPA set, use 1x ROAS as minimum
  if (targetRoas === 0) targetRoas = 1;

  const allAds = db.prepare('SELECT * FROM fb_ads WHERE brand_id = ? ORDER BY roas DESC').all(brandId);
  const updateStmt = db.prepare("UPDATE fb_ads SET classification = ?, updated_at = datetime('now') WHERE id = ?");

  const counts = { winner: 0, potential: 0, loser: 0, new: 0 };
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // First pass: identify "new" ads (launched < 7 days ago)
  const newAdIds = new Set();
  for (const ad of allAds) {
    if (ad.fb_created_time) {
      const createdDate = new Date(ad.fb_created_time);
      if (createdDate > sevenDaysAgo) {
        newAdIds.add(ad.id);
      }
    }
  }

  // Sort ads that are NOT new by spend descending for ranking
  // Winners must be ACTIVE, but paused ads can be potential if they have good metrics
  const activeAds = allAds.filter(ad => !newAdIds.has(ad.id) && ad.status === 'ACTIVE' && ad.purchases >= 1 && ad.spend >= 10);
  const pausedAds = allAds.filter(ad => !newAdIds.has(ad.id) && ad.status === 'PAUSED' && ad.purchases >= 1 && ad.spend >= 10);

  activeAds.sort((a, b) => b.spend - a.spend);
  pausedAds.sort((a, b) => b.spend - a.spend);

  // Track top performers that hit ROAS goal
  // Thresholds adjust based on date range:
  //   - Last 30 days: stricter (top 5 winners, 6-20 potential)
  //   - Lifetime/90d: expanded (top 10 winners, 11-20 potential)
  const isShortRange = datePreset === 'last_30d';
  const maxWinners = isShortRange ? 5 : 10;
  const maxPotential = isShortRange ? 15 : 10; // total top 20 either way

  let winnerCount = 0;
  let potentialCount = 0;
  const winnerIds = new Set();
  const potentialIds = new Set();

  // First pass: assign winners from ACTIVE ads only
  for (const ad of activeAds) {
    const hitsRoas = ad.roas >= targetRoas;
    if (winnerCount < maxWinners && hitsRoas) {
      winnerIds.add(ad.id);
      winnerCount++;
    } else if (potentialCount < maxPotential && hitsRoas) {
      potentialIds.add(ad.id);
      potentialCount++;
    }
  }

  // Second pass: paused ads with good metrics become potential (no limit - these are historical winners)
  for (const ad of pausedAds) {
    const hitsRoas = ad.roas >= targetRoas;
    if (hitsRoas) {
      potentialIds.add(ad.id);
      potentialCount++;
    }
  }

  const classifyTransaction = db.transaction(() => {
    for (const ad of allAds) {
      let classification;
      if (newAdIds.has(ad.id)) {
        classification = 'new';
      } else if (winnerIds.has(ad.id)) {
        classification = 'winner';
      } else if (potentialIds.has(ad.id)) {
        classification = 'potential';
      } else {
        classification = 'loser';
      }
      updateStmt.run(classification, ad.id);
      counts[classification]++;
    }
  });

  classifyTransaction();

  // Cache results
  db.prepare(`
    INSERT INTO fb_analysis_cache (brand_id, analysis_type, data, expires_at)
    VALUES (?, 'classification', ?, datetime('now', '+6 hours'))
  `).run(brandId, JSON.stringify({
    benchmarks,
    counts,
    goals: { targetRoas, targetCpa },
    timestamp: new Date().toISOString(),
  }));

  return { benchmarks, classifications: counts, totalClassified: allAds.length, goals: { targetRoas, targetCpa } };
}

module.exports = { classifyAllAds, calculateBenchmarks };
