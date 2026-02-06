/**
 * Strategic Insights — Claude-powered deep analysis of ad performance
 * Fetches comments on winning ads, combines with transcripts + visuals
 * Produces focused analysis: angles, comments, creators, iterations
 */

const Anthropic = require('@anthropic-ai/sdk');
const { getDb } = require('../../database/db');
const { GraphApiClient } = require('../data/graph-api');
const { getAccessToken } = require('../data/data-sync');

/**
 * Fetch comments for top ads via Graph API
 * 3-concurrent batches, graceful failure
 * @param {number} brandId
 * @param {Array} ads - ads to fetch comments for (max 10)
 * @param {number} limit - max comments per ad
 * @returns {{ commentsByAdId: Object, failed: boolean }}
 */
async function fetchCommentsForAds(brandId, ads, limit = 8) {
  const commentsByAdId = {};
  let failed = false;

  try {
    const { accessToken } = getAccessToken(brandId);
    const client = new GraphApiClient(accessToken);

    // Process in batches of 3 concurrent requests
    const BATCH_SIZE = 3;
    for (let i = 0; i < ads.length; i += BATCH_SIZE) {
      const batch = ads.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(ad => client.getAdComments(ad.fb_ad_id, limit))
      );

      for (let j = 0; j < results.length; j++) {
        const ad = batch[j];
        const result = results[j];
        if (result.status === 'fulfilled' && result.value.comments?.length > 0) {
          commentsByAdId[ad.fb_ad_id] = result.value.comments;
        }
      }
    }

    console.log(`[Strategic Insights] Fetched comments for ${Object.keys(commentsByAdId).length}/${ads.length} ads`);
  } catch (err) {
    console.error(`[Strategic Insights] Comment fetching failed:`, err.message);
    failed = true;
  }

  return { commentsByAdId, failed };
}

/**
 * Generate strategic insights using Claude AI
 * @param {number} brandId
 * @returns {object} Structured strategic insights
 */
async function generateStrategicInsights(brandId) {
  const db = getDb();

  // Get brand info
  const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(brandId);
  if (!brand) throw new Error('Brand not found');

  // Get winners (top 5 by spend with purchases)
  const winners = db.prepare(`
    SELECT * FROM fb_ads
    WHERE brand_id = ? AND spend > 0 AND classification = 'winner'
    ORDER BY spend DESC
    LIMIT 5
  `).all(brandId);

  // Get potential ads (next tier)
  const potential = db.prepare(`
    SELECT * FROM fb_ads
    WHERE brand_id = ? AND spend > 0 AND classification = 'potential'
    ORDER BY spend DESC
    LIMIT 5
  `).all(brandId);

  // Get losers (condensed — just name + metrics)
  const losers = db.prepare(`
    SELECT ad_name, spend, purchases, cpa, roas FROM fb_ads
    WHERE brand_id = ? AND spend > 0 AND classification = 'loser'
    ORDER BY spend DESC
    LIMIT 5
  `).all(brandId);

  // Fallback: if no classified ads, use top by spend
  const allAnalyzable = [...winners, ...potential];
  if (allAnalyzable.length === 0) {
    const topBySpend = db.prepare(`
      SELECT * FROM fb_ads
      WHERE brand_id = ? AND spend > 0
      ORDER BY spend DESC
      LIMIT 10
    `).all(brandId);

    if (topBySpend.length === 0) {
      return {
        success: false,
        message: 'No ads with spend data found. Sync your Facebook data first.',
      };
    }

    // Use top by spend as "winners" for prompt
    winners.push(...topBySpend.slice(0, 5));
    potential.push(...topBySpend.slice(5, 10));
  }

  const topAdsForComments = [...winners, ...potential].slice(0, 10);

  // Log what content we have
  const withTranscript = topAdsForComments.filter(a => a.video_transcript).length;
  const withVisuals = topAdsForComments.filter(a => a.video_description).length;
  console.log(`[Strategic Insights] Analyzing ${winners.length} winners + ${potential.length} potential + ${losers.length} losers`);
  console.log(`[Strategic Insights] Content: ${withTranscript} transcripts, ${withVisuals} visual descriptions`);

  // Fetch comments for top 10 ads
  console.log(`[Strategic Insights] Fetching comments for top ${topAdsForComments.length} ads...`);
  const { commentsByAdId, failed: commentsFailed } = await fetchCommentsForAds(brandId, topAdsForComments);
  const adsWithComments = Object.keys(commentsByAdId).length;

  // Build prompt for Claude
  const prompt = buildStrategicPrompt(brand, { winners, potential, losers, commentsByAdId, commentsFailed });

  // Call Claude
  console.log(`[Strategic Insights] Calling Claude for brand ${brandId}, prompt length: ${prompt.length} chars`);
  const client = new Anthropic();
  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });
  console.log(`[Strategic Insights] Claude response received, ${response.content[0].text.length} chars`);

  const rawText = response.content[0].text;

  // Parse structured JSON from Claude's response
  const insights = parseInsightsResponse(rawText);

  // Add meta information
  insights._meta = {
    totalAdsAnalyzed: winners.length + potential.length + losers.length,
    commentsFetched: !commentsFailed,
    adsWithComments,
    winnersCount: winners.length,
    potentialCount: potential.length,
    losersCount: losers.length,
  };

  // Cache for 6 hours
  db.prepare(`
    INSERT INTO fb_analysis_cache (brand_id, analysis_type, data, expires_at)
    VALUES (?, 'strategic_insights', ?, datetime('now', '+6 hours'))
  `).run(brandId, JSON.stringify(insights));

  return { success: true, insights };
}

