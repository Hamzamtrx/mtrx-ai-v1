/**
 * Strategic Insights — Claude-powered deep analysis of ad performance
 * Answers the real questions a media buyer needs to know
 */

const Anthropic = require('@anthropic-ai/sdk');
const { getDb } = require('../../database/db');

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

  // Get top 15 ads by spend
  const topAds = db.prepare(`
    SELECT * FROM fb_ads
    WHERE brand_id = ? AND spend > 0
    ORDER BY spend DESC
    LIMIT 15
  `).all(brandId);

  if (topAds.length === 0) {
    return {
      success: false,
      message: 'No ads with spend data found. Sync your Facebook data first.',
    };
  }

  // Log what content we actually have
  const withTranscript = topAds.filter(a => a.video_transcript).length;
  const withVisuals = topAds.filter(a => a.video_description).length;
  console.log(`[Strategic Insights] Analyzing top ${topAds.length} ads by spend...`);
  console.log(`[Strategic Insights] Content: ${withTranscript} have transcripts, ${withVisuals} have visual descriptions`);

  // Build prompt for Claude
  const prompt = buildStrategicPrompt(brand, { topAds });

  // Call Claude
  console.log(`[Strategic Insights] Calling Claude for brand ${brandId}, prompt length: ${prompt.length} chars`);
  const client = new Anthropic();
  const response = await client.messages.create({
    model: 'claude-opus-4-5-20251101',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });
  console.log(`[Strategic Insights] Claude response received, ${response.content[0].text.length} chars`);

  const rawText = response.content[0].text;

  // Parse structured JSON from Claude's response
  const insights = parseInsightsResponse(rawText);

  // Add meta information
  insights._meta = {
    totalAdsAnalyzed: topAds.length,
  };

  // Cache for 6 hours
  db.prepare(`
    INSERT INTO fb_analysis_cache (brand_id, analysis_type, data, expires_at)
    VALUES (?, 'strategic_insights', ?, datetime('now', '+6 hours'))
  `).run(brandId, JSON.stringify(insights));

  return { success: true, insights };
}

