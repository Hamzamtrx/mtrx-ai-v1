/**
 * Video Visual Analysis — uses Google Gemini to analyze video ad visuals
 * Descriptions are stored permanently in fb_ads.video_description
 */

const { getDb } = require('../../database/db');
const { getAccessToken } = require('./data-sync');
const { GraphApiClient } = require('./graph-api');
const { downloadVideoWithYtdlp } = require('./transcription');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const os = require('os');

const MAX_VIDEO_SIZE = 20 * 1024 * 1024; // 20MB Gemini inline limit

/**
 * Analyze a single video ad's visuals using Gemini
 * @param {number} brandId
 * @param {string} fbAdId - The Facebook ad ID
 * @returns {object} { success, description, error }
 */
async function analyzeVideo(brandId, fbAdId) {
  const db = getDb();

  if (!process.env.GEMINI_API_KEY) {
    return { success: false, error: 'GEMINI_API_KEY not configured in .env' };
  }

  // Get the ad
  const ad = db.prepare('SELECT fb_ad_id, ad_name, video_id, video_description FROM fb_ads WHERE brand_id = ? AND fb_ad_id = ?').get(brandId, fbAdId);
  if (!ad) return { success: false, error: 'Ad not found' };
  if (ad.video_description !== null) return { success: true, description: ad.video_description, cached: true };

  // Get access token and create Graph API client
  const { accessToken } = getAccessToken(brandId);
  const client = new GraphApiClient(accessToken);

  // If video_id is missing, try to fetch it
  if (!ad.video_id) {
    console.log(`[VideoAnalysis] video_id missing for ad ${fbAdId}, fetching...`);
    try {
      const { adAccountId } = getAccessToken(brandId);
      const data = await client.request(`/${adAccountId}/ads`, {
        filtering: JSON.stringify([{ field: 'id', operator: 'EQUAL', value: fbAdId }]),
        fields: 'creative{video_id}',
      });
      const videoId = data?.data?.[0]?.creative?.video_id || null;
      if (videoId) {
        db.prepare('UPDATE fb_ads SET video_id = ? WHERE brand_id = ? AND fb_ad_id = ?').run(videoId, brandId, fbAdId);
        ad.video_id = videoId;
        console.log(`[VideoAnalysis] Found and saved video_id ${videoId} for ad ${fbAdId}`);
      } else {
        return { success: false, error: 'Facebook did not return a video_id for this ad' };
      }
    } catch (err) {
      console.error(`[VideoAnalysis] Failed to fetch video_id for ad ${fbAdId}:`, err.message);
      return { success: false, error: 'Could not fetch video info: ' + err.message };
    }
  }

  // Download video — try Graph API first, then yt-dlp fallback
  let buffer = null;

  try {
    const sourceUrl = await client.getVideoSource(ad.video_id);
    if (sourceUrl) {
      console.log(`[VideoAnalysis] Downloading video ${ad.video_id} via Graph API`);
      const videoRes = await fetch(sourceUrl);
      if (videoRes.ok) {
        buffer = Buffer.from(await videoRes.arrayBuffer());
      }
    }
  } catch (err) {
    console.log(`[VideoAnalysis] Graph API video source failed: ${err.message}`);
  }

  if (!buffer) {
    console.log(`[VideoAnalysis] Trying yt-dlp for video ${ad.video_id}...`);
    buffer = await downloadVideoWithYtdlp(ad.video_id);
  }

  if (!buffer) return { success: false, error: 'Could not download video. Graph API permission denied and yt-dlp fallback failed.' };

  if (buffer.length > MAX_VIDEO_SIZE) {
    return { success: false, error: `Video too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Max is 20MB for Gemini inline data.` };
  }

  // Send to Gemini for visual analysis
  console.log(`[VideoAnalysis] Sending ${(buffer.length / 1024 / 1024).toFixed(1)}MB to Gemini for ad ${fbAdId}`);

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `You are a senior direct response creative strategist analyzing a winning Facebook video ad.

Provide a comprehensive breakdown:

### 1. BASIC INFO
- Estimated length:
- Format type: (UGC / Podcast / Talking Head / B-roll Heavy / Mixed)
- Number of people on screen:
- Production quality: (Lo-fi native / Mid / High polish)

### 2. FULL TRANSCRIPT
Write out every word spoken. Include:
- Speaker labels if multiple people
- [Brackets] for visual actions, text overlays, or significant visuals
- Note the pacing and delivery

### 3. HOOK ANALYSIS (First 3-5 seconds)
- Exact hook used (word for word):
- Hook type: (Transformation / Symptom Stack / Pattern Interrupt / Reverse Sell / Question / Challenge / Social Proof)
- Psychological trigger: (Fear / Curiosity / Social proof / Identity / Urgency)
- Why it stops the scroll:
- Visual in first frame:
- Hook strength rating (1-10):

### 4. FORMAT & STYLE
- Style: (UGC talking head / Podcast / B-roll heavy / Reaction / Timelapse / Mixed)
- Pacing: (Fast cuts / Slow storytelling / Mixed)
- Energy: (Calm / Energetic / Urgent / Conversational / Authoritative)
- Production level: (Lo-fi native / Mid-polish / High production)

### 5. AWARENESS LEVEL TARGETED
- Awareness level: (Unaware / Problem Aware / Solution Aware / Most Aware)
- Evidence for this assessment:
- How does the script structure reflect this awareness level?

### 6. MARKET SOPHISTICATION
- Sophistication level: (Fresh / Moderate / Saturated)
- Evidence:
- Product intro timing (seconds in / % through):

### 7. STRUCTURE BREAKDOWN
Map the script section by section:
| Timestamp | Section | What's Happening | Purpose |
|-----------|---------|------------------|---------|
| 0:00-0:05 | Hook | [describe] | Stop scroll |
| ... | ... | ... | ... |

### 8. B-ROLL USED
List all B-roll types present:
- Before state (re-enactment): Yes/No
- After state: Yes/No
- Product hero shot: Yes/No
- Product in use: Yes/No
- Lifestyle/family: Yes/No
- Text overlays: Yes/No
- Other: [describe]

### 9. CREATOR/TALENT
- Gender:
- Approximate age:
- Energy/vibe:
- Relatability factor:

### 10. KEY SCRIPT EXCERPTS
Pull the most effective sections:
- Best line in the script:
- Mechanism explanation (if applicable):
- Strongest transition/bridge:
- CTA verbatim:

### 11. VISUAL + SCRIPT SYNC
- How do visuals support the script?
- Key visual moments (product reveals, demonstrations, proof):
- Text overlays used:
- B-roll integration points:

### 12. CUSTOMER LANGUAGE BANK
Extract authentic phrases from this ad that could be reused:
| Phrase | Usage Context | Notes |
|--------|---------------|-------|

### 13. ANGLE IDENTIFICATION
- Core angle (3-5 word name):
- Target avatar:
- What strategic gap does this fill?
- Iteration ideas (how else could this angle be expressed?):

### 14. EMOTIONAL JOURNEY
- Starting emotion:
- Turning point:
- Ending emotion:
- What creates the emotional shift?

### 15. PRODUCT INTRO TIMING
- When does product first appear? (Seconds in / % through):
- How is it introduced? (Name drop / Visual / Both):
- How natural does it feel? (1-10):
- Intro phrase used:

### 16. CTA ANALYSIS
- Exact CTA used:
- Risk reversal mentioned? (Guarantee, free trial, etc.):
- Urgency/scarcity?:
- Energy of delivery:

### 17. WHAT MAKES THIS WORK
- Top 3 reasons this ad converts:
- What's the "secret sauce"?

### 18. REPLICATION NOTES
- What could we steal for our scripts?
- What's specific to this brand vs. transferable?

### 19. FORMULA IDENTIFICATION
If you were to replicate this ad's formula, what would the template be? Write a brief reusable formula.

Be specific and factual. Reference exactly what you see and hear in the video.`;

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'video/mp4',
        data: buffer.toString('base64'),
      },
    },
    { text: prompt },
  ]);

  const description = result.response.text() || '';

  // Store in database
  db.prepare('UPDATE fb_ads SET video_description = ? WHERE brand_id = ? AND fb_ad_id = ?').run(description, brandId, fbAdId);
  console.log(`[VideoAnalysis] Stored visual description for ad ${fbAdId} (${description.length} chars)`);

  return { success: true, description };
}

