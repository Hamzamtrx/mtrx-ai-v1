/**
 * Fix missing video_ids by re-fetching from Facebook
 * Run with: node fix-video-ids.js
 */

require('dotenv').config();

const { getDb } = require('./src/database/db');
const { getAccessToken } = require('./src/facebook/data/data-sync');
const { GraphApiClient } = require('./src/facebook/data/graph-api');

const BRAND_ID = 1;

async function main() {
  const db = getDb();

  // Get ads that look like videos (VID in name) but have no video_id
  const ads = db.prepare(`
    SELECT id, fb_ad_id, ad_name, video_id, thumbnail_url
    FROM fb_ads
    WHERE brand_id = ?
      AND spend > 0
      AND (ad_name LIKE '%VID%' OR ad_name LIKE '%vid%')
      AND (video_id IS NULL OR video_id = '')
    ORDER BY spend DESC
    LIMIT 20
  `).all(BRAND_ID);

  console.log(`Found ${ads.length} VID ads missing video_id\n`);

  if (ads.length === 0) {
    console.log('All VID ads have video_id!');
    process.exit(0);
  }

  // Get access token
  let accessToken, adAccountId;
  try {
    const tokenData = getAccessToken(BRAND_ID);
    accessToken = tokenData.accessToken;
    adAccountId = tokenData.adAccountId;
  } catch (err) {
    console.error('Token error:', err.message);
    process.exit(1);
  }

  const client = new GraphApiClient(accessToken);
  let fixed = 0;

  for (const ad of ads) {
    console.log(`Checking: ${ad.ad_name.substring(0, 50)}...`);

    try {
      // Fetch creative with video_id
      const data = await client.request(`/${ad.fb_ad_id}`, {
        fields: 'creative{video_id,thumbnail_url,image_url}'
      });

      const videoId = data.creative?.video_id;
      const thumbnail = data.creative?.thumbnail_url || data.creative?.image_url;

      if (videoId) {
        db.prepare('UPDATE fb_ads SET video_id = ?, thumbnail_url = COALESCE(?, thumbnail_url) WHERE id = ?')
          .run(videoId, thumbnail, ad.id);
        console.log(`  ✓ Found video_id: ${videoId}\n`);
        fixed++;
      } else {
        console.log(`  ✗ No video_id in creative (might be image ad)\n`);
      }
    } catch (err) {
      console.log(`  ✗ Error: ${err.message}\n`);
    }
  }

  console.log(`\nFixed ${fixed} ads with video_id`);
  console.log('Now run: node process-videos.js');
}

main();