function buildStrategicPrompt(brand, data) {
  const { winners, potential, losers, commentsByAdId, commentsFailed } = data;

  // Format ad with full content + optional comments
  const formatAd = (ad, comments) => {
    const parts = [];
    parts.push(`  Name: ${ad.ad_name}`);
    parts.push(`  Spend: $${ad.spend?.toFixed(0)} | Purchases: ${ad.purchases} | CPA: $${ad.cpa?.toFixed(2)} | ROAS: ${ad.roas?.toFixed(2)}x`);

    // TRANSCRIPT — what the person in the video SAYS
    if (ad.video_transcript) {
      parts.push(`  TRANSCRIPT (what they say): "${ad.video_transcript.substring(0, 1000)}"`);
    } else {
      parts.push(`  TRANSCRIPT: [not available]`);
    }

    // VISUALS — what you SEE in the video
    if (ad.video_description) {
      parts.push(`  VISUALS (what you see): "${ad.video_description.substring(0, 800)}"`);
    } else {
      parts.push(`  VISUALS: [not available]`);
    }

    // COMMENTS — what the audience says
    if (comments && comments.length > 0) {
      const commentLines = comments.slice(0, 8).map(c => {
        const likes = c.likeCount > 0 ? ` (${c.likeCount} likes)` : '';
        return `    "${c.message}"${likes}`;
      });
      parts.push(`  COMMENTS (${comments.length} total):\n${commentLines.join('\n')}`);
    }

    return parts.join('\n');
  };

  // Condensed format for losers — just name + metrics, no transcript/visuals
  const formatLoser = (ad) => {
    return `  ${ad.ad_name} — $${ad.spend?.toFixed(0)} spend | ${ad.purchases} purchases | ${ad.roas?.toFixed(2)}x ROAS`;
  };

  // Build sections
  let winnersSection = '';
  if (winners.length > 0) {
    winnersSection = `## WINNERS (Facebook is scaling these — highest spend)\n${winners.map((ad, i) => {
      const comments = commentsByAdId[ad.fb_ad_id] || null;
      return `[Winner ${i + 1}]\n${formatAd(ad, comments)}`;
    }).join('\n\n')}`;
  }

  let potentialSection = '';
  if (potential.length > 0) {
    potentialSection = `## POTENTIAL (Good performance, not yet top tier)\n${potential.map((ad, i) => {
      const comments = commentsByAdId[ad.fb_ad_id] || null;
      return `[Potential ${i + 1}]\n${formatAd(ad, comments)}`;
    }).join('\n\n')}`;
  }

  let losersSection = '';
  if (losers.length > 0) {
    losersSection = `## LOSERS (Facebook stopped spending — avoid these patterns)\n${losers.map(ad => formatLoser(ad)).join('\n')}`;
  }

  const commentNote = commentsFailed
    ? '\nNOTE: Comments could not be fetched (token/permission issue). Skip the commentInsights section — set it to "Comments unavailable for this analysis."'
    : Object.keys(commentsByAdId).length === 0
      ? '\nNOTE: No comments found on these ads. For commentInsights, note that no audience comments are available.'
      : '';

  let prompt = `You are a performance creative strategist analyzing Facebook VIDEO ADS for ${brand.name}.

CRITICAL — READ THIS:
- Winners = Facebook is actively scaling them. HIGH SPEND = the algorithm found buyers.
- ONLY analyze what's IN THE VIDEO:
  • TRANSCRIPT = what the person SAYS in the video
  • VISUALS = what you SEE in the video (scenes, person, setting, text overlays)
  • COMMENTS = what the AUDIENCE says in response
- DO NOT reference "ad copy" or "primary text" — that's the caption below the video, not the creative.
- The ad NAME is internal naming convention — don't analyze it as creative content.
- Losers are shown condensed (name + metrics only) for contrast.
${commentNote}

${winnersSection}

${potentialSection}

${losersSection}

---

## OUTPUT FORMAT

Respond in JSON. Each section must use BULLET POINTS, not paragraphs. Be specific — reference actual ads.

{
  "winningAngles": {
    "title": "What Angles Are Working",
    "summary": "One line summary",
    "details": "Use bullet points. What angles/hooks are creators SAYING in winners?\\n• Reference TRANSCRIPT: 'polyester comparison' appears in Winner 1, 3, 5\\n• What pain points open the video? Quote actual hooks.\\n• Which angles appear across multiple winners vs one-offs?\\n• If COMMENTS reinforce an angle, mention it.",
    "confidence": "high/medium/low"
  },
  "commentInsights": {
    "title": "What Comments Tell Us",
    "summary": "One line summary",
    "details": "Use bullet points. What does the audience SAY in comments?\\n• Objections: what are people pushing back on?\\n• Desires: what do they want more of?\\n• Customer language: exact words/phrases real buyers use (gold for future copy)\\n• Sentiment: excited, skeptical, curious?\\n• Which ads get the most engagement/discussion?",
    "confidence": "high/medium/low"
  },
  "creatorAnalysis": {
    "title": "What Creators Work",
    "summary": "One line summary",
    "details": "Use bullet points. Based on VISUALS and TRANSCRIPT:\\n• What type of person appears (age, gender, energy, style)?\\n• Delivery style: calm educator vs excited testimonial vs authority figure?\\n• Specific examples: 'Winner 2 uses mid-40s man, dad energy, casual home setting'\\n• Which creator types are scaling vs flopping?",
    "confidence": "high/medium/low"
  },
  "visualAndFormat": {
    "title": "Visual & Format Patterns",
    "summary": "One line summary",
    "details": "Use bullet points. From VISUALS field — what do winners look like?\\n• Setting (home, outdoors, studio, car)\\n• Format (talking head, lifestyle, product demo, split screen, unboxing)\\n• Production quality (raw iPhone vs polished)\\n• Text overlays or captions visible\\n• Pattern: 'Top 3 winners all use [X]'",
    "confidence": "high/medium/low"
  },
  "iterationIdeas": {
    "title": "Iterations on Winners",
    "summary": "One line summary",
    "details": "Use bullet points. For each top winner, 2-3 SPECIFIC tweaks to test:\\n• Winner 1: Try [change] because [reason from transcript/comments]\\n• Winner 1: Swap hook to [X] — comments suggest [Y]\\n• Winner 2: Test [variation] — similar angle worked in Potential 3\\nKeep simple and actionable.",
    "confidence": "high/medium/low"
  },
  "newAngles": {
    "title": "New Angles to Try",
    "summary": "One line summary",
    "details": "Use bullet points. 3-5 fresh angles NOT in current winners:\\n• [Angle] — based on [comment theme / performance gap]\\n• [Angle] — this audience cares about [X] (from comments)\\nEach must be specific enough to brief a creator.",
    "confidence": "high/medium/low"
  },
  "audienceSignals": {
    "title": "Audience & Funnel Signals",
    "summary": "One line summary",
    "details": "Use bullet points. Who responds to these ads?\\n• Demographics from visuals + comments (age, gender, lifestyle)\\n• Awareness level of winners (unaware, problem-aware, solution-aware)\\n• Which funnel position are winners targeting?\\n• Any audience segments showing up in comments?",
    "confidence": "high/medium/low"
  },
  "killAndAvoid": {
    "title": "What to Stop & Avoid",
    "summary": "One line summary",
    "details": "Use bullet points. From LOSERS section — what patterns failed?\\n• [Loser name] — $X spend, 0 purchases, avoid [this approach]\\n• Anti-patterns: angles/formats that multiple losers share\\n• NEVER flag high-spend ads as losers — if Facebook spends, it works.",
    "confidence": "high/medium/low"
  }
}

IMPORTANT:
- Response must be ONLY valid JSON, no other text
- Use bullet points (•) in details, NOT paragraphs
- ONLY reference what's in the VIDEO (TRANSCRIPT and VISUALS fields) and COMMENTS
- DO NOT mention "ad copy", "primary text", or "caption" — only video content + comments
- If TRANSCRIPT says "[not available]", rely on VISUALS. If both unavailable, skip that ad.
- Quote actual comments when they reveal customer language or objections
- Winners = high spend. Losers = low spend / killed by Facebook.`;

  return prompt;
}

function parseInsightsResponse(text) {
  // Try to extract JSON from the response
  let jsonStr = text.trim();

  // Strip markdown code block if present
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const parsed = JSON.parse(jsonStr);
    parsed.generatedAt = new Date().toISOString();
    return parsed;
  } catch (e) {
    // Try to find JSON within the text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        parsed.generatedAt = new Date().toISOString();
        return parsed;
      } catch (e2) {
        // Return raw text as fallback
        return {
          raw: text,
          generatedAt: new Date().toISOString(),
          parseError: true,
        };
      }
    }
    return {
      raw: text,
      generatedAt: new Date().toISOString(),
      parseError: true,
    };
  }
}

module.exports = { generateStrategicInsights };
