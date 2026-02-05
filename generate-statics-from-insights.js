/**
 * Generate Statics from Strategic Insights
 *
 * Flow:
 * 1. Get/generate strategic insights (from video analysis)
 * 2. Generate test suggestions based on insights
 * 3. For each test, generate 3 static ads
 *
 * Run with: node generate-statics-from-insights.js [brandId]
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { getDb } = require('./src/database/db');
const { generateStrategicInsights } = require('./src/facebook/analysis/strategic-insights');
const { generateTestSuggestions } = require('./src/facebook/analysis/test-suggestions');

const BRAND_ID = parseInt(process.argv[2]) || 1;
const TESTS_TO_RUN = parseInt(process.argv[3]) || 3; // How many tests to generate statics for
const STATICS_PER_TEST = 3;

// Server URL (assumes running locally)
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

async function main() {
  const db = getDb();

  // Get brand info
  const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(BRAND_ID);
  if (!brand) {
    console.error(`Brand ${BRAND_ID} not found`);
    process.exit(1);
  }

  console.log(`\n=== Generating Statics for ${brand.name} ===\n`);

  // Step 1: Get or generate strategic insights
  console.log('Step 1: Getting strategic insights...');
  let insights = null;

  const cachedInsights = db.prepare(`
    SELECT data FROM fb_analysis_cache
    WHERE brand_id = ? AND analysis_type = 'strategic_insights'
    AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `).get(BRAND_ID);

  if (cachedInsights) {
    console.log('   Using cached strategic insights');
    insights = JSON.parse(cachedInsights.data);
  } else {
    console.log('   Generating fresh strategic insights...');
    const result = await generateStrategicInsights(BRAND_ID);
    if (!result.success) {
      console.error('   Failed to generate insights:', result.message);
      process.exit(1);
    }
    insights = result.insights;
  }

  console.log('   ✓ Strategic insights ready\n');

  // Step 2: Get or generate test suggestions
  console.log('Step 2: Getting test suggestions...');
  let tests = null;

  const cachedTests = db.prepare(`
    SELECT data FROM fb_analysis_cache
    WHERE brand_id = ? AND analysis_type = 'test_suggestions'
    AND expires_at > datetime('now')
    ORDER BY created_at DESC LIMIT 1
  `).get(BRAND_ID);

  if (cachedTests) {
    console.log('   Using cached test suggestions');
    tests = JSON.parse(cachedTests.data);
  } else {
    console.log('   Generating fresh test suggestions...');
    const result = await generateTestSuggestions(BRAND_ID);
    if (!result.success) {
      console.error('   Failed to generate tests:', result.message);
      process.exit(1);
    }
    tests = result.suggestions;
  }

  if (!tests?.tests || tests.tests.length === 0) {
    console.error('   No tests generated');
    process.exit(1);
  }

  console.log(`   ✓ ${tests.tests.length} tests ready\n`);

  // Step 3: Check for required assets
  console.log('Step 3: Checking brand assets...');

  // Look for product image in brand folder
  const brandFolder = path.join(__dirname, 'brands', brand.name.toLowerCase().replace(/\s+/g, '-'));
  const uploadsFolder = path.join(__dirname, 'uploads');

  let productImagePath = null;
  let logoPath = null;

  // Check brand folder first
  if (fs.existsSync(brandFolder)) {
    const files = fs.readdirSync(brandFolder);
    for (const file of files) {
      if (/product/i.test(file) && /\.(jpg|jpeg|png|webp)$/i.test(file)) {
        productImagePath = path.join(brandFolder, file);
      }
      if (/logo/i.test(file) && /\.(jpg|jpeg|png|webp|svg)$/i.test(file)) {
        logoPath = path.join(brandFolder, file);
      }
    }
  }

  // Check database for saved paths
  if (!productImagePath && brand.product_image_path) {
    productImagePath = brand.product_image_path;
  }
  if (!logoPath && brand.logo_path) {
    logoPath = brand.logo_path;
  }

  // Check uploads folder as fallback
  if (!productImagePath && fs.existsSync(uploadsFolder)) {
    const files = fs.readdirSync(uploadsFolder);
    const brandFiles = files.filter(f => f.toLowerCase().includes(brand.name.toLowerCase()));
    for (const file of brandFiles) {
      if (/product/i.test(file) && /\.(jpg|jpeg|png|webp)$/i.test(file)) {
        productImagePath = path.join(uploadsFolder, file);
      }
    }
  }

  if (!productImagePath) {
    console.error('   ✗ No product image found for brand');
    console.error('   Please add a product image named "product.jpg" to:', brandFolder);
    console.error('   Or update the brand record with product_image_path');
    process.exit(1);
  }

  console.log(`   Product image: ${productImagePath}`);
  if (logoPath) console.log(`   Logo: ${logoPath}`);
  console.log('');

  // Step 4: Generate statics for each test
  const testsToProcess = tests.tests.slice(0, TESTS_TO_RUN);
  console.log(`Step 4: Generating ${STATICS_PER_TEST} statics for ${testsToProcess.length} tests...\n`);

  const results = [];

  for (let i = 0; i < testsToProcess.length; i++) {
    const test = testsToProcess[i];
    console.log(`\n--- Test ${i + 1}/${testsToProcess.length}: "${test.title}" ---`);
    console.log(`   Angle: ${test.angle}`);
    console.log(`   Hook: ${test.hook}`);
    console.log(`   Priority: ${test.priority}`);

    try {
      const testResult = await generateStaticsForTest({
        test,
        productImagePath,
        logoPath,
        websiteUrl: brand.website_url,
        insights,
        brandName: brand.name,
      });

      results.push({
        test: test.title,
        success: testResult.success,
        images: testResult.images || [],
        error: testResult.error,
      });

      if (testResult.success) {
        console.log(`   ✓ Generated ${testResult.images?.length || 0} statics`);
      } else {
        console.log(`   ✗ Failed: ${testResult.error}`);
      }
    } catch (err) {
      console.error(`   ✗ Error: ${err.message}`);
      results.push({
        test: test.title,
        success: false,
        error: err.message,
      });
    }
  }

  // Summary
  console.log('\n\n=== Generation Complete ===\n');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`Total tests: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);

  if (successful.length > 0) {
    const totalImages = successful.reduce((sum, r) => sum + (r.images?.length || 0), 0);
    console.log(`Total images generated: ${totalImages}`);
    console.log('\nGenerated images saved to: ./generated/');
  }

  if (failed.length > 0) {
    console.log('\nFailed tests:');
    failed.forEach(f => console.log(`  - ${f.test}: ${f.error}`));
  }

  process.exit(0);
}

/**
 * Generate statics for a single test using the API
 */
