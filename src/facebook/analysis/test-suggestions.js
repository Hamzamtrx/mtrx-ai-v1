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
const crypto = require('crypto');
const { getDb } = require('../../database/db');
const { getStaticCopy, analyzeStaticCopyForBrand } = require('./static-style-analysis');
const { researchReddit, formatForPrompt } = require('./reddit-research');

/**
 * Generate a unique hash for a suggestion to detect duplicates
 */
function generateSuggestionHash(type, hook, sourceAdId = null) {
  const content = `${type}:${hook.toLowerCase().trim()}:${sourceAdId || ''}`;
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Store suggestions in the database (upsert - skip existing)
 */
function storeSuggestions(brandId, suggestions, type, sourceAdId = null, sourceAdName = null) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO test_suggestions
    (brand_id, suggestion_hash, type, hook, title, source_ad_id, source_ad_name, format_key, angle_key, data, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `);

  let stored = 0;
  for (const suggestion of suggestions) {
    const hook = suggestion.hook || suggestion.title || '';
    if (!hook) continue;

    const hash = generateSuggestionHash(type, hook, sourceAdId);
    try {
      stmt.run(
        brandId,
        hash,
        type,
        hook,
        suggestion.title || null,
        sourceAdId || null,
        sourceAdName || null,
        suggestion.format_key || suggestion.recommended_formats?.[0] || null,
        suggestion.angle_key || suggestion.angle || null,
        JSON.stringify(suggestion)
      );
      stored++;
    } catch (e) {
      // Ignore duplicate constraint errors
      if (!e.message.includes('UNIQUE constraint')) {
        console.error('[Store Suggestion] Error:', e.message);
      }
    }
  }
  return stored;
}

/**
 * Get pending suggestions for a brand (filters out saved/dismissed)
 */
function getPendingSuggestions(brandId) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM test_suggestions
    WHERE brand_id = ? AND status = 'pending'
    ORDER BY created_at DESC
  `).all(brandId);

  return rows.map(row => ({
    id: row.id,
    type: row.type,
    hook: row.hook,
    title: row.title,
    sourceAdId: row.source_ad_id,
    sourceAdName: row.source_ad_name,
    formatKey: row.format_key,
    angleKey: row.angle_key,
    data: row.data ? JSON.parse(row.data) : {},
    createdAt: row.created_at,
  }));
}

/**
 * Mark a suggestion as saved (links to campaign)
 */
function markSuggestionSaved(brandId, hook, campaignId = null) {
  const db = getDb();
  // Find by hook (case-insensitive)
  const result = db.prepare(`
    UPDATE test_suggestions
    SET status = 'saved', saved_at = datetime('now'), campaign_id = ?
    WHERE brand_id = ? AND LOWER(hook) = LOWER(?) AND status = 'pending'
  `).run(campaignId, brandId, hook.trim());
  return result.changes > 0;
}

/**
 * Mark a suggestion as dismissed
 */
function markSuggestionDismissed(suggestionId) {
  const db = getDb();
  const result = db.prepare(`
    UPDATE test_suggestions
    SET status = 'dismissed', dismissed_at = datetime('now')
    WHERE id = ? AND status = 'pending'
  `).run(suggestionId);
  return result.changes > 0;
}

/**
 * Get count of saved/dismissed suggestions this session (last 24h)
 */
function getSuggestionStats(brandId) {
  const db = getDb();
  const stats = db.prepare(`
    SELECT
      COUNT(CASE WHEN status = 'saved' AND saved_at > datetime('now', '-24 hours') THEN 1 END) as saved_today,
      COUNT(CASE WHEN status = 'dismissed' AND dismissed_at > datetime('now', '-24 hours') THEN 1 END) as dismissed_today,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
    FROM test_suggestions WHERE brand_id = ?
  `).get(brandId);
  return stats || { saved_today: 0, dismissed_today: 0, pending: 0 };
}

/**
 * Generate double-down variations for a single winner
 * @param {Object} brand - Brand data
 * @param {Object} winner - Winner ad data
 * @param {Array} excludeHooks - Optional array of hooks to exclude (for regeneration)
 * @param {string} direction - Optional creative direction from user (e.g., "more aggressive", "health focus")
 */
