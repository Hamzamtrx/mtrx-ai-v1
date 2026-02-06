/**
 * Test Suggestion Generator — uses Claude to propose specific ad tests
 * Combines:
 * 1. AI Analysis (video transcripts + visuals from strategic insights)
 * 2. Reddit research (community discussions, pain points)
 * 3. Article/trend research (industry context)
 *
 * HIGH SPEND = WINNER (Facebook scales what converts)
 */

const Anthropic = require('@anthropic-ai/sdk');
const { getDb } = require('../../database/db');

/**
 * Analyze historical ads to detect which territories have been tested
 * PRIORITY: Actual video content (transcript + visuals) > ad naming conventions
 * Returns territory → { ads, totalSpend, avgRoas, bestAd, worstAd, verdict }
 */
function analyzeHistoricalTerritories(ads) {
  const territories = {
    materials_health: { keywords: ['polyester', 'plastic', 'chemical', 'toxic', 'skin', 'health', 'microplastic', 'synthetic', 'natural', 'hemp', 'bamboo', 'cotton', 'pfas', 'burning', 'drchris', 'doctor', 'breathing', 'sweat', 'bacteria'], ads: [] },
    fit_appearance: { keywords: ['gut', 'jacked', 'fit', 'slim', 'muscle', 'arms', 'body', 'look good', 'confident', 'silhouette', 'flattering', 'mup', 'transformation', 'hide', 'belly', 'beer gut', 'dad bod'], ads: [] },
    durability_value: { keywords: ['last', 'durable', 'quality', 'wash', 'fade', 'shrink', 'replace', 'worth', 'investment', 'bifl', 'years', 'buyless', 'still looks', 'held up', 'wears'], ads: [] },
    competitor_comparison: { keywords: ['vs', 'unlike', 'competitor', 'lululemon', 'true classic', 'nike', 'compared', 'better than', 'rating', 'teardown', 'war', 'other brands', 'most shirts'], ads: [] },
    blue_collar_working: { keywords: ['bluecollar', 'blue collar', 'blue_collar', 'working', 'jobsite', 'job site', 'construction', 'trade', 'trades', 'hardworking', 'labor', 'manual'], ads: [] },
    lifestyle_identity: { keywords: ['dad', 'husband', 'man', 'guy', 'lifestyle', 'everyday', 'work', 'weekend', 'casual', 'office', 'date night'], ads: [] },
    price_value: { keywords: ['price', 'cost', 'worth', 'expensive', 'cheap', 'value', 'per wear', 'money', 'afford', 'save', 'budget'], ads: [] },
    female_voice: { keywords: ['forher', 'for her', 'wife', 'girlfriend', 'she bought', 'her husband', 'her boyfriend', 'female', 'woman', 'women', 'her gift', 'hergift'], ads: [] },
    gift_occasion: { keywords: ['gift', 'birthday', 'christmas', 'valentines', 'holiday', 'present', 'bf25', 'nye', 'fathers day', 'anniversary'], ads: [] },
    sustainability: { keywords: ['eco', 'sustainable', 'environment', 'planet', 'green', 'ocean', 'waste', 'fast fashion', 'ethical', 'responsible'], ads: [] },
    founder_story: { keywords: ['founder', 'dalton', 'story', 'why i', 'started', 'built', 'created'], ads: [] },
    ugc_testimonial: { keywords: ['ugc', 'testimonial', 'review', 'rsugc', 'real', 'customer', 'honest', 'my experience', 'been wearing'], ads: [] },
    humor_meme: { keywords: ['comic', 'meme', 'funny', 'joke', 'humor', 'lol', 'haha'], ads: [] },
  };

  // Categorize each ad — PRIORITIZE actual content over naming
  for (const ad of ads) {
    // Check what content we have
    const hasTranscript = ad.video_transcript && ad.video_transcript.length > 50;
    const hasVisuals = ad.video_description && ad.video_description.length > 50;
    const hasRichContent = hasTranscript || hasVisuals;

    // Build search text — prioritize actual content
    let searchText = '';
    let contentSource = 'name_only';

    if (hasTranscript) {
      searchText += ` ${ad.video_transcript}`;
      contentSource = 'transcript';
    }
    if (hasVisuals) {
      searchText += ` ${ad.video_description}`;
      contentSource = hasTranscript ? 'transcript+visuals' : 'visuals';
    }
    // Only fall back to name if no real content
    if (!hasRichContent) {
      searchText = ad.ad_name || '';
      contentSource = 'name_only';
    }
    searchText = searchText.toLowerCase();

    // Set match threshold based on content quality
    // Rich content: need 3+ matches (more text = more keywords expected)
    // Name only: need 1 match (ad names are short, single keyword is meaningful)
    const matchThreshold = hasRichContent ? 3 : 1;

    for (const [territory, data] of Object.entries(territories)) {
      const matchedKeywords = data.keywords.filter(kw => searchText.includes(kw));
      if (matchedKeywords.length >= matchThreshold) {
        data.ads.push({
          name: ad.ad_name,
          spend: ad.spend,
          roas: ad.roas,
          purchases: ad.purchases,
          matchedKeywords,
          contentSource, // Track where the match came from
          hasRichContent,
        });
      }
    }
  }

  // Calculate territory stats
  const result = {};
  for (const [territory, data] of Object.entries(territories)) {
    if (data.ads.length > 0) {
      const totalSpend = data.ads.reduce((sum, a) => sum + (a.spend || 0), 0);
      const avgRoas = data.ads.reduce((sum, a) => sum + (a.roas || 0), 0) / data.ads.length;
      const bestAd = data.ads.reduce((best, a) => (!best || (a.roas || 0) > (best.roas || 0)) ? a : best, null);
      const worstAd = data.ads.reduce((worst, a) => (!worst || (a.roas || 0) < (worst.roas || 0)) ? a : worst, null);

      // Track content quality — how many matches came from actual video content vs ad names
      const adsWithRichContent = data.ads.filter(a => a.hasRichContent).length;
      const contentConfidence = adsWithRichContent > 0 ? 'high' : 'low';
      const contentNote = adsWithRichContent > 0
        ? `${adsWithRichContent}/${data.ads.length} from video content`
        : 'based on ad names only';

      // Determine verdict
      let verdict = 'unknown';
      if (totalSpend > 5000 && avgRoas >= 1.5) verdict = 'proven_winner';
      else if (totalSpend > 2000 && avgRoas >= 1.0) verdict = 'showing_promise';
      else if (totalSpend > 1000 && avgRoas < 1.0) verdict = 'tested_underperformed';
      else if (totalSpend < 500) verdict = 'undertested';

      result[territory] = {
        adCount: data.ads.length,
        totalSpend: Math.round(totalSpend),
        avgRoas: avgRoas.toFixed(2),
        bestAd: bestAd ? { name: bestAd.name?.substring(0, 50), roas: bestAd.roas?.toFixed(2), spend: bestAd.spend } : null,
        worstAd: worstAd ? { name: worstAd.name?.substring(0, 50), roas: worstAd.roas?.toFixed(2), spend: worstAd.spend } : null,
        verdict,
        contentConfidence,
        contentNote,
      };
    }
  }

  return result;
}