async function generateStaticsForTest({ test, productImagePath, logoPath, websiteUrl, insights, brandName }) {
  // Build fbInsights from test + strategic insights
  const fbInsights = {
    proposedAngle: test.angle,
    copyDirection: test.copyDirection,
    hook: test.hook,
    format: 'static',
    // Include winning patterns from strategic insights
    winningPatterns: {
      angles: insights?.winningAngles?.details || '',
      creators: insights?.creatorAnalysis?.details || '',
      visuals: insights?.visualAndFormat?.details || '',
    },
    audienceInsights: insights?.audienceSignals?.details || '',
  };

  // Build form data
  const FormData = require('form-data');
  const formData = new FormData();

  // Add product image
  formData.append('image', fs.createReadStream(productImagePath));

  // Add logo if available
  if (logoPath && fs.existsSync(logoPath)) {
    formData.append('logo', fs.createReadStream(logoPath));
  }

  // Add other fields
  formData.append('url', websiteUrl || 'https://example.com');
  formData.append('category', 'apparel');
  formData.append('variantsPerType', String(STATICS_PER_TEST));

  // Select static types that work well for different angles
  // Type 1: Product Hero, Type 2: Meme Static, Type 6: UGC Caption
  const staticTypes = ['type1', 'type2', 'type6'];
  formData.append('staticTypes', JSON.stringify(staticTypes));

  // Pass the angle
  formData.append('angle', test.hook || test.angle);

  // Pass fbInsights
  formData.append('fbInsights', JSON.stringify(fbInsights));

  // Make request to local server
  const response = await fetch(`${SERVER_URL}/generate-statics`, {
    method: 'POST',
    body: formData,
    headers: formData.getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Server returned ${response.status}`);
  }

  // Parse SSE response
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const images = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));

          if (data.type === 'complete' || data.type === 'image') {
            images.push({
              id: data.id,
              direction: data.direction,
              url: data.url || data.image?.url,
              localPath: data.localPath,
            });
            console.log(`      Generated: ${data.direction}`);
          } else if (data.type === 'error') {
            console.log(`      Error: ${data.error}`);
          }
        } catch (e) {
          // Skip non-JSON lines
        }
      }
    }
  }

  return {
    success: images.length > 0,
    images,
    error: images.length === 0 ? 'No images generated' : null,
  };
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