function buildStrategicPrompt(brand, data) {
  const { topAds } = data;

  // Format ad — ONLY video content (transcript + visuals), no ad copy
  const formatAd = (ad) => {
    const parts = [];
    parts.push(`  Name: ${ad.ad_name}`);
    parts.push(`  Spend: $${ad.spend?.toFixed(0)} | Purchases: ${ad.purchases} | ROAS: ${ad.roas?.toFixed(2)}x`);

    // TRANSCRIPT — what the person in the video SAYS (most important)
    if (ad.video_transcript) {
      parts.push(`  TRANSCRIPT (what they say): "${ad.video_transcript.substring(0, 1000)}"`);
    } else {
      parts.push(`  TRANSCRIPT: [not available]`);
    }

    // VISUALS — what you SEE in the video (Gemini description)
    if (ad.video_description) {
      parts.push(`  VISUALS (what you see): "${ad.video_description.substring(0, 800)}"`);
    } else {
      parts.push(`  VISUALS: [not available]`);
    }

    return parts.join('\n');
  };

  let prompt = `You are a performance creative strategist analyzing Facebook VIDEO ADS for ${brand.name}.

CRITICAL — READ THIS:
- Ads sorted by SPEND (highest first). HIGH SPEND = WINNER — Facebook scales what converts.
- ONLY analyze what's IN THE VIDEO:
  • TRANSCRIPT = what the person SAYS in the video
  • VISUALS = what you SEE in the video (scenes, person, setting, text overlays)
- DO NOT reference "ad copy" or "primary text" — that's just the caption below the video, not the actual creative.
- The ad NAME is just internal naming convention — don't analyze it as creative content.
- Low-spend ads = Facebook stopped spending (losers) or new tests.

## TOP 15 ADS BY SPEND
${topAds.map((ad, i) => `[Ad ${i + 1}]\n${formatAd(ad)}`).join('\n\n')}

---

## OUTPUT FORMAT

Respond in JSON. Each section must use BULLET POINTS, not paragraphs. Be concise and specific.

{
  "winningAngles": {
    "title": "What Angles Are Working",
    "summary": "One line summary",
    "details": "Use bullet points. What angles/hooks are the creators SAYING in the top spending videos? Reference TRANSCRIPT.\\n• Example: 'Polyester comparison' — creator mentions this in Ad 1, Ad 3, Ad 5 transcripts\\n• Example: 'Dad bod' pain point — Ad 2 opens with 'tired of your gut showing through shirts'\\n• What verbal hooks appear in multiple top spenders?",
    "confidence": "high/medium/low"
  },
  "creatorAnalysis": {
    "title": "What Creators Work",
    "summary": "One line summary",
    "details": "Use bullet points. Based on VIDEO VISUAL ANALYSIS and TRANSCRIPT, describe:\\n• What type of person appears (age, gender, energy, style)\\n• Delivery style that works (calm, excited, educational, testimonial)\\n• Specific examples: 'Ad 3 uses middle-aged man, casual tone, $X spend'",
    "confidence": "high/medium/low"
  },
  "visualAndFormat": {
    "title": "Visual & Format Patterns",
    "summary": "One line summary",
    "details": "Use bullet points. Based on VISUALS field — what do you SEE in the winning videos?\\n• Setting/location (bathroom, bedroom, outdoors, studio)\\n• Person appearance (age, gender, clothing, energy)\\n• Format (talking head, lifestyle b-roll, product demo, split screen)\\n• Text overlays or captions visible in video\\n• Example: 'Top 3 spenders show middle-aged man in casual home setting'",
    "confidence": "high/medium/low"
  },
  "iterationIdeas": {
    "title": "Iterations to Test",
    "summary": "One line summary",
    "details": "Use bullet points. For the top 3 spending ads, suggest simple iterations:\\n• Ad 1: Try [specific change] because [reason]\\n• Ad 1: Test [variation]\\n• Ad 2: Swap hook to [X] — this worked in Ad 4\\nKeep suggestions simple and actionable, not jargon-y.",
    "confidence": "high/medium/low"
  },
  "newAngles": {
    "title": "New Angles to Test",
    "summary": "One line summary",
    "details": "Use bullet points. Suggest 3-5 fresh angles NOT currently in top spenders:\\n• [Angle idea] — why it might work\\n• [Angle idea] — based on [evidence]\\nMake each specific enough to brief a creator.",
    "confidence": "high/medium/low"
  },
  "doubleDown": {
    "title": "Double Down On",
    "summary": "One line summary",
    "details": "Use bullet points. What's clearly working that deserves MORE creative variations?\\n• Make more [format/style] ads like Ad X\\n• This avatar/creator type is winning — find similar\\n• This hook pattern appears in 4/5 top spenders — create variations",
    "confidence": "high/medium/low"
  },
  "audienceSignals": {
    "title": "Audience Signals",
    "summary": "One line summary",
    "details": "Use bullet points. Who is this working for?\\n• Target demo based on copy/visuals (age, gender, lifestyle)\\n• Pain points that resonate (from copy and comments)\\n• Awareness level of winning ads (problem-aware, solution-aware, etc.)",
    "confidence": "high/medium/low"
  },
  "killAndAvoid": {
    "title": "What to Stop",
    "summary": "One line summary",
    "details": "Use bullet points. ONLY flag LOW-SPEND ads (bottom of list) that Facebook stopped scaling:\\n• [Ad name] — $X spend, Facebook killed it, avoid [this approach]\\n• Don't test [angle/format] — multiple low-spenders used it\\nNEVER flag high-spend ads as losers — if Facebook is spending, it's working.",
    "confidence": "high/medium/low"
  }
}

IMPORTANT:
- Response must be ONLY valid JSON, no other text
- Use bullet points (•) in details, NOT paragraphs
- ONLY reference what's in the VIDEO (TRANSCRIPT and VISUALS fields)
- DO NOT mention "ad copy", "primary text", or "caption" — we only care about the video content
- If TRANSCRIPT says "[not available]", rely on VISUALS. If both unavailable, skip that ad.
- High spend = winner. Low spend = loser or untested.`;

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