/**
 * Batch analyze video ads without visual descriptions
 * Prioritized: winners > potential > new > losers, then by spend DESC
 * @param {number} brandId
 * @param {number} limit - Max ads to process (default 10, max 50)
 * @returns {object} { processed, succeeded, failed, results }
 */
async function batchAnalyze(brandId, limit = 10) {
  limit = Math.min(Math.max(1, limit), 50);
  const db = getDb();

  const ads = db.prepare(`
    SELECT fb_ad_id, video_id FROM fb_ads
    WHERE brand_id = ? AND video_id IS NOT NULL AND video_description IS NULL
    ORDER BY
      CASE classification
        WHEN 'winner' THEN 1
        WHEN 'potential' THEN 2
        WHEN 'new' THEN 3
        WHEN 'loser' THEN 4
        ELSE 5
      END,
      spend DESC
    LIMIT ?
  `).all(brandId, limit);

  const results = [];
  for (const ad of ads) {
    try {
      const result = await analyzeVideo(brandId, ad.fb_ad_id);
      results.push({ adId: ad.fb_ad_id, ...result });
    } catch (err) {
      console.error(`[VideoAnalysis] Error analyzing ad ${ad.fb_ad_id}:`, err.message);
      results.push({ adId: ad.fb_ad_id, success: false, error: err.message });
    }
  }

  return {
    processed: results.length,
    succeeded: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  };
}

module.exports = { analyzeVideo, batchAnalyze };
