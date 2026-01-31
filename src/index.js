/**
 * MTRX AI V1 - Product Image Generator
 * 
 * Main entry point for the image generation system.
 */

require('dotenv').config();

const NanoBananaAPI = require('./api/nano-banana');
const ProductAnalyzer = require('./services/product-analyzer');
const PromptBuilder = require('./services/prompt-builder');
const fs = require('fs').promises;
const path = require('path');

class MTRXImageGenerator {
  constructor() {
    this.api = new NanoBananaAPI(process.env.NANO_BANANA_API_KEY);
    this.analyzer = new ProductAnalyzer();
    this.promptBuilder = new PromptBuilder(path.join(__dirname, '../skills'));
  }

  /**
   * Generate product images
   * @param {Object} options
   * @param {string} options.productImagePath - Path to product image
   * @param {string} options.productImageUrl - Public URL to product image (for API)
   * @param {string} options.websiteUrl - Product website URL
   * @param {string} options.imageType - aesthetic, influencer, ugc, model
   * @param {string[]} options.directions - Specific directions to generate
   * @param {string} options.outputDir - Directory to save outputs
   * @returns {Promise<Object[]>} - Generated images
   */
  async generate({ productImagePath, productImageUrl, websiteUrl, imageType, directions, outputDir = './output' }) {
    console.log('🚀 Starting MTRX AI Image Generation...\n');

    // Step 1: Load and encode product image
    console.log('📸 Loading product image...');
    const imageBase64 = await NanoBananaAPI.imageToBase64(productImagePath);
    console.log(`   Image URL: ${productImageUrl || 'not available'}`);

    // Step 2: Analyze product
    console.log('🔍 Analyzing product...');
    const analysis = await this.analyzer.analyze({
      imageBase64,
      websiteUrl
    });
    console.log(`   Brand: ${analysis.product_info.brand}`);
    console.log(`   Category: ${analysis.product_info.category}`);
    console.log(`   Tone: ${analysis.brand_voice.tone}`);

    // Step 3: Use recommended directions if none specified
    if (!directions || directions.length === 0) {
      directions = analysis.recommended_directions[imageType] || [];
      console.log(`   Using recommended directions: ${directions.join(', ')}`);
    }

    // Step 4: Generate images for each direction
    console.log('\n🎨 Generating images...');
    const results = [];

    for (const direction of directions) {
      console.log(`   → Generating ${direction}...`);
      
      try {
        // Build prompt
        const prompt = await this.promptBuilder.buildPrompt({
          imageType,
          direction,
          productAnalysis: analysis,
          productAngle: 'front_hero'
        });

        // Generate image
        const result = await this.api.generateImage({
          prompt,
          referenceImageUrl: productImageUrl,
          aspectRatio: '1:1'
        });

        if (result.success) {
          // Save image
          const filename = `${imageType}_${direction}_${Date.now()}.png`;
          const outputPath = path.join(outputDir, filename);
          await fs.mkdir(outputDir, { recursive: true });
          
          if (result.imageBase64) {
            await NanoBananaAPI.base64ToImage(result.imageBase64, outputPath);
          }

          results.push({
            direction,
            success: true,
            path: outputPath,
            url: result.imageUrl
          });
          console.log(`   ✅ ${direction} saved to ${filename}`);
        } else {
          results.push({
            direction,
            success: false,
            error: result.error
          });
          console.log(`   ❌ ${direction} failed: ${result.error}`);
        }
      } catch (error) {
        results.push({
          direction,
          success: false,
          error: error.message
        });
        console.log(`   ❌ ${direction} error: ${error.message}`);
      }
    }

    // Summary
    const successful = results.filter(r => r.success).length;
    console.log(`\n✨ Done! Generated ${successful}/${directions.length} images.`);

    return results;
  }

