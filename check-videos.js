/**
 * Check video status for top ads
 */
require('dotenv').config();
const { getDb } = require('./src/database/db');

const db = getDb();
const ads = db.prepare(`
  SELECT ad_name, video_id,
    CASE WHEN video_transcript IS NOT NULL THEN 'YES' ELSE 'NO' END as has_transcript,
    CASE WHEN video_description IS NOT NULL THEN 'YES' ELSE 'NO' END as has_visuals
  FROM fb_ads
  WHERE brand_id = 1 AND spend > 0
  ORDER BY spend DESC
  LIMIT 15
`).all();

console.log('Top 15 ads by spend:\n');
ads.forEach((ad, i) => {
  console.log(`${i+1}. ${ad.ad_name.substring(0, 50)}...`);
  console.log(`   video_id: ${ad.video_id || 'NONE'}`);
  console.log(`   transcript: ${ad.has_transcript} | visuals: ${ad.has_visuals}\n`);
});

const withVideoId = ads.filter(a => a.video_id).length;
const withTranscript = ads.filter(a => a.has_transcript === 'YES').length;
const withVisuals = ads.filter(a => a.has_visuals === 'YES').length;

console.log(`Summary: ${withVideoId}/15 have video_id, ${withTranscript}/15 have transcript, ${withVisuals}/15 have visuals`);
