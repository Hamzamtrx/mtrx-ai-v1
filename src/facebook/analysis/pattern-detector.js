/**
 * Pattern Detector — finds patterns across winning ads
 * Analyzes copy patterns, angle patterns, audience patterns, creator patterns
 */

const { getDb } = require('../../database/db');

/**
 * Detect all patterns for a brand's winning/efficient ads
 * @param {number} brandId
 * @returns {object} Pattern analysis results
 */
function detectPatterns(brandId) {
  const db = getDb();

  const winners = db.prepare(`
    SELECT * FROM fb_ads
    WHERE brand_id = ? AND classification IN ('winner', 'potential')
    ORDER BY roas DESC
  `).all(brandId);

  const losers = db.prepare(`
    SELECT * FROM fb_ads
    WHERE brand_id = ? AND classification = 'loser'
    ORDER BY cpa DESC
  `).all(brandId);

  const allClassified = db.prepare(`
    SELECT * FROM fb_ads
    WHERE brand_id = ? AND classification != 'new'
  `).all(brandId);

  if (winners.length === 0) {
    return { hasData: false, message: 'No winning ads found. Need more data or spend.' };
  }

  return {
    hasData: true,
    copyPatterns: analyzeCopyPatterns(winners, losers),
    anglePatterns: analyzeAnglePatterns(allClassified),
    audiencePatterns: analyzeAudiencePatterns(allClassified),
    creatorPatterns: analyzeCreatorPatterns(allClassified),
    topPerformers: getTopPerformers(winners),
    winnerCount: winners.length,
    loserCount: losers.length,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Analyze copy patterns in winning vs losing ads
 */
function analyzeCopyPatterns(winners, losers) {
  const winnerCopy = winners.filter(a => a.body || a.video_transcript)
    .map(a => [a.body, a.video_transcript].filter(Boolean).join('\n\n'));
  const loserCopy = losers.filter(a => a.body || a.video_transcript)
    .map(a => [a.body, a.video_transcript].filter(Boolean).join('\n\n'));

  if (winnerCopy.length === 0) return { hasData: false };

  // Length analysis
  const winnerLengths = winnerCopy.map(c => c.length);
  const loserLengths = loserCopy.map(c => c.length);
  const avgWinnerLength = avg(winnerLengths);
  const avgLoserLength = avg(loserLengths);

  // Emoji usage
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  const winnerEmojiRate = winnerCopy.filter(c => emojiRegex.test(c)).length / winnerCopy.length;
  const loserEmojiRate = loserCopy.length > 0
    ? loserCopy.filter(c => emojiRegex.test(c)).length / loserCopy.length
    : 0;

  // Question usage
  const winnerQuestionRate = winnerCopy.filter(c => c.includes('?')).length / winnerCopy.length;

  // Line break / structure analysis
  const winnerLineBreaks = winnerCopy.map(c => (c.match(/\n/g) || []).length);
  const avgWinnerLineBreaks = avg(winnerLineBreaks);

  // Power words detection
  const powerWords = [
    'free', 'new', 'proven', 'guaranteed', 'limited', 'exclusive', 'secret',
    'discover', 'instant', 'now', 'today', 'save', 'results', 'easy',
    'transform', 'unlock', 'finally', 'imagine', 'stop', 'never',
    'best', 'amazing', 'love', 'perfect', 'game-changer', 'obsessed',
  ];
  const winnerPowerWordFreqs = countWordFrequency(winnerCopy, powerWords);
  const loserPowerWordFreqs = countWordFrequency(loserCopy, powerWords);

  // Tone analysis (simple heuristic)
  const toneIndicators = detectTone(winnerCopy);

  return {
    hasData: true,
    length: {
      winnerAvg: Math.round(avgWinnerLength),
      loserAvg: Math.round(avgLoserLength),
      recommendation: avgWinnerLength < avgLoserLength ? 'shorter' : 'longer',
    },
    emojiUsage: {
      winnerRate: Math.round(winnerEmojiRate * 100),
      loserRate: Math.round(loserEmojiRate * 100),
    },
    questionUsage: {
      winnerRate: Math.round(winnerQuestionRate * 100),
    },
    structure: {
      avgLineBreaks: Math.round(avgWinnerLineBreaks),
      recommendation: avgWinnerLineBreaks > 3 ? 'structured with line breaks' : 'more compact',
    },
    powerWords: {
      winnerTop: topN(winnerPowerWordFreqs, 5),
      loserTop: topN(loserPowerWordFreqs, 5),
    },
    tone: toneIndicators,
    sampleWinnerCopy: winnerCopy.slice(0, 3),
  };
}

/**
 * Analyze performance by angle type (from MTRX naming)
 */
function analyzeAnglePatterns(ads) {
  const byAngle = groupBy(ads.filter(a => a.parsed_angle_type), 'parsed_angle_type');
  return summarizeGroups(byAngle);
}

/**
 * Analyze performance by audience (from MTRX naming)
 */
function analyzeAudiencePatterns(ads) {
  const byAudience = groupBy(ads.filter(a => a.parsed_audience), 'parsed_audience');
  return summarizeGroups(byAudience);
}

/**
 * Analyze performance by creator (from MTRX naming)
 */
function analyzeCreatorPatterns(ads) {
  const byCreator = groupBy(ads.filter(a => a.parsed_creator), 'parsed_creator');
  return summarizeGroups(byCreator);
}

/**
 * Get top performing ads with details
 */
function getTopPerformers(winners) {
  return winners.slice(0, 10).map(ad => ({
    name: ad.ad_name,
    spend: ad.spend,
    cpa: ad.cpa,
    roas: ad.roas,
    purchases: ad.purchases,
    headline: ad.headline,
    body: ad.body ? ad.body.substring(0, 200) : '',
    angle: ad.parsed_angle_type,
    audience: ad.parsed_audience,
  }));
}

// --- Helpers ---

function groupBy(arr, key) {
  const groups = {};
  for (const item of arr) {
    const val = item[key];
    if (!val) continue;
    if (!groups[val]) groups[val] = [];
    groups[val].push(item);
  }
  return groups;
}

function summarizeGroups(groups) {
  const summaries = [];
  for (const [name, ads] of Object.entries(groups)) {
    const totalSpend = ads.reduce((s, a) => s + a.spend, 0);
    const totalPurchases = ads.reduce((s, a) => s + a.purchases, 0);
    const avgCpa = totalPurchases > 0 ? totalSpend / totalPurchases : 0;
    const totalRevenue = ads.reduce((s, a) => s + a.revenue, 0);
    const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const winnerCount = ads.filter(a => a.classification === 'winner').length;

    summaries.push({
      name,
      adCount: ads.length,
      totalSpend: Math.round(totalSpend * 100) / 100,
      avgCpa: Math.round(avgCpa * 100) / 100,
      avgRoas: Math.round(avgRoas * 100) / 100,
      winnerRate: ads.length > 0 ? Math.round((winnerCount / ads.length) * 100) : 0,
    });
  }
  return summaries.sort((a, b) => a.avgCpa - b.avgCpa);
}

function avg(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function countWordFrequency(texts, targetWords) {
  const freq = {};
  for (const word of targetWords) freq[word] = 0;

  for (const text of texts) {
    const lower = text.toLowerCase();
    for (const word of targetWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lower.match(regex);
      if (matches) freq[word] += matches.length;
    }
  }
  return freq;
}

function topN(freqMap, n) {
  return Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .filter(([, count]) => count > 0)
    .map(([word, count]) => ({ word, count }));
}

function detectTone(texts) {
  let urgency = 0, social = 0, emotional = 0, benefit = 0;
  const total = texts.length || 1;

  for (const text of texts) {
    const lower = text.toLowerCase();
    if (/\b(now|today|limited|hurry|last chance|don't miss)\b/.test(lower)) urgency++;
    if (/\b(everyone|people|they|community|join|viral|trending)\b/.test(lower)) social++;
    if (/\b(love|hate|obsessed|amazing|life.changing|incredible|finally)\b/.test(lower)) emotional++;
    if (/\b(save|get|achieve|boost|improve|transform|results)\b/.test(lower)) benefit++;
  }

  return {
    urgency: Math.round((urgency / total) * 100),
    socialProof: Math.round((social / total) * 100),
    emotional: Math.round((emotional / total) * 100),
    benefitFocused: Math.round((benefit / total) * 100),
  };
}

module.exports = { detectPatterns };
