/**
 * Process videos — transcribe and analyze top ads
 * Run with: node process-videos.js
 */

require('dotenv').config();

const { batchTranscribe } = require('./src/facebook/data/transcription');
const { batchAnalyze } = require('./src/facebook/data/video-analysis');

const BRAND_ID = 1;
const LIMIT = 15;

async function main() {
  console.log('=== Processing Videos for Brand', BRAND_ID, '===\n');

  // Step 1: Transcribe
  console.log('Step 1: Transcribing videos (what they SAY)...\n');
  try {
    const transcriptResult = await batchTranscribe(BRAND_ID, LIMIT);
    console.log('Transcription result:', transcriptResult);
  } catch (err) {
    console.error('Transcription error:', err.message);
  }

  console.log('\n---\n');

  // Step 2: Analyze visuals
  console.log('Step 2: Analyzing visuals (what you SEE)...\n');
  try {
    const visualResult = await batchAnalyze(BRAND_ID, LIMIT);
    console.log('Visual analysis result:', visualResult);
  } catch (err) {
    console.error('Visual analysis error:', err.message);
  }

  console.log('\n=== Done! Now run "Analyze with AI" ===');
  process.exit(0);
}

main();