async function generateDoubleDownVariations(brand, winner, excludeHooks = [], direction = null) {
  const client = new Anthropic();
  const formatLabel = winner.format?.label || 'Static';
  const isFounderVideo = winner.format?.key === 'founder' || winner.format?.key === 'video';
  const detectedAngle = winner.angle?.label || 'General';
  const angleDesc = winner.angle?.desc || '';

  // Build exclusion text if we have hooks to avoid
  const exclusionText = excludeHooks.length > 0
    ? `\n\n⚠️ CRITICAL - DO NOT USE THESE HOOKS (already generated, user rejected them):\n${excludeHooks.map(h => `- "${h}"`).join('\n')}\n\nYou MUST generate COMPLETELY DIFFERENT headlines. Do not rephrase the above - create entirely NEW angles.`
    : '';

  // Build direction text if user specified a creative direction
  const directionText = direction
    ? `\n\n🎯 USER DIRECTION: The user wants hooks that are: ${direction}. Follow this direction closely.`
    : '';

  if (excludeHooks.length > 0) {
    console.log(`[Double Down] Excluding hooks:`, excludeHooks);
  }
  if (direction) {
    console.log(`[Double Down] User direction:`, direction);
  }

  let prompt;

  if (isFounderVideo) {
    const transcript = winner.transcript?.substring(0, 1500) || '';
    prompt = `You are a performance creative strategist for ${brand.name}.

This FOUNDER VIDEO is a WINNER. We need to turn it into STATIC ADS.

=== THE FORMULA ===
FORMAT: Founder Video (founder talking to camera, authentic)
ANGLE: ${detectedAngle} ${angleDesc ? `(${angleDesc})` : ''}

Your job: Create 4 static ad headlines that combine FOUNDER FORMAT + ${detectedAngle.toUpperCase()} ANGLE

=== WINNING VIDEO DATA ===
- Title: ${winner.title}
- Detected Angle: ${detectedAngle}
- Spend: $${winner.spend?.toLocaleString() || 'N/A'} | ROAS: ${winner.roas || 'N/A'}x
${transcript ? `\nVIDEO TRANSCRIPT:\n"${transcript}"` : ''}

=== WHAT WE WANT ===
Headlines that combine the founder's authentic voice WITH the specific angle "${detectedAngle}".
${directionText}${exclusionText}

Return ONLY valid JSON array, no explanation:
[
  {"hook": "5-12 word headline", "title": "2-4 word angle name"},
  {"hook": "5-12 word headline", "title": "2-4 word angle name"},
  {"hook": "5-12 word headline", "title": "2-4 word angle name"},
  {"hook": "5-12 word headline", "title": "2-4 word angle name"}
]`;
  } else {
    // Static/other format
    const visualDesc = winner.staticCopy?.visualDescription || '';
    const extractedHeadline = winner.staticCopy?.headline || winner.staticCopy?.subheadline || '';
    const formatKey = winner.format?.key || 'product_hero';

    // Unique context for this specific ad (prevents duplicate generations)
    const uniqueContext = `AD_ID: ${winner.id || winner.fb_ad_id || Math.random().toString(36).substring(7)}`;

    // Format-specific guidance for certain styles
    let formatGuidance = '';
    if (formatKey === 'comparison') {
      formatGuidance = `
=== COMPARISON FORMAT RULES ===
This is a COMPARISON static (e.g., "Brand X vs Brand Y", "Before vs After", "Them vs Us").
Your headlines MUST follow comparison format:
- Use "vs" or "versus" structure
- Show a clear contrast between two things
- Examples: "Their shirt vs Ours", "Polyester vs Hemp", "Synthetic vs Natural", "Weak vs Strong"
- Always pit something negative against something positive
`;
    } else if (formatKey === 'illustrated') {
      formatGuidance = `
=== ILLUSTRATED FORMAT RULES ===
This is an ILLUSTRATED static (comic/cartoon style with characters).
Headlines should be bold, dramatic, and work with illustrated visuals:
- Think comic book energy - bold claims, dramatic contrast
- Often uses character archetypes (weak guy vs strong guy, loser vs winner)
- Examples: "Boys wear plastic, Men wear hemp", "Which one are you?"
`;
    }

    // If we have the actual headline from the image, make the prompt VERY specific about riffing on it
    if (extractedHeadline) {
      prompt = `You are a performance creative strategist for ${brand.name}.

${uniqueContext}

This ${formatLabel} is a WINNER with ${winner.spend > 10000 ? 'MASSIVE' : 'solid'} spend.
${formatGuidance}
=== THE WINNING HEADLINE (from the actual ad image) ===
"${extractedHeadline}"

This EXACT headline drove $${winner.spend?.toLocaleString() || 'N/A'} in spend at ${winner.roas || 'N/A'}x ROAS.
${visualDesc ? `Visual style: ${visualDesc}` : ''}

Your job: Create 4 NEW headline variations that:
1. KEEP THE SAME THEME/ANGLE as "${extractedHeadline}"
2. Use similar emotional triggers and word patterns
3. Test different framings of the SAME core message
4. Could replace the headline on the same visual
5. MUST match the ${formatLabel} style${formatKey === 'comparison' ? ' (use comparison/contrast structure)' : ''}

Examples of good variations (for reference, don't copy):
- If original is "Your shirt is making you infertile" → try "Polyester is destroying your fertility"
- If original is "Real men wear X, weak men wear Y" → try "Boys wear synthetic, men wear natural"
${formatKey === 'comparison' ? '- If original is "Their cotton vs Our hemp" → try "Synthetic vs Natural: Which are you wearing?"' : ''}
${directionText}${exclusionText}

Return ONLY valid JSON array with 4 UNIQUE headline variations:
[
  {"hook": "5-12 word headline riffing on the winner", "title": "2-4 word angle"},
  {"hook": "5-12 word headline riffing on the winner", "title": "2-4 word angle"},
  {"hook": "5-12 word headline riffing on the winner", "title": "2-4 word angle"},
  {"hook": "5-12 word headline riffing on the winner", "title": "2-4 word angle"}
]`;
    } else {
      // No headline extracted - use more generic prompt with unique context
      prompt = `You are a performance creative strategist for ${brand.name}.

${uniqueContext}

This ${formatLabel} is a WINNER with ${winner.spend > 10000 ? 'massive' : 'solid'} spend. Create 4 variations.
${formatGuidance}
=== WINNING AD ===
- Title: ${winner.title}
- Angle: ${detectedAngle} ${angleDesc ? `(${angleDesc})` : ''}
- Spend: $${winner.spend?.toLocaleString() || 'N/A'} | ROAS: ${winner.roas || 'N/A'}x
${visualDesc ? `- Visual: ${visualDesc}` : ''}

Create 4 NEW headlines that:
1. Keep the SAME angle/message that's working
2. Test different hooks/framings
3. Could work with the same visual style
4. MUST match the ${formatLabel} style${formatKey === 'comparison' ? ' (use comparison/contrast structure)' : ''}
${directionText}${exclusionText}

Return ONLY valid JSON array, no explanation:
[
  {"hook": "5-12 word headline", "title": "2-4 word angle name"},
  {"hook": "5-12 word headline", "title": "2-4 word angle name"},
  {"hook": "5-12 word headline", "title": "2-4 word angle name"},
  {"hook": "5-12 word headline", "title": "2-4 word angle name"}
]`;
    }
  }

  // Retry logic for transient API errors
  const maxRetries = 2;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-opus-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].text;
      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const variations = JSON.parse(jsonMatch[0]);
        console.log(`[Double Down] Generated hooks:`, variations.map(v => v.hook));
        return variations.map(v => ({
          ...v,
          type: 'double_down',
          recommended_formats: isFounderVideo ? ['quote_card', 'newspaper', 'product_hero'] : [winner.format?.key || 'product_hero'],
        }));
      }
    } catch (err) {
      const isTransient = err.message.includes('internal error') || err.message.includes('overloaded') || err.message.includes('timeout');
      if (isTransient && attempt < maxRetries) {
        console.log(`[Double Down] Transient error for "${winner.title}", retrying (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
        continue;
      }
      console.error(`[Double Down] Error generating variations for "${winner.title}":`, err.message);
    }
  }
  return [];
}

/**
 * Generate all double-down variations for all winners in parallel
 */
async function generateAllDoubleDownVariations(brand, winners) {
  console.log(`[Double Down] Generating variations for ${winners.length} winners...`);

  // Generate variations for all winners in parallel (max 3 concurrent)
  const batchSize = 3;
  const allVariations = [];

  for (let i = 0; i < winners.length; i += batchSize) {
    const batch = winners.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(winner => generateDoubleDownVariations(brand, winner))
    );

    for (let j = 0; j < results.length; j++) {
      const winner = batch[j];
      const result = results[j];

      if (result.status === 'fulfilled' && result.value.length > 0) {
        allVariations.push({
          winner,
          variations: result.value,
        });
        console.log(`[Double Down] Got ${result.value.length} variations for "${winner.title}"`);
      } else {
        console.log(`[Double Down] No variations for "${winner.title}"`);
      }
    }
  }

  return allVariations;
}

/**
 * Analyze winning ads and provide replication guidance
 * For each top winner, identifies: what's working + how to replicate it
 * Returns array of individual winning ads with creative direction
 */
function analyzeWinningAds(ads) {
  // Get top winners by spend (high spend = Facebook scaled it = it's working)
  // Filter for winners first
  const qualifyingAds = ads.filter(ad => ad.spend > 2000 && ad.roas > 1.2);
  console.log(`[analyzeWinningAds] ${qualifyingAds.length} ads pass threshold (spend > $2k, ROAS > 1.2x)`);

  // Sort by spend (highest first)
  const sortedAds = qualifyingAds.sort((a, b) => b.spend - a.spend);

  // Visual deduplication - skip ads with same image/video (same creative in multiple ad sets)
  // Also filter out ads without a preview image/video
  const seenVisuals = new Set();
  const topWinners = sortedAds
    .filter(ad => {
      // MUST have a preview (image or video)
      const hasPreview = ad.image_url || ad.video_url || ad.thumbnail_url;
      if (!hasPreview) {
        console.log(`[analyzeWinningAds] Skipping no-preview: ${ad.ad_name}`);
        return false;
      }

      // Visual deduplication - use image/video URL as the unique identifier
      // This ensures same creative in different ad sets only appears once
      const visualKey = ad.video_url || ad.image_url || ad.thumbnail_url;

      if (seenVisuals.has(visualKey)) {
        console.log(`[analyzeWinningAds] Skipping visual duplicate: ${ad.ad_name} ($${ad.spend.toFixed(0)})`);
        return false;
      }
      seenVisuals.add(visualKey);
      return true;
    })
    .slice(0, 20);  // Show up to 20 unique winners

  console.log(`[analyzeWinningAds] Returning ${topWinners.length} unique winners`);

  // Format detection - STATICS FIRST
  const detectFormat = (ad) => {
    const name = (ad.ad_name || '').toUpperCase();
    const visuals = (ad.video_description || '').toLowerCase();

    // STATIC DETECTION FIRST - check if it's a static before anything else
    const isStaticByName = name.includes('STAT') || name.includes('IMG');
    const isStaticByUrl = ad.image_url && !ad.video_url;

    if (isStaticByName || isStaticByUrl) {
      // Get vision AI description if available
      const staticCopyData = getStaticCopy(ad.fb_ad_id);
      const visionDesc = (staticCopyData?.visualDescription || '').toLowerCase();
      const allVisuals = `${visuals} ${visionDesc}`;

      // Check for illustrated/cartoon style (viking, comic, drawn characters)
      if (allVisuals.includes('comic') || allVisuals.includes('illustrated') || allVisuals.includes('cartoon') ||
          allVisuals.includes('drawn') || allVisuals.includes('viking') || allVisuals.includes('character') ||
          allVisuals.includes('muscular figure') || allVisuals.includes('weak') || allVisuals.includes('strong man')) {
        return { key: 'illustrated', label: 'Illustrated Static' };
      }
      // Check for comparison - TRUE comparison (A vs B, before/after transformation)
      // NOT: Same product shown from different angles (front/back view)
      const isActualComparison = (
        (allVisuals.includes('before') && allVisuals.includes('after')) ||  // Before/after transformation
        allVisuals.includes('vs ') || allVisuals.includes(' vs') ||          // Explicit "vs" comparison
        allVisuals.includes('comparison') ||                                  // Explicit comparison
        allVisuals.includes('two different') ||                               // Two different things
        allVisuals.includes('left side') && allVisuals.includes('right side') || // Left vs right split
        name.includes('WAR') || name.includes('VS')                           // Ad name indicates comparison
      );
      // Exclude: Same product from different angles
      const isSameProductAngles = (
        allVisuals.includes('front and back') ||
        allVisuals.includes('two angles') ||
        allVisuals.includes('different angle') ||
        (allVisuals.includes('two') && allVisuals.includes('same shirt'))
      );
      if (isActualComparison && !isSameProductAngles) {
        return { key: 'comparison', label: 'Comparison Static' };
      }
      // Check for UGC style
      if (allVisuals.includes('selfie') || allVisuals.includes('ugc') || allVisuals.includes('iphone') || name.includes('UGC')) {
        return { key: 'ugc', label: 'UGC Static' };
      }
      // Default for statics: Product Hero (most common - product on clean background)
      return { key: 'product_hero', label: 'Product Hero Static' };
    }

    // VIDEO DETECTION
    if (name.includes('UGC')) return { key: 'ugc', label: 'UGC Style' };
    if (name.includes('WAR')) return { key: 'comparison', label: 'Comparison Video' };
    if (name.includes('VID')) {
      if (visuals.includes('founder') || visuals.includes('talking head')) return { key: 'founder', label: 'Founder Video' };
      return { key: 'video', label: 'Video' };
    }

    return { key: 'video', label: 'Video' };
  };

  // Detect angle/message from content
  // IMPORTANT: For founder videos, we want the SPECIFIC angle (fertility, polyester, durability)
  // NOT just "Founder Story" - that's too generic
  const detectAngle = (ad) => {
    const content = `${ad.ad_name || ''} ${ad.headline || ''} ${ad.body || ''} ${ad.video_transcript || ''}`.toLowerCase();

    // Check for SPECIFIC angles FIRST (priority order)
    // These should take precedence over "founder" detection

    // PFA / Fertility / Sperm health (very specific angle)
    if (content.includes('pfa') || content.includes('pfas') || content.includes('fertility') ||
        content.includes('sperm') || content.includes('testosterone') || content.includes('hormone') ||
        content.includes('endocrine') || content.includes('reproductive')) {
      return { key: 'fertility', label: 'Fertility/PFA', desc: 'PFAs, fertility, hormone disruption from synthetics' };
    }

    // Competitor callouts
    if (content.includes('lululemon') || content.includes('nike') || content.includes('carhartt') || content.includes('true classic')) {
      const brand = content.includes('lululemon') ? 'Lululemon' : content.includes('carhartt') ? 'Carhartt' : content.includes('nike') ? 'Nike' : 'competitors';
      return { key: 'competitor', label: `vs ${brand}`, desc: `Calling out ${brand} by name` };
    }

    // Body transformation
    if (content.includes('man boobs') || content.includes('man boob') || content.includes('moob') ||
        content.includes('hide your gut') || content.includes('look instantly jacked') ||
        content.includes('grab your arms') || content.includes('look muscular')) {
      return { key: 'muscle', label: 'Body Transformation', desc: 'Makes you look more fit/jacked' };
    }

    // Health / Anti-polyester / Microplastics
    if (content.includes('polyester') || content.includes('plastic') || content.includes('microplastic') ||
        content.includes('toxic') || content.includes('chemicals') || content.includes('synthetic')) {
      return { key: 'health', label: 'Anti-Polyester/Health', desc: 'Polyester is toxic, natural materials better' };
    }

    // Durability
    if (content.includes('strongest') || content.includes('lifetime') || content.includes('guarantee') ||
        content.includes('never fade') || content.includes('indestructible') || content.includes('outlast')) {
      return { key: 'durability', label: 'Durability', desc: 'Lasts forever, lifetime guarantee' };
    }

    // Hemp / Natural materials (specific)
    if (content.includes('hemp') || content.includes('organic') || content.includes('natural fiber')) {
      return { key: 'hemp', label: 'Hemp/Natural', desc: 'Hemp and natural materials' };
    }

    // Gift angle
    if (content.includes('gift') || content.includes('christmas') || content.includes('birthday') || content.includes("father's day")) {
      return { key: 'gift', label: 'Gift Angle', desc: 'Perfect gift positioning' };
    }

    // ONLY fall back to "Founder Story" if NO specific angle is detected
    // This means the video is about the founder but doesn't have a clear product angle
    if (content.includes('founder') || content.includes('dalton') || content.includes('why i started') ||
        content.includes('my story') || content.includes('i quit') || content.includes('i left my job')) {
      return { key: 'founder_general', label: 'Founder Origin', desc: 'General founder story (consider adding specific angle)' };
    }

    return { key: 'general', label: 'General', desc: 'Brand/product messaging' };
  };

  // Generate replication guidance - PRIORITIZES HEADLINE (the actual message on the ad)
  const generateReplicationGuide = (ad, format, angle, staticCopyData) => {
    const visionHeadline = (staticCopyData?.headline || '').toLowerCase();
    const visionDesc = (staticCopyData?.visualDescription || '').toLowerCase();

    // FIRST: Check the HEADLINE specifically (this is the actual message on the ad)
    // Headline takes priority over visual description

    // DURABILITY / STRONGEST (check early - common winning angle)
    if (visionHeadline.includes('strongest') || visionHeadline.includes('indestructible') ||
        visionHeadline.includes('never fade') || visionHeadline.includes('outlast') ||
        visionHeadline.includes('built to last') || visionHeadline.includes('toughest')) {
      return `Create more durability statics. Test hooks like "The strongest shirt ever made", "Never fades, never shrinks", "Built to outlast you". Same ${format.label} style.`;
    }

    // LIFETIME GUARANTEE
    if (visionHeadline.includes('lifetime') || visionHeadline.includes('guarantee') || visionHeadline.includes('forever')) {
      return `Create more guarantee-focused statics. Test hooks like "Lifetime guarantee", "Buy once, wear forever", "We guarantee it for life". Same ${format.label} style.`;
    }

    // BODY TRANSFORMATION (man boobs, gut, jacked, fit)
    if (visionHeadline.includes('man boob') || visionHeadline.includes('moob') || visionHeadline.includes('chest fat') ||
        visionHeadline.includes('gyno') || visionHeadline.includes('hide your gut') || visionHeadline.includes('flatten') ||
        visionHeadline.includes('hide your') || visionHeadline.includes('destroyer')) {
      return `Create more body transformation statics. Test hooks like "Hide your man boobs", "Flatten your chest", "The moob destroyer". Same ${format.label} style.`;
    }

    // LOOK JACKED / MUSCULAR
    if (visionHeadline.includes('jacked') || visionHeadline.includes('muscular') || visionHeadline.includes('look fit') ||
        visionHeadline.includes('arms look') || visionHeadline.includes('bicep') || visionHeadline.includes('gains')) {
      return `Create more "look jacked" statics. Test hooks like "Look 10lbs more muscular", "Makes your arms pop", "Instant gains". Same ${format.label} style.`;
    }

    // ANTI-POLYESTER / HEALTH (only if headline mentions it)
    if (visionHeadline.includes('polyester') || visionHeadline.includes('microplastic') ||
        visionHeadline.includes('plastic') || visionHeadline.includes('toxic') ||
        visionHeadline.includes('hemp') || visionHeadline.includes('natural')) {
      return `Create more anti-polyester/health statics. Test hooks like "Polyester is poison", "Zero microplastics", "Your shirt is making you sick". Same ${format.label} style.`;
    }

    // IDENTITY / MASCULINITY (weak vs real men)
    if (visionHeadline.includes('real men') || visionHeadline.includes('weak men') ||
        visionHeadline.includes('boys wear') || visionHeadline.includes('men wear')) {
      return `Create more identity/masculinity statics. Test hooks like "Real men wear X", "Boys wear Y, men wear Z", "Built for alphas". Same ${format.label} style.`;
    }

    // COMPETITOR CALLOUT
    if (visionHeadline.includes('lululemon') || visionHeadline.includes('nike') || visionHeadline.includes('true classic') ||
        visionHeadline.includes(' vs ') || visionHeadline.includes('better than')) {
      const competitor = visionHeadline.includes('lululemon') ? 'Lululemon' : visionHeadline.includes('nike') ? 'Nike' : 'competitors';
      return `Create more competitor callout statics against ${competitor}. Test different comparison hooks. Same ${format.label} style.`;
    }

    // SECOND: Check visual description for context + combined angles
    const allContent = `${visionHeadline} ${visionDesc}`;

    // COMBINED: Anti-polyester WITH identity contrast (viking, weak vs strong)
    const hasIdentityContrast = allContent.includes('viking') || allContent.includes('warrior') ||
                                allContent.includes('weak') || allContent.includes('strong man') ||
                                allContent.includes('real men') || allContent.includes('contrast');
    const hasAntiPolyester = allContent.includes('polyester') || allContent.includes('plastic') || allContent.includes('synthetic');

    if (hasAntiPolyester && hasIdentityContrast) {
      return `Create more anti-polyester + identity contrast statics. Test hooks like "Weak men wear polyester, real men wear [brand]", "Boys wear plastic, men wear natural", "Polyester is for followers". KEEP the contrast visual structure. Same ${format.label} style.`;
    }

    if (allContent.includes('man boob') || allContent.includes('moob') || allContent.includes('chest fat')) {
      return `Create more body transformation statics. Test hooks about hiding problem areas. Same ${format.label} style.`;
    }
    if (allContent.includes('strongest') || allContent.includes('durability') || allContent.includes('lifetime')) {
      return `Create more durability statics. Test hooks about strength and longevity. Same ${format.label} style.`;
    }
    if (hasAntiPolyester) {
      return `Create more anti-polyester/health statics. Test hooks about toxic materials. Same ${format.label} style.`;
    }
    if (hasIdentityContrast) {
      return `Create more identity/strength statics. Test hooks with masculine contrast imagery. Same ${format.label} style.`;
    }

    // THIRD: For VIDEOS, use transcript content to be more specific
    const transcript = (ad.video_transcript || '').toLowerCase();
    const videoContent = `${transcript} ${ad.headline || ''} ${ad.body || ''}`.toLowerCase();

    if (angle.key === 'founder' && transcript) {
      // Analyze what the founder video is actually about
      if (videoContent.includes('quit') || videoContent.includes('left my job') || videoContent.includes('started')) {
        return `Create more founder origin story videos. Test different "why I started" angles - quit corporate, saw a problem, personal journey. Same authentic talking-head style.`;
      }
      if (videoContent.includes('quality') || videoContent.includes('fabric') || videoContent.includes('material')) {
        return `Create more founder + quality videos. Test hooks about obsession with quality, why materials matter, behind-the-scenes of product development.`;
      }
      if (videoContent.includes('customer') || videoContent.includes('feedback') || videoContent.includes('review')) {
        return `Create more founder + social proof videos. Test hooks featuring customer stories, reading reviews, responding to feedback.`;
      }
      if (videoContent.includes('mission') || videoContent.includes('believe') || videoContent.includes('why')) {
        return `Create more founder mission videos. Test hooks about brand values, what you stand for, why this matters.`;
      }
    }

    // Fallback based on detected angle
    const guides = {
      competitor: `Create more comparison ads. Use same ${format.label} with different competitor callouts.`,
      muscle: `Create more body transformation content. Test hooks about looking better/fitter.`,
      founder: `Create more founder content. Test different personal stories, behind-the-scenes, or brand mission angles.`,
      durability: `Double down on durability claims. Test "lifetime guarantee" vs "never fades" hooks.`,
      health: `Create more health/materials content. Test polyester vs hemp messaging.`,
      gift: `Create gift-focused ads. Test "perfect gift for him" angles.`,
      general: `Create similar ${format.label} with different hooks. Keep the visual style, test new angles.`,
    };

    return guides[angle.key] || guides.general;
  };

  // Build results
  return topWinners.map(ad => {
    const format = detectFormat(ad);
    const angle = detectAngle(ad);

    // Create a specific, meaningful title for this ad
    // Priority varies by format - statics need different logic than videos
    const isStatic = !ad.video_url || (ad.ad_name || '').toUpperCase().includes('IMG') || (ad.ad_name || '').toUpperCase().includes('STAT');
    let title = `${angle.label} ${format.label}`;  // Default fallback

    // Get static copy data for statics (used for title, replication guide, and return data)
    const staticCopyData = isStatic ? getStaticCopy(ad.fb_ad_id) : null;
    const replicationGuide = generateReplicationGuide(ad, format, angle, staticCopyData);

    if (isStatic) {
      // FOR STATICS: Use format + angle for clear descriptive title
      // e.g., "Product Hero Static — Man Boob Angle"

      // Build title from format + angle
      const formatName = format.label || 'Static Image';
      const angleName = angle.label || 'General';

      // If we have vision-extracted headline, use it to enhance the angle description
      if (staticCopyData?.headline) {
        // Extract key words from headline to make angle more specific
        const headline = staticCopyData.headline.toLowerCase();
        let specificAngle = angleName;

        // Try to extract a more specific angle from the headline
        if (headline.includes('man boob') || headline.includes('manboob') || headline.includes('moobs')) {
          specificAngle = 'Man Boob';
        } else if (headline.includes('strongest')) {
          specificAngle = 'Strongest Shirt';
        } else if (headline.includes('gut') || headline.includes('belly') || headline.includes('hide')) {
          specificAngle = 'Hide Your Gut';
        } else if (headline.includes('last') || headline.includes('lifetime') || headline.includes('guarantee')) {
          specificAngle = 'Lifetime Guarantee';
        } else if (headline.includes('polyester') || headline.includes('plastic')) {
          specificAngle = 'Anti-Polyester';
        } else if (headline.includes('jacked') || headline.includes('muscle') || headline.includes('fit')) {
          specificAngle = 'Look Jacked';
        } else if (headline.includes('lululemon') || headline.includes('nike') || headline.includes('vs')) {
          specificAngle = 'Competitor Callout';
        }

        title = `${formatName} — ${specificAngle}`;
      } else {
        // No vision data - use detected angle
        title = `${formatName} — ${angleName}`;
      }
      // SKIP all fallback logic for statics - title is final
    } else {
      // FOR VIDEOS: Script/message is the creative
      // 1. Try first meaningful sentence from transcript
      if (ad.video_transcript) {
        const sentences = ad.video_transcript.split(/[.!?]/).filter(s => s.trim().length > 10);
        for (const sentence of sentences.slice(0, 2)) {
          const trimmed = sentence.trim();
          const wordCount = trimmed.split(/\s+/).length;
          if (wordCount >= 4 && trimmed.length < 60 && trimmed.length > 15) {
            title = trimmed;
            break;
          }
        }
      }
      // 2. Try headline if descriptive
      if (title === `${angle.label} ${format.label}` && ad.headline &&
          ad.headline.length > 10 && ad.headline.length < 60 &&
          !/^(shop|buy|get|order|click)/i.test(ad.headline)) {
        title = ad.headline;
      }
    }

    // Fallbacks for VIDEOS ONLY (statics already have final title)
    if (!isStatic) {
      // 3. Try body text for a meaningful phrase
      if (title === `${angle.label} ${format.label}` && ad.body) {
        const bodyFirst = ad.body.split(/[.!?\n]/)[0]?.trim();
        if (bodyFirst && bodyFirst.length > 15 && bodyFirst.length < 60) {
          title = bodyFirst;
        }
      }
      // 4. Try video description for context
      if (title === `${angle.label} ${format.label}` && ad.video_description) {
        const descFirst = ad.video_description.split(/[.!?\n]/)[0]?.trim();
        if (descFirst && descFirst.length > 15 && descFirst.length < 50) {
          title = descFirst;
        }
      }
      // 5. Use angle-based descriptive title as final fallback
      if (title === `${angle.label} ${format.label}`) {
        const angleTitles = {
          competitor: `Calling Out ${angle.label.replace('vs ', '')}`,
          muscle: 'Body Transformation Testimonial',
          founder: 'Founder Story Video',
          durability: 'Built To Last Claim',
          health: 'Health & Materials Focus',
          gift: 'Gift Positioning',
          general: `High Performer - ${ad.roas?.toFixed(1)}x ROAS`,
        };
        title = angleTitles[angle.key] || title;
      }
    }

    // Get static copy if available (vision AI extracted text from image)
    const staticCopy = isStatic ? getStaticCopy(ad.fb_ad_id) : null;

    return {
      // Ad identity
      adName: ad.ad_name,
      fbAdId: ad.fb_ad_id,
      title: title,

      // Performance
      spend: Math.round(ad.spend),
      roas: parseFloat(ad.roas?.toFixed(2)) || 0,
      purchases: ad.purchases || 0,

      // Creative details
      format: format,
      angle: angle,
      thumbnail: ad.thumbnail_url || ad.image_url || null,
      imageUrl: ad.image_url || null,
      videoId: ad.video_id || null,  // For video playback
      videoUrl: ad.video_url || null,  // Direct video URL
      isStatic: !ad.video_url || (ad.ad_name || '').toUpperCase().includes('IMG'),

      // Content for context
      headline: ad.headline || null,
      bodySnippet: ad.body?.substring(0, 150) || null,
      transcriptSnippet: ad.video_transcript?.substring(0, 200) || null,
      transcript: ad.video_transcript || null, // Full transcript for founder video analysis

      // Static image copy (from vision AI)
      staticCopy: staticCopy ? {
        headline: staticCopy.headline,
        subheadline: staticCopy.subheadline,
        visualDescription: staticCopy.visualDescription,
      } : null,

      // Replication guidance
      whyItWorks: `${format.label} + ${angle.desc}. Spent $${Math.round(ad.spend).toLocaleString()} at ${ad.roas?.toFixed(2)}x ROAS.`,
      howToReplicate: replicationGuide,
    };
  });
}

/**
 * LEGACY: Analyze winning ads by ANGLE (message/claim) + FORMAT
 * Groups by what's actually working: the angle/message, with format as secondary
 * Returns angle → { angleName, angleDesc, format, count, totalSpend, avgRoas, topAds, whyWinning }
 */
function analyzeWinningAngles(ads) {
  // Angle patterns - what the ad is SAYING/CLAIMING
  // Priority order matters - more specific angles checked first
  // Each angle has: keywords (for matching), strongIndicators (high-weight unique phrases), priority (higher = checked first)
  const anglePatterns = {
    muscle_fit: {
      keywords: ['man boobs', 'gut', 'belly', 'jacked', 'muscle', 'slim', 'hide', 'transform', 'look good', 'average joe', 'dad bod', 'arms', 'bicep', 'grab your arms', 'hide your gut', 'look instantly', 'flattering', 'silhouette', 'confident', 'ripped', 'shredded', 'mup', 'destroyer', 'killer', 'hercules'],
      strongIndicators: ['man boobs', 'hide your gut', 'look instantly jacked', 'grab your arms', 'dad bod', 'hercules'],
      priority: 10,
      name: 'Muscle-Up / Fit',
      desc: 'Makes you look better/fitter',
    },
    competitor_callout: {
      keywords: ['lululemon', 'nike', 'true classic', 'amazon', 'carhartt', 'compared', 'unlike', 'other brands', 'most shirts', 'cheap shirts', 'h&m', 'zara', 'fast fashion', 'better than', 'twice the money', 'out of ten', 'rating', 'eighty dollars'],
      strongIndicators: ['lululemon', 'nike', 'true classic', 'carhartt', 'twice the money'],
      priority: 9,
      name: 'Competitor Callout',
      desc: 'Calling out other brands',
    },
    founder_story: {
      keywords: ['founder', 'started', 'built', 'my company', 'dalton', 'story', 'why i', 'created', 'mission', 'journey', 'our story', 'behind the brand'],
      strongIndicators: ['founder', 'dalton', 'why i started', 'my company'],
      priority: 8,
      name: 'Founder Story',
      desc: 'Brand story from the founder',
    },
    strength_durability: {
      keywords: ['strongest', 'durable', 'last', 'lifetime', 'forever', 'years', 'never fade', 'never shrink', 'built to last', 'indestructible', 'tough', 'heavy duty', 'worn out', 'holds up', 'bifl', 'buy once', 'guarantee', 'warranty'],
      strongIndicators: ['strongest', 'lifetime guarantee', 'built to last', 'never fade', 'never shrink'],
      priority: 7,
      name: 'Strength & Durability',
      desc: 'Claims about how long it lasts',
    },
    blue_collar: {
      keywords: ['blue collar', 'bluecollar', 'working man', 'working men', 'job site', 'construction', 'trade', 'labor', 'real work', 'hard work', 'manual', 'real working'],
      strongIndicators: ['blue collar', 'working man', 'real working', 'job site'],
      priority: 6,
      name: 'Blue Collar',
      desc: 'For working men',
    },
    gift_occasion: {
      keywords: ['gift', 'christmas', 'birthday', 'valentine', 'father', 'present', 'perfect for', 'holiday', 'nye', 'anniversary', 'for him', 'for her', 'husband', 'boyfriend', 'wife bought'],
      strongIndicators: ['perfect gift', 'gift for', 'christmas', 'birthday', 'valentine'],
      priority: 5,
      name: 'Gift Angle',
      desc: 'Positioned as a gift',
    },
    social_proof: {
      keywords: ['review', 'testimonial', 'customer', '5 star', 'rated', 'sold out', 'thousands', 'favorite', 'love it', 'best purchase', 'recommend', 'changed my life', 'game changer'],
      strongIndicators: ['5 star', 'sold out', 'customer review', 'testimonial'],
      priority: 4,
      name: 'Social Proof',
      desc: 'Reviews and testimonials',
    },
    value_price: {
      keywords: ['worth', 'price', 'cost', 'expensive', 'cheap', 'value', 'money', 'per wear', 'investment', 'afford', 'save', 'budget', 'premium'],
      strongIndicators: ['cost per wear', 'worth the money', 'investment piece'],
      priority: 3,
      name: 'Value & Price',
      desc: 'Cost-per-wear or premium value',
    },
    health_materials: {
      keywords: ['polyester', 'chemical', 'skin', 'toxic', 'natural', 'hemp', 'bamboo', 'healthy', 'pfas', 'microplastic', 'burning', 'doctor', 'health', 'bacteria', 'organic', 'synthetic', 'breathable', 'airflow'],
      strongIndicators: ['polyester', 'microplastic', 'toxic', 'pfas', 'hemp', 'bamboo'],
      priority: 2,  // Lower priority so more specific angles win
      name: 'Health & Materials',
      desc: 'Natural materials vs synthetic',
    },
  };

  /**
   * Generate a specific headline from the top ad's content
   * Instead of generic "Health & Materials", create something like "Polyester Burns on Your Skin"
   */
  function generateSpecificTitle(ads, angleKey, pattern) {
    const topAd = ads[0];
    if (!topAd) return pattern.name;

    // Build content to search through
    const headline = topAd.headline || '';
    const body = topAd.body || '';
    const transcript = topAd.transcript || topAd.video_transcript || '';
    const adName = topAd.name || topAd.ad_name || '';

    // Try to extract a compelling phrase from the content
    const allContent = `${headline} ${body} ${transcript}`.toLowerCase();

    // Look for strong phrases that could be titles
    const strongPhrases = [
      // Strength/durability
      { pattern: /strongest\s+\w+/i, found: null },
      { pattern: /never\s+(fade|shrink|wear out)/i, found: null },
      { pattern: /lasts?\s+\w+\s+years?/i, found: null },
      { pattern: /built\s+to\s+last/i, found: null },
      // Muscle/fit
      { pattern: /man\s*boobs?\s*destroyer/i, found: null },
      { pattern: /(hide|destroy|eliminate)\s+(your\s+)?(gut|belly|man boobs)/i, found: null },
      { pattern: /look\s+(like\s+you\s+)?(jacked|ripped|fit|muscular)/i, found: null },
      { pattern: /dad\s+bod/i, found: null },
      // Health/materials
      { pattern: /polyester\s+(is\s+)?(plastic|toxic|burning)/i, found: null },
      { pattern: /(plastic|synthetic)\s+(on|against)\s+your\s+skin/i, found: null },
      { pattern: /natural\s+(cotton|hemp|bamboo)/i, found: null },
      // Competitor
      { pattern: /vs\.?\s+(lululemon|nike|amazon)/i, found: null },
      { pattern: /better\s+than\s+\w+/i, found: null },
      // Founder
      { pattern: /why\s+i\s+(started|built|created)/i, found: null },
      { pattern: /founder('s)?\s+story/i, found: null },
    ];

    // Try to find a phrase
    for (const phrase of strongPhrases) {
      const match = allContent.match(phrase.pattern);
      if (match) {
        // Capitalize first letter of each word
        let found = match[0];
        found = found.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        return found;
      }
    }

    // Fall back to ad name if it's descriptive enough
    if (adName && adName.length < 60) {
      // Extract meaningful part from ad name (often formatted as "DATE | TYPE | ANGLE")
      const parts = adName.split('|').map(p => p.trim());
      // Look for the most descriptive part (usually the last one)
      for (let i = parts.length - 1; i >= 0; i--) {
        const part = parts[i];
        if (part.length > 10 && !/^\d/.test(part) && !/^(IMG|VID|WAR|STAT|UGC)$/i.test(part)) {
          return part.substring(0, 40);
        }
      }
    }

    // If headline exists and is short, use it
    if (headline && headline.length > 10 && headline.length < 50) {
      return headline;
    }

    // Ultimate fallback - use pattern name but try to make it more specific
    const specificFallbacks = {
      strength_durability: topAd.spend > 10000 ? 'Shirts That Last Years' : pattern.name,
      muscle_fit: 'Shirts That Make You Look Jacked',
      health_materials: 'Polyester Is Plastic on Your Skin',
      competitor_callout: 'Better Than Cheap Alternatives',
      founder_story: 'Why I Started This Brand',
      social_proof: 'What Customers Are Saying',
      gift_occasion: 'The Perfect Gift for Him',
      value_price: 'Cost Per Wear Math',
      blue_collar: 'Built for Real Work',
    };
    return specificFallbacks[angleKey] || pattern.name;
  }

  /**
   * Generate a description for the top ad showing WHAT it is
   */
  function generateDescription(ads, angleKey) {
    const topAd = ads[0];
    if (!topAd) return '';

    const format = topAd.formatLabel || topAd.format || '';
    const transcript = (topAd.transcript || topAd.video_transcript || '').substring(0, 100);
    const body = (topAd.body || '').substring(0, 100);

    // Show format + brief content hint
    if (transcript) {
      return `${format} — "${transcript.split('.')[0]}..."`;
    }
    if (body) {
      return `${format} — "${body.split('.')[0]}..."`;
    }
    return format;
  }

  // Format detection
  const detectFormat = (ad) => {
    const name = (ad.ad_name || '').toUpperCase();
    const visuals = (ad.video_description || '').toLowerCase();

    // Check ad name patterns first
    if (name.includes('STAT') || name.includes('IMG')) return 'product_hero';
    if (name.includes('UGC')) return 'ugc_style';
    if (name.includes('WAR')) return 'comparison';
    if (name.includes('VID')) {
      if (visuals.includes('founder') || visuals.includes('talking head')) return 'talking_head';
      return 'lifestyle';
    }

    // Check visual content
    if (visuals.includes('product shot') || visuals.includes('product display') || visuals.includes('centered product')) return 'product_hero';
    if (visuals.includes('side by side') || visuals.includes('comparison')) return 'comparison';
    if (visuals.includes('selfie') || visuals.includes('phone') || visuals.includes('ugc')) return 'ugc_style';
    if (visuals.includes('lifestyle') || visuals.includes('outdoor') || visuals.includes('wearing')) return 'lifestyle';

    return ad.image_url && !ad.video_url ? 'static' : 'video';
  };

  const formatLabels = {
    product_hero: 'Product Hero Static',
    comparison: 'Comparison',
    ugc_style: 'UGC Style',
    lifestyle: 'Lifestyle Video',
    talking_head: 'Talking Head',
    static: 'Static',
    video: 'Video',
  };

  // Group ads by angle
  const angleGroups = {};

  for (const ad of ads) {
    const content = `${ad.ad_name || ''} ${ad.headline || ''} ${ad.body || ''} ${ad.video_transcript || ''} ${ad.video_description || ''}`.toLowerCase();

    // Find best angle match using weighted scoring:
    // - Strong indicators: 5 points each (unique phrases that definitively indicate the angle)
    // - Regular keywords: 1 point each
    // - Priority: Used as tiebreaker (higher priority wins when scores are equal)
    let bestAngle = null;
    let bestScore = 0;
    let bestPriority = 0;

    for (const [angleKey, pattern] of Object.entries(anglePatterns)) {
      // Count strong indicator matches (worth 5 points each)
      const strongMatches = (pattern.strongIndicators || []).filter(kw => content.includes(kw));
      const strongScore = strongMatches.length * 5;

      // Count regular keyword matches (worth 1 point each)
      const regularMatches = pattern.keywords.filter(kw => content.includes(kw));
      const regularScore = regularMatches.length;

      const totalScore = strongScore + regularScore;
      const priority = pattern.priority || 0;

      // Win if: higher score, OR equal score with higher priority
      if (totalScore > bestScore || (totalScore === bestScore && priority > bestPriority)) {
        bestScore = totalScore;
        bestPriority = priority;
        bestAngle = angleKey;
      }
    }

    // Require at least 1 match to categorize
    if (bestAngle && bestScore >= 1) {
      if (!angleGroups[bestAngle]) {
        angleGroups[bestAngle] = {
          ...anglePatterns[bestAngle],
          ads: [],
        };
      }

      const format = detectFormat(ad);
      angleGroups[bestAngle].ads.push({
        name: ad.ad_name,
        fbAdId: ad.fb_ad_id || null,
        spend: ad.spend || 0,
        roas: ad.roas || 0,
        format: format,
        formatLabel: formatLabels[format] || format,
        thumbnail: ad.thumbnail_url || ad.image_url || null,
        imageUrl: ad.image_url || null,
        headline: ad.headline || null,
        body: ad.body?.substring(0, 200) || null,
        transcript: ad.video_transcript?.substring(0, 300) || null,
        isStatic: !ad.video_url || (ad.ad_name || '').toUpperCase().includes('IMG') || (ad.ad_name || '').toUpperCase().includes('STAT'),
      });
    }
  }

  // Calculate stats and sort by spend
  const result = [];
  for (const [angleKey, data] of Object.entries(angleGroups)) {
    if (data.ads.length > 0) {
      const totalSpend = data.ads.reduce((sum, a) => sum + a.spend, 0);
      const avgRoas = data.ads.reduce((sum, a) => sum + a.roas, 0) / data.ads.length;

      // Sort ads by spend, prioritize those with thumbnails
      const sortedAds = data.ads.sort((a, b) => {
        if ((a.thumbnail || a.imageUrl) && !(b.thumbnail || b.imageUrl)) return -1;
        if (!(a.thumbnail || a.imageUrl) && (b.thumbnail || b.imageUrl)) return 1;
        return b.spend - a.spend;
      });

      // Get dominant format
      const formatCounts = {};
      data.ads.forEach(a => formatCounts[a.format] = (formatCounts[a.format] || 0) + 1);
      const dominantFormat = Object.entries(formatCounts).sort((a,b) => b[1] - a[1])[0]?.[0];

      // Generate specific title from actual ad content (not generic category names)
      const specificTitle = generateSpecificTitle(sortedAds, angleKey, anglePatterns[angleKey]);
      const specificDesc = generateDescription(sortedAds, angleKey);

      // Generate "why winning" explanation
      const topAd = sortedAds[0];
      const whyWinning = `${data.ads.length} ads tested with $${Math.round(totalSpend).toLocaleString()} total spend. Top performer: ${topAd?.name?.substring(0, 30) || 'N/A'} at ${topAd?.roas?.toFixed(2) || 0}x ROAS. This angle consistently converts.`;

      result.push({
        angleKey,
        angleName: specificTitle,  // Use specific title from content, not generic category
        angleDesc: specificDesc,   // Use description from content
        categoryName: data.name,   // Keep original category for reference
        format: dominantFormat,
        formatLabel: formatLabels[dominantFormat] || dominantFormat,
        count: data.ads.length,
        totalSpend: Math.round(totalSpend),
        avgRoas: avgRoas.toFixed(2),
        topAds: sortedAds.slice(0, 3),
        whyWinning,  // New explanation field
      });
    }
  }

  // Sort by total spend (highest first)
  return result.sort((a, b) => b.totalSpend - a.totalSpend);
}

/**
 * Analyze visual formats of winning ads
 * Detects which creative formats are performing best (illustrated, UGC, comparison, etc.)
 * Each ad is assigned to only ONE format (best match) to avoid duplicates
 * Returns format → { count, totalSpend, avgRoas, topAds }
 */
function analyzeWinningVisualFormats(ads) {
  const formatPatterns = {
    illustrated: {
      keywords: ['cartoon', 'illustrated', 'animation', 'animated', 'drawn', 'comic', 'hand-drawn', 'sketch', 'artistic', 'stylized', 'graphic novel', 'vector', 'flat design'],
      ads: [],
    },
    comparison: {
      keywords: ['side by side', 'comparison', 'vs', 'versus', 'split', 'before and after', 'left and right', 'two panels', 'contrasting'],
      ads: [],
    },
    ugc_style: {
      keywords: ['selfie', 'iphone', 'casual', 'home setting', 'real person', 'authentic', 'unpolished', 'natural lighting', 'bedroom', 'bathroom mirror', 'car'],
      ads: [],
    },
    editorial: {
      keywords: ['newspaper', 'magazine', 'editorial', 'article', 'headline', 'vintage', 'retro', 'old paper', 'sepia', '1930s', '1920s', 'journalism'],
      ads: [],
    },
    product_hero: {
      keywords: ['product shot', 'product photography', 'clean background', 'studio', 'floating', 'packshot', 'hero shot', 'product display'],
      ads: [],
    },
    lifestyle: {
      keywords: ['lifestyle', 'outdoor', 'nature', 'action shot', 'in use', 'wearing', 'candid', 'documentary', 'real environment', 'professional setting'],
      ads: [],
    },
    meme: {
      keywords: ['meme', 'chad', 'nordic', 'wojak', 'funny', 'humor', 'internet culture'],
      ads: [],
    },
    stat_overlay: {
      keywords: ['statistics', 'numbers', 'badges', 'callouts', 'text overlay', 'data', 'proof points', 'infographic'],
      ads: [],
    },
  };

  // Track which ads have been assigned to prevent duplicates
  const assignedAdIds = new Set();

  // Helper to check if ad is a static image (not video)
  const isStaticAd = (ad) => {
    const name = (ad.ad_name || '').toUpperCase();
    return name.includes('IMG') || name.includes('STAT') ||
           (ad.image_url && !ad.video_url) ||
           (!ad.video_description || ad.video_description.length < 50);
  };

  // Sort ads to prioritize statics first (for static generation company)
  const sortedAds = [...ads].sort((a, b) => {
    const aIsStatic = isStaticAd(a);
    const bIsStatic = isStaticAd(b);
    if (aIsStatic && !bIsStatic) return -1;
    if (!aIsStatic && bIsStatic) return 1;
    return (b.spend || 0) - (a.spend || 0); // Then by spend
  });

  // First pass: Find BEST format match for each ad (most keyword matches)
  // Prioritizes static ads over videos for inspiration
  for (const ad of sortedAds) {
    const visuals = (ad.video_description || '').toLowerCase();
    const adName = (ad.ad_name || '').toLowerCase();
    const headline = (ad.headline || '').toLowerCase();
    const body = (ad.body || '').toLowerCase();
    const searchText = `${visuals} ${adName} ${headline} ${body}`;

    if (searchText.length < 20) continue; // Skip if no real content

    // Find the format with the most keyword matches for this ad
    let bestFormat = null;
    let bestMatchCount = 0;
    let bestMatches = [];

    for (const [format, data] of Object.entries(formatPatterns)) {
      const matches = data.keywords.filter(kw => searchText.includes(kw));
      if (matches.length > bestMatchCount) {
        bestMatchCount = matches.length;
        bestFormat = format;
        bestMatches = matches;
      }
    }

    // Only assign if we found a match and this ad hasn't been assigned
    const adKey = ad.fb_ad_id || ad.ad_name;
    if (bestFormat && bestMatchCount >= 1 && !assignedAdIds.has(adKey)) {
      assignedAdIds.add(adKey);
      console.log(`[WinningFormats] Adding to ${bestFormat}: ${ad.ad_name?.substring(0,30)} | fb_ad_id=${ad.fb_ad_id}`);
      formatPatterns[bestFormat].ads.push({
        name: ad.ad_name,
        fbAdId: ad.fb_ad_id || null,
        spend: ad.spend || 0,
        roas: ad.roas || 0,
        purchases: ad.purchases || 0,
        matchedKeywords: bestMatches,
        visualSnippet: visuals.substring(0, 200),
        // Include full transcript and description for understanding the creative
        transcript: ad.video_transcript || null,
        description: ad.video_description || null,
        thumbnail: ad.thumbnail_url || ad.image_url || null,
        imageUrl: ad.image_url || null,
        isStatic: isStaticAd(ad),
      });
    }
  }

  // Calculate format performance stats
  const result = {};
  for (const [format, data] of Object.entries(formatPatterns)) {
    if (data.ads.length > 0) {
      const totalSpend = data.ads.reduce((sum, a) => sum + a.spend, 0);
      const avgRoas = data.ads.reduce((sum, a) => sum + a.roas, 0) / data.ads.length;
      console.log(`[WinningFormats] ${format} has ${data.ads.length} ads, first ad fbAdId=${data.ads[0]?.fbAdId}`);
      // Sort: static ads with thumbnails first, then by spend
      const topAds = data.ads.sort((a, b) => {
        // Prioritize ads with thumbnails (visible inspiration)
        const aHasThumb = a.thumbnail || a.imageUrl;
        const bHasThumb = b.thumbnail || b.imageUrl;
        if (aHasThumb && !bHasThumb) return -1;
        if (!aHasThumb && bHasThumb) return 1;
        // Then prioritize static ads
        if (a.isStatic && !b.isStatic) return -1;
        if (!a.isStatic && b.isStatic) return 1;
        // Then by spend
        return b.spend - a.spend;
      }).slice(0, 3);

      result[format] = {
        count: data.ads.length,
        totalSpend: Math.round(totalSpend),
        avgRoas: avgRoas.toFixed(2),
        topAds: topAds.map(a => ({
          name: a.name?.substring(0, 50),
          fbAdId: a.fbAdId || null,
          spend: a.spend,
          roas: a.roas?.toFixed(2),
          keywords: a.matchedKeywords.slice(0, 3),
          thumbnail: a.thumbnail || null,
          imageUrl: a.imageUrl || null,
          visualSnippet: a.visualSnippet || null,
          // Full content for understanding the creative
          transcript: a.transcript?.substring(0, 500) || null,
          description: a.description?.substring(0, 500) || null,
          isStatic: a.isStatic || false,
        })),
        // Performance verdict
        verdict: totalSpend > 5000 && avgRoas >= 1.5 ? 'top_performer' :
                 totalSpend > 2000 && avgRoas >= 1.0 ? 'showing_promise' :
                 totalSpend > 500 ? 'tested' : 'undertested',
      };
    }
  }

  return result;
}

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

  // Fetch Reddit research if not already provided
  let redditSignals = externalSignals.reddit || [];
  if (redditSignals.length === 0) {
    try {
      console.log(`[Test Suggestions] Fetching Reddit research for ${brand.name}...`);
      const redditResearch = await researchReddit(brand, {
        maxThreads: 15,
        maxCommentsPerThread: 8,
        searchQueries: [
          // Add brand-specific queries based on category
          brand.category === 'apparel' ? 'quality clothing lasts' : null,
          brand.category === 'apparel' ? 'best t-shirt brand' : null,
          brand.category === 'apparel' ? 'organic cotton polyester' : null,
          brand.category === 'supplement' ? 'supplement recommendations' : null,
          brand.category === 'skincare' ? 'skincare routine help' : null
        ].filter(Boolean)
      });
      redditSignals = formatForPrompt(redditResearch);
      console.log(`[Test Suggestions] Reddit research: ${redditSignals.length} threads, ${redditResearch.painPoints?.length || 0} pain points`);

      // Add pain points and desires to externalSignals for the prompt
      externalSignals.reddit = redditSignals;
      externalSignals.redditPainPoints = redditResearch.painPoints || [];
      externalSignals.redditDesires = redditResearch.desires || [];
    } catch (err) {
      console.error(`[Test Suggestions] Reddit research failed:`, err.message);
      // Continue without Reddit data
    }
  }

  // Analyze static ad copy using vision AI (for Double Down titles)
  // This extracts the actual headline text FROM the images
  try {
    console.log(`[Test Suggestions] Analyzing static ad copy with vision AI...`);
    const staticResult = await analyzeStaticCopyForBrand(brandId, { limit: 15, force: false });
    if (staticResult.analyzed > 0) {
      console.log(`[Test Suggestions] Extracted copy from ${staticResult.analyzed} statics`);
    }
  } catch (err) {
    console.error(`[Test Suggestions] Static copy analysis failed:`, err.message);
    // Continue anyway - we'll fall back to ad names
  }

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

  // Analyze winning visual formats from top performers
  const winningFormats = analyzeWinningVisualFormats(topAds.slice(0, 20));
  const topFormats = Object.entries(winningFormats)
    .filter(([_, data]) => data.verdict === 'top_performer' || data.verdict === 'showing_promise')
    .sort((a, b) => b[1].totalSpend - a[1].totalSpend);
  console.log(`[Test Suggestions] Top performing visual formats:`, topFormats.map(([f]) => f).join(', ') || 'none detected');

  // Analyze winning ANGLES (message/claim) - this is what we double down on
  const winningAngles = analyzeWinningAngles(topAds.slice(0, 30));
  console.log(`[Test Suggestions] Top performing angles:`, winningAngles.map(a => a.angleName).join(', ') || 'none detected');

  // NEW: Analyze specific winning ads with replication guidance
  const doubleDowns = analyzeWinningAds(topAds);
  console.log(`[Test Suggestions] Found ${doubleDowns.length} unique winners for double-downs`);
  console.log(`[Test Suggestions] Double Down winners:`, doubleDowns.map(d => `${d.title} ($${d.spend?.toLocaleString()})`).slice(0, 10).join(', ') || 'none');

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

  const prompt = buildTestSuggestionsPrompt(brand, { topAds, strategicInsights, historicalTerritories, existingCampaigns, externalSignals, winningFormats });

  console.log(`[Test Suggestions] Calling Claude for brand ${brandId}, prompt length: ${prompt.length} chars`);
  const client = new Anthropic();
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });
  console.log(`[Test Suggestions] Claude response received, ${response.content[0].text.length} chars`);

  const rawText = response.content[0].text;
  const suggestions = parseTestSuggestions(rawText);

  // Add winning formats to suggestions for UI display
  // topAds already have thumbnail data from analyzeWinningVisualFormats
  suggestions.winningFormats = Object.entries(winningFormats)
    .filter(([_, data]) => data.verdict === 'top_performer' || data.verdict === 'showing_promise')
    .sort((a, b) => b[1].totalSpend - a[1].totalSpend)
    .slice(0, 5)
    .map(([format, data]) => ({
      format,
      spend: data.totalSpend,
      roas: data.avgRoas,
      count: data.count,
      verdict: data.verdict,
      topAds: data.topAds.map(a => ({
        name: a.name,
        fbAdId: a.fbAdId || null,
        spend: a.spend,
        roas: a.roas,
        thumbnail: a.thumbnail || a.imageUrl || null,
        imageUrl: a.imageUrl || null,
        isStatic: a.isStatic || false,
        keywords: a.keywords || a.matchedKeywords?.slice(0, 3) || [],
        // Full size image for preview
        previewUrl: a.imageUrl || a.thumbnail || null,
      })),
    }));

  // NEW: Generate double-down variations for ALL winners automatically
  console.log(`[Test Suggestions] Generating double-down variations for ${doubleDowns.length} winners...`);
  // Generate variations for all displayed winners (up to 20)
  const ddVariations = await generateAllDoubleDownVariations(brand, doubleDowns.slice(0, 20));

  // Show all winners (up to 20), attach variations where available
  suggestions.doubleDowns = doubleDowns.slice(0, 20).map(winner => {
    const found = ddVariations.find(v => v.winner.title === winner.title);
    return {
      ...winner,
      variations: found?.variations || [],
    };
  });

  // Store all suggestions in database for tracking
  // 1. Store new angle tests
  const newAngleTests = suggestions.tests || [];
  const storedNewAngles = storeSuggestions(brandId, newAngleTests, 'new_angle');
  console.log(`[Test Suggestions] Stored ${storedNewAngles} new angle suggestions`);

  // 2. Store double-down variations
  let storedDoubleDowns = 0;
  for (const dd of suggestions.doubleDowns) {
    if (dd.variations && dd.variations.length > 0) {
      const stored = storeSuggestions(
        brandId,
        dd.variations,
        'double_down',
        dd.fbAdId || null,
        dd.adName || dd.title
      );
      storedDoubleDowns += stored;
    }
  }
  console.log(`[Test Suggestions] Stored ${storedDoubleDowns} double-down suggestions`);

  // Add stats to response
  suggestions.stats = getSuggestionStats(brandId);

  // LEGACY: Add winning ANGLES for backwards compatibility
  suggestions.winningAngles = winningAngles.slice(0, 5).map(angle => ({
    angleKey: angle.angleKey,
    angleName: angle.angleName,
    angleDesc: angle.angleDesc,
    categoryName: angle.categoryName,
    whyWinning: angle.whyWinning,
    format: angle.format,
    formatLabel: angle.formatLabel,
    spend: angle.totalSpend,
    roas: angle.avgRoas,
    count: angle.count,
    topAds: angle.topAds.map(a => ({
      name: a.name,
      fbAdId: a.fbAdId || null,
      spend: a.spend,
      roas: a.roas,
      format: a.format,
      formatLabel: a.formatLabel,
      thumbnail: a.thumbnail || a.imageUrl || null,
      imageUrl: a.imageUrl || null,
      isStatic: a.isStatic || false,
      headline: a.headline || null,
      body: a.body || null,
      transcript: a.transcript || null,
    })),
  }));

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
🔴 REDDIT RESEARCH — CUSTOMER VOICE & PAIN POINTS
═══════════════════════════════════════════════════════════════

${signals.reddit.slice(0, 10).map((thread, i) => `
[Reddit ${i + 1}] r/${thread.subreddit || 'unknown'}
Title: "${thread.title}"
Snippet: ${thread.snippet || 'N/A'}
Engagement: ${thread.engagement?.score || 0} upvotes, ${thread.engagement?.comments || 0} comments
${thread.top_comments?.length > 0 ? `Top comments:\n${thread.top_comments.slice(0, 3).map(c => `  • "${c.substring(0, 150)}..."`).join('\n')}` : ''}`).join('\n')}
`);

    // Add pain points if available
    if (signals.redditPainPoints && signals.redditPainPoints.length > 0) {
      sections.push(`
💢 CUSTOMER PAIN POINTS (extracted from Reddit):
${signals.redditPainPoints.slice(0, 10).map((p, i) => `${i + 1}. "${p}"`).join('\n')}

Use these EXACT pain points in ad hooks. Customers said these words themselves.`);
    }

    // Add desires if available
    if (signals.redditDesires && signals.redditDesires.length > 0) {
      sections.push(`
✨ CUSTOMER DESIRES (what they're looking for):
${signals.redditDesires.slice(0, 10).map((d, i) => `${i + 1}. "${d}"`).join('\n')}

Position your product as the solution to these desires.`);
    }
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
  const { topAds, strategicInsights, historicalTerritories, existingCampaigns = [], externalSignals = {}, winningFormats = {} } = data;

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

═══════════════════════════════════════════════════════════════
🎯 TOP PERFORMING VISUAL FORMATS — DOUBLE DOWN ON THESE
═══════════════════════════════════════════════════════════════

${Object.entries(winningFormats).length > 0 ? Object.entries(winningFormats)
  .sort((a, b) => b[1].totalSpend - a[1].totalSpend)
  .slice(0, 5)
  .map(([format, data]) => {
    const verdictEmoji = data.verdict === 'top_performer' ? '🏆' : data.verdict === 'showing_promise' ? '📈' : '📊';
    return `${verdictEmoji} ${format.toUpperCase()}: $${data.totalSpend} spend | ${data.avgRoas}x ROAS | ${data.count} ads
   Top performers: ${data.topAds.map(a => `"${a.name}" (${a.roas}x)`).join(', ')}
   Visual cues: ${data.topAds.flatMap(a => a.keywords).slice(0, 5).join(', ')}`;
  }).join('\n\n') : 'No visual format data available — analyze video descriptions to detect patterns'}

ℹ️ NOTE: "Double Down" tests for winning formats are generated separately via the Double Down feature.
Focus here on NEW angles and fresh directions to test.

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
YOUR TASK: Generate 8 TRUE TESTS
═══════════════════════════════════════════════════════════════

Each test MUST follow the HYPOTHESIS FORMAT:

**LEARNING**: What do we discover if this wins? What if it loses?
**VEHICLE**: What static format serves this test? (see FORMAT GUIDE below)
**ANGLE**: The specific claim or positioning

═══════════════════════════════════════════════════════════════
FORMAT GUIDE — MATCH FORMAT TO PERSONA & ANGLE
═══════════════════════════════════════════════════════════════

AVAILABLE FORMATS:
- comparison: Side-by-side vs competitor/generic. Best for: skeptics, durability claims, price/value angles
- testimonial: Personal story + customer photo. Best for: social proof, gift buyers, authenticity angles
- news_editorial: 1930s newspaper clipping. Best for: founder stories, authority angles, values messaging
- stat_stack_hero: Proof story with stat badges + real person. Best for: durability, professional use, credibility
- before_after: Transformation visual. Best for: fit/appearance, lifestyle change, problem-solution
- product_hero: Clean product display. Best for: launches, new territory tests, direct product claims
- meme: Internet meme format. Best for: younger audiences, viral potential, humor angles
- ugc_style: Authentic customer content. Best for: TOF awareness, authenticity, relatable stories
- aesthetic: Premium lifestyle shot. Best for: premium positioning, drops, limited editions
- illustrated: Hand-drawn style. Best for: educational angles, shareable content, explaining benefits

PERSONA → FORMAT MAPPING (use this):
- health_switcher → news_editorial, stat_stack_hero, illustrated (needs proof + authority)
- fit_seeker → before_after, stat_stack_hero, aesthetic (transformation + proof)
- durability_buyer → stat_stack_hero, news_editorial, comparison (proof of longevity)
- eco_conscious → news_editorial, illustrated, aesthetic (values messaging)
- skeptic → stat_stack_hero, comparison, news_editorial (hard evidence)
- gift_buyer → aesthetic, illustrated, product_hero (gift-worthy presentation)

⚠️ FORMAT DIVERSITY RULE (CRITICAL):
Across all 8 tests, you MUST use at least 6 DIFFERENT primary formats (vehicles).
- DO NOT use testimonial or ugc_style more than twice
- DO NOT use comparison more than twice
- MUST include at least one: stat_stack_hero, news_editorial, before_after, illustrated
- Each test's recommended_formats MUST include 3 formats, and the first must match the vehicle

CRITICAL RULES:
1. At least 4 tests must be NEW TERRITORY (untested angles, fresh directions)
2. Maximum 2 tests can be ITERATIONS (same angle, different execution)
3. DO NOT generate "double_down" tests here — those are handled separately via the "Double Down" feature
4. Each test must target a DIFFERENT persona OR test a different angle
5. If you can't articulate what you LEARN from a win vs loss, it's not a real test
6. EVERY test must have a clear SOURCE with specific evidence
7. **REDDIT RULE**: If Reddit research is provided, AT LEAST 2 tests MUST source from Reddit pain points or discussions. Use the EXACT customer language from Reddit threads. Set source.type to "reddit" for these.

TEST TYPES (only use these two):
- new_territory: Untested angle or fresh direction
- iteration: Same ANGLE that's working, but different format or execution

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
      "type": "iteration | new_territory | double_down",
      "iteration_detail": "(REQUIRED if type=iteration) What are we doubling down on? What's the ONE thing we're changing?",
      "double_down_detail": "(REQUIRED if type=double_down) Which winning FORMAT are we using? What NEW angle are we testing with it?",
      "hypothesis": {
        "learning": "If this wins, we learn X. If it loses, we learn Y.",
        "vehicle": "comparison | testimonial | news_editorial | stat_stack_hero | before_after | product_hero | meme | ugc_style | aesthetic | illustrated",
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
      "recommended_formats": ["REQUIRED: 2-3 formats from FORMAT GUIDE above. First format should match vehicle. Second/third based on persona mapping."]
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

EXAMPLE OF A GOOD DOUBLE DOWN TEST:
{
  "title": "Illustrated Comparison: Durability Focus",
  "type": "double_down",
  "double_down_detail": "Using ILLUSTRATED COMPARISON format (top performer with $12k spend, 2.1x ROAS). Testing NEW angle: durability/longevity instead of health/materials.",
  "hypothesis": {
    "learning": "If this wins: the FORMAT is the key driver, not the health angle. If it loses: the polyester/health message is what makes illustrated comparison work.",
    "vehicle": "illustrated",
    "angle": "Same visual style (cartoon Viking vs weak man), but comparing shirt longevity instead of materials"
  },
  "persona": {
    "id": "durability_buyer",
    "description": "Guy tired of replacing cheap shirts that fall apart"
  },
  "hook": "Weak shirts last 6 months. Real shirts last 6 years.",
  "source": {
    "type": "facebook_data",
    "evidence": "Illustrated comparison format is #1 visual format ($12,340 spend, 2.14x ROAS). Testing if format works with different angle."
  },
  "recommended_formats": ["illustrated", "comparison", "meme"]
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

  // Strip markdown code block if present (more robust handling)
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```\s*$/, '');
  }

  // First try: parse the whole thing
  try {
    const parsed = JSON.parse(jsonStr);

    // Handle new format with batch_analysis + tests
    if (parsed.tests && Array.isArray(parsed.tests)) {
      return {
        tests: ensureThreeFormats(parsed.tests),
        batch_analysis: parsed.batch_analysis || null,
        researchNotes: parsed.research_notes || null,
        generatedAt: new Date().toISOString(),
      };
    }

    // Handle old format (just array of tests)
    if (Array.isArray(parsed)) {
      return { tests: ensureThreeFormats(parsed), generatedAt: new Date().toISOString() };
    }

    return { tests: [], raw: text, generatedAt: new Date().toISOString(), parseError: true };
  } catch (e) {
    console.log('[Test Suggestions] Initial parse failed, attempting recovery...', e.message);
  }

  // Second try: Extract the "tests" array directly from the text
  // This handles malformed JSON where the root object is broken but tests array is valid
  const testsArrayMatch = text.match(/"tests"\s*:\s*(\[[\s\S]*\])\s*(?:\}|$)/);
  if (testsArrayMatch) {
    try {
      const testsArray = JSON.parse(testsArrayMatch[1]);
      if (Array.isArray(testsArray) && testsArray.length > 0) {
        console.log(`[Test Suggestions] Recovered ${testsArray.length} tests from malformed response`);
        return {
          tests: ensureThreeFormats(testsArray),
          batch_analysis: null,
          generatedAt: new Date().toISOString(),
          recoveredFromMalformed: true,
        };
      }
    } catch (e2) {
      console.log('[Test Suggestions] Could not parse extracted tests array:', e2.message);
    }
  }

  // Third try: Find any JSON object in the text
  const jsonObjMatch = text.match(/\{[\s\S]*\}/);
  if (jsonObjMatch) {
    try {
      const parsed = JSON.parse(jsonObjMatch[0]);
      if (parsed.tests && Array.isArray(parsed.tests)) {
        return {
          tests: ensureThreeFormats(parsed.tests),
          batch_analysis: parsed.batch_analysis || null,
          researchNotes: parsed.research_notes || null,
          generatedAt: new Date().toISOString(),
        };
      }
    } catch (e2) {
      // Continue to array match
    }
  }

  // Fourth try: Find any JSON array in the text (fallback for old format)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`[Test Suggestions] Recovered ${parsed.length} tests from array fallback`);
        return { tests: ensureThreeFormats(parsed), generatedAt: new Date().toISOString() };
      }
    } catch (e2) {
      // Fall through to error state
    }
  }

  console.error('[Test Suggestions] Could not parse response. Raw text length:', text.length);
  return { tests: [], raw: text, generatedAt: new Date().toISOString(), parseError: true };
}

/**
 * Post-process tests to ensure each has 3 recommended_formats
 * Fills in based on vehicle and persona if Claude didn't provide enough
 */
function ensureThreeFormats(tests) {
  // Persona → format mapping (prioritize new formats)
  const personaFormats = {
    'health_switcher': ['news_editorial', 'stat_stack_hero', 'illustrated'],
    'fit_seeker': ['before_after', 'stat_stack_hero', 'aesthetic'],
    'durability_buyer': ['stat_stack_hero', 'news_editorial', 'comparison'],
    'eco_conscious': ['news_editorial', 'illustrated', 'aesthetic'],
    'skeptic': ['stat_stack_hero', 'comparison', 'news_editorial'],
    'gift_buyer': ['aesthetic', 'illustrated', 'product_hero'],
  };

  // All available formats - prioritize new ones first
  const allFormats = [
    'stat_stack_hero', 'news_editorial', 'before_after', 'illustrated', 'aesthetic',
    'comparison', 'product_hero', 'meme', 'ugc', 'testimonial'
  ];

  return tests.map((test, index) => {
    let formats = test.recommended_formats || [];

    // Ensure array
    if (!Array.isArray(formats)) {
      formats = formats ? [formats] : [];
    }

    // Copy to avoid mutation
    formats = [...formats];

    // Add vehicle as first format if not present
    const vehicle = test.hypothesis?.vehicle;
    if (vehicle && !formats.includes(vehicle)) {
      formats.unshift(vehicle);
    }

    // Get persona-based formats
    const personaId = test.persona?.id?.toLowerCase();
    const personaDefaults = personaFormats[personaId] || allFormats.slice(0, 3);

    // ALWAYS fill up to 3 formats using persona defaults
    for (const pf of personaDefaults) {
      if (formats.length >= 3) break;
      if (!formats.includes(pf)) {
        formats.push(pf);
      }
    }

    // Final fallback - MUST reach 3 formats
    for (const f of allFormats) {
      if (formats.length >= 3) break;
      if (!formats.includes(f)) {
        formats.push(f);
      }
    }

    console.log(`[Test Suggestions] Test "${test.title?.slice(0,30)}": ${formats.slice(0,3).join(', ')}`);

    return {
      ...test,
      recommended_formats: formats.slice(0, 3),
    };
  });
}

module.exports = {
  generateTestSuggestions,
  // Suggestion management
  storeSuggestions,
  getPendingSuggestions,
  markSuggestionSaved,
  markSuggestionDismissed,
  getSuggestionStats,
  generateSuggestionHash,
  // Double-down helpers
  generateDoubleDownVariations,
  generateAllDoubleDownVariations,
};