/**
 * Generate test suggestions using Claude AI
 * @param {number} brandId
 * @param {Object} options
 * @param {boolean} options.force - Force regeneration, bypass cache
 * @param {Object} options.externalSignals - External signals (Reddit, TikTok, articles)
 * @returns {object} Array of test suggestions
 */
async function generateTestSuggestions(brandId, options = {}) {
  const { force = false, externalSignals = {} } = options;
  const db = getDb();

  // Check cache first (unless force is true)
  if (!force) {
    const cached = db.prepare(`
      SELECT data FROM fb_analysis_cache
      WHERE brand_id = ? AND analysis_type = 'test_suggestions'
      AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(brandId);

    if (cached) {
      console.log('[Test Suggestions] Using cached suggestions (use force=true to regenerate)');
      return { success: true, suggestions: JSON.parse(cached.data), cached: true };
    }
  }

  console.log(`[Test Suggestions] Generating fresh suggestions (force=${force})`);

  const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(brandId);
  if (!brand) throw new Error('Brand not found');

  // Get existing campaigns to avoid suggesting already-tested ideas
  const existingCampaigns = db.prepare(`
    SELECT title, hook, angle FROM test_campaigns
    WHERE brand_id = ? AND status IN ('ready', 'launched', 'completed')
    ORDER BY created_at DESC
    LIMIT 20
  `).all(brandId);

  console.log(`[Test Suggestions] Found ${existingCampaigns.length} existing campaigns to exclude`);

  // Get top 50 ads by spend — HIGH SPEND = WINNER
  const topAds = db.prepare(`
    SELECT * FROM fb_ads
    WHERE brand_id = ? AND spend > 0
    ORDER BY spend DESC
    LIMIT 50
  `).all(brandId);

  if (topAds.length === 0) {
    return {
      success: false,
      message: 'No ads with spend data found. Sync your Facebook data first.',
    };
  }

  // Get ALL historical ads to detect previously tested territories
  // Include video_transcript AND video_description for rich content analysis
  // IMPORTANT: Use high limit to catch low-spend tests that still contain valuable territory data
  const allAds = db.prepare(`
    SELECT ad_name, spend, roas, purchases, video_transcript, video_description, created_at
    FROM fb_ads
    WHERE brand_id = ? AND spend > 0
    ORDER BY spend DESC
    LIMIT 500
  `).all(brandId);

  // Log content availability before territory analysis
  const adsWithTranscript = allAds.filter(a => a.video_transcript && a.video_transcript.length > 50).length;
  const adsWithVisuals = allAds.filter(a => a.video_description && a.video_description.length > 50).length;
  const adsWithRichContent = allAds.filter(a =>
    (a.video_transcript && a.video_transcript.length > 50) ||
    (a.video_description && a.video_description.length > 50)
  ).length;
  console.log(`[Test Suggestions] Historical ads: ${allAds.length} total, ${adsWithTranscript} with transcripts, ${adsWithVisuals} with visuals, ${adsWithRichContent} with rich content`);

  // Analyze historical territories
  const historicalTerritories = analyzeHistoricalTerritories(allAds);
  console.log(`[Test Suggestions] Historical territories detected:`, Object.keys(historicalTerritories).join(', '));

  // Get cached strategic insights if available
  let strategicInsights = null;
  const cachedInsights = db.prepare(`
    SELECT data FROM fb_analysis_cache
    WHERE brand_id = ? AND analysis_type = 'strategic_insights'
    AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `).get(brandId);

  if (cachedInsights) {
    try {
      strategicInsights = JSON.parse(cachedInsights.data);
      console.log('[Test Suggestions] Using cached strategic insights');
    } catch (e) {
      console.log('[Test Suggestions] Could not parse cached insights');
    }
  }

  // Log what content we have
  const withTranscript = topAds.filter(a => a.video_transcript).length;
  const withVisuals = topAds.filter(a => a.video_description).length;
  console.log(`[Test Suggestions] Analyzing top ${topAds.length} ads by spend...`);
  console.log(`[Test Suggestions] Content: ${withTranscript} have transcripts, ${withVisuals} have visual descriptions`);

  const prompt = buildTestSuggestionsPrompt(brand, { topAds, strategicInsights, historicalTerritories, existingCampaigns, externalSignals });

  console.log(`[Test Suggestions] Calling Claude for brand ${brandId}, prompt length: ${prompt.length} chars`);
  const client = new Anthropic();
  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });
  console.log(`[Test Suggestions] Claude response received, ${response.content[0].text.length} chars`);

  const rawText = response.content[0].text;
  const suggestions = parseTestSuggestions(rawText);

  // Cache for 6 hours
  db.prepare(`
    INSERT INTO fb_analysis_cache (brand_id, analysis_type, data, expires_at)
    VALUES (?, 'test_suggestions', ?, datetime('now', '+6 hours'))
  `).run(brandId, JSON.stringify(suggestions));

  return { success: true, suggestions };
}

/**
 * Build external signals section for the prompt
 * Includes Reddit threads, TikTok trends, Facebook comments, articles
 */
function buildExternalSignalsSection(signals = {}) {
  const sections = [];

  // Reddit discussions
  if (signals.reddit && signals.reddit.length > 0) {
    sections.push(`
═══════════════════════════════════════════════════════════════
🔴 FRESH REDDIT SIGNALS
═══════════════════════════════════════════════════════════════

${signals.reddit.map((thread, i) => `
[Reddit ${i + 1}] r/${thread.subreddit || 'unknown'}
Title: "${thread.title}"
Key discussion: ${thread.summary || thread.content?.substring(0, 300) || 'N/A'}
Upvotes: ${thread.upvotes || 'N/A'} | Comments: ${thread.comments || 'N/A'}
${thread.insight ? `💡 Insight: ${thread.insight}` : ''}`).join('\n')}

Use these Reddit signals to find NEW angles or validate existing ideas.`);
  }

  // TikTok trends
  if (signals.tiktok && signals.tiktok.length > 0) {
    sections.push(`
═══════════════════════════════════════════════════════════════
📱 VIRAL TIKTOK SIGNALS
═══════════════════════════════════════════════════════════════

${signals.tiktok.map((video, i) => `
[TikTok ${i + 1}]
Content: "${video.description || video.summary}"
Views: ${video.views || 'N/A'} | Engagement: ${video.engagement || 'N/A'}
${video.hook ? `Hook used: "${video.hook}"` : ''}
${video.insight ? `💡 Insight: ${video.insight}` : ''}`).join('\n')}

Consider TikTok native formats and hooks for test ideas.`);
  }

  // Facebook comments (from strategic insights)
  if (signals.facebookComments && signals.facebookComments.length > 0) {
    sections.push(`
═══════════════════════════════════════════════════════════════
💬 FACEBOOK COMMENT SIGNALS
═══════════════════════════════════════════════════════════════

Recent comments on winning ads reveal customer language and concerns:

${signals.facebookComments.slice(0, 10).map((comment, i) =>
  `[${i + 1}] "${comment.text?.substring(0, 150) || comment}"${comment.likes ? ` (${comment.likes} likes)` : ''}`
).join('\n')}

Use customer language directly in hooks. Address their specific concerns.`);
  }

  // Industry articles/trends
  if (signals.articles && signals.articles.length > 0) {
    sections.push(`
═══════════════════════════════════════════════════════════════
📰 INDUSTRY TREND SIGNALS
═══════════════════════════════════════════════════════════════

${signals.articles.map((article, i) => `
[Article ${i + 1}] ${article.source || 'Unknown source'}
Headline: "${article.title}"
Key point: ${article.summary || article.content?.substring(0, 200) || 'N/A'}
${article.relevance ? `Relevance: ${article.relevance}` : ''}`).join('\n')}

Use trending topics to make ads feel timely and relevant.`);
  }

  // Account changes/movements
  if (signals.accountChanges && signals.accountChanges.length > 0) {
    sections.push(`
═══════════════════════════════════════════════════════════════
📊 RECENT ACCOUNT MOVEMENTS
═══════════════════════════════════════════════════════════════

${signals.accountChanges.map((change, i) => `
[${i + 1}] ${change.type}: ${change.description}
Impact: ${change.impact || 'Unknown'}
${change.implication ? `Implication: ${change.implication}` : ''}`).join('\n')}

React to these changes with appropriate test ideas.`);
  }

  if (sections.length === 0) {
    return ''; // No external signals to include
  }

  return sections.join('\n');
}

function buildTestSuggestionsPrompt(brand, data) {
  const { topAds, strategicInsights, historicalTerritories, existingCampaigns = [], externalSignals = {} } = data;

  // Format ad — prioritize video content (transcript + visuals)
  const formatAd = (ad, rank) => {
    const parts = [];
    parts.push(`  Rank: #${rank} by spend`);
    parts.push(`  Name: ${ad.ad_name}`);
    parts.push(`  Spend: $${ad.spend?.toFixed(0)} | Purchases: ${ad.purchases} | ROAS: ${ad.roas?.toFixed(2)}x`);

    if (ad.video_transcript) {
      parts.push(`  TRANSCRIPT: "${ad.video_transcript.substring(0, 800)}"`);
    }
    if (ad.video_description) {
      parts.push(`  VISUALS: "${ad.video_description.substring(0, 500)}"`);
    }

    return parts.join('\n');
  };

  // Extract angles already tested from ad names and transcripts
  const existingAngles = topAds.map(ad => {
    const angles = [];
    if (ad.ad_name) angles.push(ad.ad_name);
    if (ad.video_transcript) {
      // Extract key themes from transcript
      const transcript = ad.video_transcript.toLowerCase();
      if (transcript.includes('polyester') || transcript.includes('plastic')) angles.push('polyester/plastic');
      if (transcript.includes('gut') || transcript.includes('jacked') || transcript.includes('fit')) angles.push('body transformation');
      if (transcript.includes('competitor') || transcript.includes('vs') || transcript.includes('unlike')) angles.push('competitor comparison');
      if (transcript.includes('health') || transcript.includes('skin') || transcript.includes('chemical')) angles.push('health concern');
    }
    return angles;
  }).flat();

  const winners = topAds.slice(0, 5);
  const midTier = topAds.slice(5, 10);

  // Build insights section
  let insightsSection = '';
  if (strategicInsights) {
    insightsSection = `
STRATEGIC INSIGHTS SUMMARY:
- Winning angles: ${strategicInsights.winningAngles?.summary || 'N/A'}
- Visual patterns: ${strategicInsights.visualAndFormat?.summary || 'N/A'}
- Iteration ideas: ${strategicInsights.iterationIdeas?.summary || 'N/A'}
`;
  }

  const category = brand.category || 'apparel';

  let prompt = `You are a performance creative strategist building a TEST-AND-LEARN system for ${brand.name}.

CRITICAL: This is NOT about remixing winners. It's about LEARNING. Every test must teach you something new.

═══════════════════════════════════════════════════════════════
CURRENT WINNING ADS (what's ALREADY proven)
═══════════════════════════════════════════════════════════════

${winners.map((ad, i) => `[Winner ${i + 1}]\n${formatAd(ad, i + 1)}`).join('\n\n')}

${midTier.length > 0 ? `[Mid-tier ads #6-10 also available for reference]` : ''}

${insightsSection}

ANGLES ALREADY BEING TESTED (from current ads):
${[...new Set(existingAngles)].slice(0, 10).map(a => `• ${a}`).join('\n')}

═══════════════════════════════════════════════════════════════
HISTORICAL TESTING DATA — WHAT HAS BEEN TESTED BEFORE
═══════════════════════════════════════════════════════════════

CRITICAL: Before suggesting an angle, check if this territory has been tested. Include this in your suggestion.

CONTENT CONFIDENCE KEY:
📹 = Detection from actual video content (transcripts + visuals) — HIGH confidence
📛 = Detection from ad names only — LOW confidence, may be inaccurate

${Object.entries(historicalTerritories || {}).map(([territory, data]) => {
    const verdictEmoji = {
      'proven_winner': '✅',
      'showing_promise': '📈',
      'tested_underperformed': '⚠️',
      'undertested': '❓',
      'unknown': '❓',
    }[data.verdict] || '❓';

    const confidenceNote = data.contentConfidence === 'high'
      ? `📹 (${data.contentNote})`
      : `📛 (${data.contentNote})`;

    return `${verdictEmoji} ${territory.toUpperCase()}: ${confidenceNote}
   Ads tested: ${data.adCount} | Total spend: $${data.totalSpend} | Avg ROAS: ${data.avgRoas}x
   Verdict: ${data.verdict.replace('_', ' ')}
   Best performer: ${data.bestAd?.name || 'N/A'} (${data.bestAd?.roas}x ROAS)
   ${data.verdict === 'tested_underperformed' ? '⚠️ This territory underperformed — needs strong justification to retest' : ''}`;
  }).join('\n\n') || 'No historical data available'}

${existingCampaigns.length > 0 ? `
═══════════════════════════════════════════════════════════════
🚫 ALREADY GENERATED TESTS — DO NOT SUGGEST THESE AGAIN
═══════════════════════════════════════════════════════════════

The following tests have ALREADY been created as campaigns. Do NOT suggest similar tests:

${existingCampaigns.map(c => `• "${c.title}" — Hook: "${c.hook || 'N/A'}" — Angle: "${c.angle || 'N/A'}"`).join('\n')}

Suggest NEW tests that explore DIFFERENT angles, hooks, and territories.
` : ''}
${buildExternalSignalsSection(externalSignals)}
═══════════════════════════════════════════════════════════════
BUYER PERSONAS TO CONSIDER
═══════════════════════════════════════════════════════════════

Different buyers have different motivations. Map each test to ONE persona:

1. "health_switcher" — Worried about chemicals/microplastics, researches materials
2. "fit_seeker" — Wants to look better, hide problem areas, feel confident
3. "durability_buyer" — Tired of replacing cheap shirts, wants BIFL quality
4. "eco_conscious" — Cares about sustainability, anti-fast-fashion
5. "skeptic" — Needs proof, reads labels, distrusts DTC marketing claims
6. "gift_buyer" — Shopping for partner/family, wants easy win

═══════════════════════════════════════════════════════════════
YOUR TASK: Generate 6 TRUE TESTS
═══════════════════════════════════════════════════════════════

Each test MUST follow the HYPOTHESIS FORMAT:

**LEARNING**: What do we discover if this wins? What if it loses?
**VEHICLE**: What static format serves this test? (comparison, testimonial, news-style, product hero, meme, UGC)
**ANGLE**: The specific claim or positioning

CRITICAL RULES:
1. At least 2 tests must be UNTESTED TERRITORY (angles NOT in current winners)
2. Maximum 2 tests can be ITERATIONS (variations on proven angles)
3. Each test must target a DIFFERENT persona OR test a different angle
4. If you can't articulate what you LEARN from a win vs loss, it's not a real test
5. EVERY test must have a clear SOURCE with specific evidence

TONE & LANGUAGE RULES (CRITICAL):
- Write like a real person, not a copywriter. No marketing speak.
- Hooks should sound like something a guy would actually say to his friend
- BAD: "I Thought This Was Just Another DTC Scam" — sounds fake, manufactured
- GOOD: "My wife stopped complaining about my shirts" — real, specific, casual
- BAD: "For Guys Who Actually Work For A Living" — vague identity posturing
- GOOD: "Doesn't fall apart after 10 washes" — specific, tangible benefit
- Titles should be DIRECT — say what you mean. Don't hide behind clever phrasing.
- BAD TITLE: "Skeptic Conversion Story" — what does this even mean?
- GOOD TITLE: "Prove It With Numbers" — clear what we're testing
- If an iteration, be EXPLICIT: "Doubling down on [X], but changing [Y]"

DATA LIMITATIONS:
- This system only sees ads in the database. Some tested angles may be missing.
- If you suggest something and it sounds like it "should have been tested," flag it:
  "⚠️ Likely tested before but not in data — ask team to confirm"

You MUST respond with this EXACT JSON structure:

{
  "batch_analysis": {
    "territory_coverage": {
      "materials_health": ["list test titles in this territory"],
      "fit_appearance": ["list test titles"],
      "durability_value": ["list test titles"],
      "lifestyle_identity": ["list test titles"],
      "social_proof": ["list test titles"]
    },
    "overlap_warnings": ["Flag if 2+ tests share the same underlying thesis"],
    "persona_coverage": {
      "health_switcher": 0,
      "fit_seeker": 0,
      "durability_buyer": 0,
      "eco_conscious": 0,
      "skeptic": 0,
      "gift_buyer": 0
    },
    "mix_summary": "X new territory, Y iterations"
  },
  "tests": [
    {
      "title": "Direct, clear name that says what we're testing (no clever phrasing)",
      "type": "iteration | new_territory",
      "iteration_detail": "(REQUIRED if type=iteration) What are we doubling down on? What's the ONE thing we're changing?",
      "hypothesis": {
        "learning": "If this wins, we learn X. If it loses, we learn Y.",
        "vehicle": "comparison | testimonial | news_editorial | product_hero | meme | ugc_style | before_after",
        "angle": "The specific claim being tested"
      },
      "persona": {
        "id": "health_switcher | fit_seeker | durability_buyer | eco_conscious | skeptic | gift_buyer",
        "description": "Who exactly is this person?",
        "creative_implication": "How does this persona change the ad? (e.g., 'Gift buyer = her voice shopping for him, not his voice')"
      },
      "hook": "The headline (5-10 words)",
      "why_untested": "What makes this different from current winners (required if type=new_territory)",
      "source": {
        "type": "facebook_data | reddit | trend",
        "evidence": "Specific evidence: 'Winner #3 transcript mentions X' or 'r/malefashionadvice thread about Y' or 'GQ article on Z'"
      },
      "confidence": {
        "spend_likelihood": "high | medium | low",
        "spend_reasoning": "Will Facebook deliver this? Based on: similarity to winners, audience size, creative execution risk",
        "learning_value": "high | medium | low",
        "learning_reasoning": "What do we gain? High if testing genuinely new variable, low if confirming what we know"
      },
      "territory": "materials_health | fit_appearance | durability_value | lifestyle_identity | social_proof | competitor_comparison | price_value | gift_occasion | sustainability",
      "historical_context": {
        "previously_tested": true | false,
        "likely_tested_no_data": true | false,
        "prior_result": "proven_winner | showing_promise | tested_underperformed | undertested | not_tested | unknown_check_team",
        "warning": "⚠️ Similar angle tested: [result]" | "⚠️ Likely tested before — ask team to confirm" | null,
        "justification": "Why test again despite history (required if previously_tested=true)"
      },
      "recommended_formats": ["The 1-2 static types that best serve this test"]
    }
  ]
}

EXAMPLE OF A GOOD NEW TERRITORY TEST:
{
  "title": "Test: Does Math Beat Emotion?",
  "type": "new_territory",
  "hypothesis": {
    "learning": "If this wins: rational value messaging can work alone. If it loses: emotion/health stays primary driver.",
    "vehicle": "comparison",
    "angle": "Show the math: $40 ÷ 200 wears = $0.20. Your $15 H&M shirt ÷ 10 wears = $1.50."
  },
  "persona": {
    "id": "durability_buyer",
    "description": "Guy tired of replacing shirts, does mental math on purchases",
    "creative_implication": "No emotional appeals. Just show the numbers. Let him do the math himself."
  },
  "hook": "Do the math. I'll wait.",
  "source": {
    "type": "reddit",
    "evidence": "r/BuyItForLife top posts use cost-per-wear math. 'Stop thinking price, think cost per use.'"
  },
  "confidence": {
    "spend_likelihood": "medium",
    "learning_value": "high",
    "learning_reasoning": "New variable — tests if VALUE works without HEALTH"
  }
}

EXAMPLE OF A GOOD ITERATION TEST:
{
  "title": "Same Angle, Female Voice",
  "type": "iteration",
  "iteration_detail": "Doubling down on: polyester-is-plastic angle. Changing: WHO delivers it — wife/girlfriend instead of him.",
  "hypothesis": {
    "learning": "If this wins: third-party endorsement > self-claim. If it loses: his voice is essential.",
    "vehicle": "testimonial"
  },
  "hook": "I made him throw out all his old shirts.",
  "source": {
    "type": "facebook_data",
    "evidence": "Winner #4 polyester angle (2.52x ROAS). Testing same message, different messenger."
  }
}

BAD EXAMPLES (don't do this):
- "I Thought This Was Just Another DTC Scam" — sounds fake, no one talks like this
- "For Guys Who Actually Work For A Living" — vague identity posturing, says nothing specific
- "Skeptic Conversion Story" — WTF does this mean? Be direct.
- Any title that hides behind clever phrasing instead of saying what we're testing

Generate exactly 6 tests. Response must be ONLY the JSON object.`;

  return prompt;
}

function parseTestSuggestions(text) {
  let jsonStr = text.trim();

  // Strip markdown code block if present
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Handle new format with batch_analysis + tests
    if (parsed.tests && Array.isArray(parsed.tests)) {
      return {
        tests: parsed.tests,
        batch_analysis: parsed.batch_analysis || null,
        researchNotes: parsed.research_notes || null,
        generatedAt: new Date().toISOString(),
      };
    }

    // Handle old format (just array of tests)
    if (Array.isArray(parsed)) {
      return { tests: parsed, generatedAt: new Date().toISOString() };
    }

    return { tests: [], raw: text, generatedAt: new Date().toISOString(), parseError: true };
  } catch (e) {
    // Try to find JSON object within text
    const jsonObjMatch = text.match(/\{[\s\S]*\}/);
    if (jsonObjMatch) {
      try {
        const parsed = JSON.parse(jsonObjMatch[0]);
        if (parsed.tests && Array.isArray(parsed.tests)) {
          return {
            tests: parsed.tests,
            batch_analysis: parsed.batch_analysis || null,
            researchNotes: parsed.research_notes || null,
            generatedAt: new Date().toISOString(),
          };
        }
      } catch (e2) {
        // Continue to array match
      }
    }

    // Try to find JSON array within text (fallback)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return { tests: Array.isArray(parsed) ? parsed : [], generatedAt: new Date().toISOString() };
      } catch (e2) {
        return { tests: [], raw: text, generatedAt: new Date().toISOString(), parseError: true };
      }
    }
    return { tests: [], raw: text, generatedAt: new Date().toISOString(), parseError: true };
  }
}

module.exports = { generateTestSuggestions };
