/**
 * Creative Brief Generator — uses Claude to generate actionable briefs
 * from pattern analysis + winning ad examples
 */

const Anthropic = require('@anthropic-ai/sdk');
const { getDb } = require('../../database/db');
const { detectPatterns } = require('./pattern-detector');
const { classifyAllAds } = require('./classifier');

/**
 * Generate a creative brief for a brand using Claude
 * @param {number} brandId
 * @returns {object} Creative brief
 */
async function generateBrief(brandId) {
  const db = getDb();

  // Get brand info
  const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(brandId);
  if (!brand) throw new Error('Brand not found');

  // Ensure ads are classified
  const classificationResult = classifyAllAds(brandId);

  // Detect patterns
  const patterns = detectPatterns(brandId);
  if (!patterns.hasData) {
    return {
      success: false,
      message: 'Not enough data to generate a brief. Need winning ads with sufficient spend.',
    };
  }

  // Build the prompt
  const prompt = buildBriefPrompt(brand, patterns, classificationResult);

  // Call Claude
  const client = new Anthropic();
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const briefText = response.content[0].text;

  // Parse structured sections from Claude's response
  const brief = parseBriefResponse(briefText);

  // Cache the brief
  db.prepare(`
    INSERT INTO fb_analysis_cache (brand_id, analysis_type, data, expires_at)
    VALUES (?, 'brief', ?, datetime('now', '+12 hours'))
  `).run(brandId, JSON.stringify(brief));

  return { success: true, brief };
}

function buildBriefPrompt(brand, patterns, classification) {
  const { copyPatterns, anglePatterns, audiencePatterns, creatorPatterns, topPerformers } = patterns;

  let prompt = `You are a senior performance creative strategist analyzing Facebook ad data for ${brand.name}${brand.website_url ? ` (${brand.website_url})` : ''}.

Based on the following performance data analysis, generate a creative brief with specific, actionable recommendations.

## Account Overview
- Total classified ads: ${classification.totalClassified}
- Winners: ${classification.classifications.winner || 0}
- Potential: ${classification.classifications.potential || 0}
- Losers: ${classification.classifications.loser || 0}
- New: ${classification.classifications.new || 0}
- Benchmarks: Median CPA $${classification.benchmarks.medianCpa?.toFixed(2) || 'N/A'}, Median Spend $${classification.benchmarks.medianSpend?.toFixed(2) || 'N/A'}

## Top Performing Ads
${topPerformers.map((ad, i) => `${i + 1}. "${ad.name}" — CPA: $${ad.cpa?.toFixed(2)}, ROAS: ${ad.roas?.toFixed(2)}x, Purchases: ${ad.purchases}
   Copy: "${ad.body || 'N/A'}"`).join('\n')}
`;

  if (copyPatterns?.hasData) {
    prompt += `
## Copy Pattern Analysis
- Winning ad avg length: ${copyPatterns.length.winnerAvg} chars (losers: ${copyPatterns.length.loserAvg} chars)
- ${copyPatterns.length.recommendation} copy tends to win
- Emoji usage in winners: ${copyPatterns.emojiUsage.winnerRate}% (losers: ${copyPatterns.emojiUsage.loserRate}%)
- Question hooks in winners: ${copyPatterns.questionUsage.winnerRate}%
- Avg line breaks in winners: ${copyPatterns.structure.avgLineBreaks}
- Top power words in winners: ${copyPatterns.powerWords.winnerTop.map(w => w.word).join(', ') || 'none detected'}
- Tone: Urgency ${copyPatterns.tone.urgency}%, Social proof ${copyPatterns.tone.socialProof}%, Emotional ${copyPatterns.tone.emotional}%, Benefit-focused ${copyPatterns.tone.benefitFocused}%
`;
  }

  if (anglePatterns?.length > 0) {
    prompt += `
## Angle Performance (from MTRX naming)
${anglePatterns.map(a => `- ${a.name}: ${a.adCount} ads, Avg CPA $${a.avgCpa}, ROAS ${a.avgRoas}x, Winner rate ${a.winnerRate}%`).join('\n')}
`;
  }

  if (audiencePatterns?.length > 0) {
    prompt += `
## Audience Performance
${audiencePatterns.map(a => `- ${a.name}: ${a.adCount} ads, Avg CPA $${a.avgCpa}, ROAS ${a.avgRoas}x`).join('\n')}
`;
  }

  if (creatorPatterns?.length > 0) {
    prompt += `
## Creator Performance
${creatorPatterns.map(c => `- ${c.name}: ${c.adCount} ads, Avg CPA $${c.avgCpa}, Winner rate ${c.winnerRate}%`).join('\n')}
`;
  }

  prompt += `

## Your Task
Generate a creative brief with the following sections:

1. **WINNING ANGLES** — What angles/approaches are consistently winning? List the top 3-5 with rationale.
2. **COPY APPROACH** — Based on the copy analysis, what specific copy tactics should the next batch use? Length, tone, structure, hooks.
3. **AUDIENCE INSIGHTS** — Which audiences to prioritize and which to cut.
4. **FATIGUE ALERTS** — Any angles/creatives showing signs of fatigue? What to replace them with.
5. **SPECIFIC RECOMMENDATIONS** — 3-5 specific new ad concepts to test, with angle, hook, copy direction, and target audience.

Be specific and data-driven. Reference actual ad performance numbers. Don't be generic.`;

  return prompt;
}

function parseBriefResponse(text) {
  const sections = {
    raw: text,
    winningAngles: extractSection(text, 'WINNING ANGLES'),
    copyApproach: extractSection(text, 'COPY APPROACH'),
    audienceInsights: extractSection(text, 'AUDIENCE INSIGHTS'),
    fatigueAlerts: extractSection(text, 'FATIGUE ALERTS'),
    recommendations: extractSection(text, 'SPECIFIC RECOMMENDATIONS'),
    generatedAt: new Date().toISOString(),
  };
  return sections;
}

function extractSection(text, sectionName) {
  // Match section header (with or without number prefix, **bold**, ## heading)
  const patterns = [
    new RegExp(`(?:^|\\n)(?:#+\\s*)?(?:\\d+\\.?\\s*)?\\*?\\*?${sectionName}\\*?\\*?[—:\\-]*\\s*\\n([\\s\\S]*?)(?=\\n(?:#+\\s*)?(?:\\d+\\.?\\s*)?\\*?\\*?(?:WINNING|COPY|AUDIENCE|FATIGUE|SPECIFIC)|$)`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }

  return '';
}

module.exports = { generateBrief };