  /**
   * Generate a single image (for real-time streaming)
   * @param {Object} options
   * @param {string} options.productImagePath - Path to product image
   * @param {string} options.productImageUrl - Public URL to product image (for API)
   * @param {string} options.websiteUrl - Product website URL
   * @param {string} options.imageType - aesthetic, influencer, ugc, model
   * @param {string} options.direction - Specific direction to generate
   * @param {string} options.outputDir - Directory to save outputs
   * @param {string} options.aspectRatio - Aspect ratio (1:1, 4:5, 9:16, 16:9)
   * @param {Object} options.cachedAnalysis - Pre-analyzed product data (optional)
   * @param {string} options.customPrompt - Custom prompt to use instead of building one (for static designer)
   * @returns {Promise<Object>} - Generated image result
   */
  async generateSingle({ productImagePath, productImageUrl, websiteUrl, imageType, direction, outputDir = './output', aspectRatio = '1:1', cachedAnalysis = null, customPrompt = null, logoUrl = null }) {
    try {
      // Use cached analysis or perform new analysis
      let analysis = cachedAnalysis;

      if (!analysis) {
        const imageBase64 = await NanoBananaAPI.imageToBase64(productImagePath);
        analysis = await this.analyzer.analyze({
          imageBase64,
          websiteUrl
        });
      }

      // Use custom prompt if provided, otherwise build from photography skills
      let prompt;
      if (customPrompt) {
        prompt = customPrompt;
        console.log('   Using custom prompt from static skill');
      } else {
        prompt = await this.promptBuilder.buildPrompt({
          imageType,
          direction,
          productAnalysis: analysis,
          productAngle: 'front_hero'
        });
      }

      // Generate image via API
      const result = await this.api.generateImage({
        prompt,
        referenceImageUrl: productImageUrl,
        logoUrl: logoUrl,
        aspectRatio: aspectRatio
      });

      if (result.success) {
        // Save image locally
        const filename = `${imageType}_${direction}_${Date.now()}.png`;
        const outputPath = path.join(outputDir, filename);
        await fs.mkdir(outputDir, { recursive: true });

        if (result.imageBase64) {
          await NanoBananaAPI.base64ToImage(result.imageBase64, outputPath);
        }

        return {
          success: true,
          direction,
          imageType,
          path: outputPath,
          url: result.imageUrl,
          analysis // Return analysis for caching
        };
      } else {
        return {
          success: false,
          direction,
          imageType,
          error: result.error
        };
      }
    } catch (error) {
      return {
        success: false,
        direction,
        imageType,
        error: error.message
      };
    }
  }

  /**
   * Analyze product (for caching before multiple generations)
   * @param {Object} options
   * @param {string} options.productImagePath - Path to product image
   * @param {string} options.websiteUrl - Product website URL
   * @returns {Promise<Object>} - Product analysis
   */
  async analyzeProduct({ productImagePath, websiteUrl }) {
    const imageBase64 = await NanoBananaAPI.imageToBase64(productImagePath);
    return await this.analyzer.analyze({
      imageBase64,
      websiteUrl
    });
  }

  /**
   * Get available directions for an image type
   * @param {string} imageType
   * @returns {Object} - Available directions
   */
  async getDirections(imageType) {
    const configPath = path.join(__dirname, '../config/directions.json');
    const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    return config.image_types[imageType]?.directions || {};
  }

  /**
   * Test API connection
   * @returns {Promise<Object>} - API status
   */
  async testConnection() {
    return await this.api.checkStatus();
  }
}

// Export for use as module
module.exports = MTRXImageGenerator;

// CLI usage
if (require.main === module) {
  const generator = new MTRXImageGenerator();
  
  // Parse CLI args
  const args = process.argv.slice(2);
  const imageArg = args.find(a => a.startsWith('--image='));
  const urlArg = args.find(a => a.startsWith('--url='));
  const typeArg = args.find(a => a.startsWith('--type='));

  if (!imageArg || !urlArg || !typeArg) {
    console.log('Usage: node src/index.js --image=./product.png --url=https://example.com --type=aesthetic');
    process.exit(1);
  }

  generator.generate({
    productImagePath: imageArg.split('=')[1],
    websiteUrl: urlArg.split('=')[1],
    imageType: typeArg.split('=')[1]
  }).catch(console.error);
}
