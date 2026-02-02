/**
 * Product Analyzer Service
 * 
 * Analyzes product from image + website URL to extract:
 * - Visual product details
 * - Brand voice and positioning
 * - Target customer persona
 * 
 * Outputs the product description block used by all image skills.
 */

const BrandScraper = require('./brand-scraper');

class ProductAnalyzer {
  constructor() {
    this.brandScraper = new BrandScraper();
  }

  /**
   * Full product analysis from image + URL
   * @param {Object} options
   * @param {string} options.imageBase64 - Product image as base64
   * @param {string} options.websiteUrl - Product page URL
   * @returns {Promise<Object>} - Complete product analysis
   */
  async analyze({ imageBase64, websiteUrl }) {
    // Run analyses in parallel
    const [visualAnalysis, brandAnalysis] = await Promise.all([
      this.analyzeVisuals(imageBase64),
      this.brandScraper.scrape(websiteUrl)
    ]);

    // Combine into unified analysis
    const analysis = {
      product_info: {
        brand: brandAnalysis.brand_name || visualAnalysis.detected_brand,
        product_name: brandAnalysis.product_name || '',
        category: brandAnalysis.category || this.inferCategory(visualAnalysis),
        packaging_type: visualAnalysis.packaging_type,
        key_ingredients: brandAnalysis.ingredients || [],
        key_benefits: brandAnalysis.benefits || []
      },
      visual_identity: {
        primary_color: visualAnalysis.primary_color,
        secondary_colors: visualAnalysis.secondary_colors,
        accent_colors: visualAnalysis.accent_colors,
        packaging_style: visualAnalysis.packaging_style,
        finish: visualAnalysis.finish,
        distinctive_features: visualAnalysis.distinctive_features
      },
      brand_voice: {
        tone: brandAnalysis.tone || 'nurturing',
        energy: brandAnalysis.energy || 'balanced',
        target_gender: brandAnalysis.target_gender || 'female',
        target_age: brandAnalysis.target_age || '25-45'
      },
      product_description_block: this.buildDescriptionBlock(visualAnalysis, brandAnalysis),
      // Pass through scraped data for prompt customization
      key_phrases: brandAnalysis.key_phrases || [],
      benefits: brandAnalysis.benefits || [],
      ingredients: brandAnalysis.ingredients || []
    };

    // Add recommended directions based on analysis
    analysis.recommended_directions = this.getRecommendedDirections(analysis);

    return analysis;
  }

  /**
   * Analyze visual aspects of product image
   * @param {string} imageBase64 - Product image
   * @returns {Promise<Object>} - Visual analysis
   */
  async analyzeVisuals(imageBase64) {
    // This would integrate with vision API or use predefined analysis
    // For now, return structure that would be filled by vision analysis
    
    return {
      detected_brand: '',
      packaging_type: 'pouch', // pouch, bottle, jar, tube, box
      packaging_style: 'bold', // minimal, bold, natural, clinical, luxe
      primary_color: {
        name: '',
        hex: '',
        coverage: ''
      },
      secondary_colors: [],
      accent_colors: [],
      finish: 'matte', // matte, glossy, metallic, holographic
      distinctive_features: [],
      logo_description: '',
      text_elements: []
    };
  }

  /**
   * Build the product description block for prompts
   * @param {Object} visual - Visual analysis
   * @param {Object} brand - Brand analysis
   * @returns {string} - Description block
   */
  buildDescriptionBlock(visual, brand) {
    const parts = [];

    // Product identification
    if (brand.brand_name) {
      parts.push(`${brand.brand_name} ${brand.product_name || 'product'}`);
    }

    // Packaging type
    if (visual.packaging_type) {
      parts.push(`${visual.packaging_type}`);
    }

    // Color description
    if (visual.primary_color?.name) {
      let colorDesc = `${visual.primary_color.name} base color`;
      if (visual.secondary_colors?.length > 0) {
        colorDesc += ` with ${visual.secondary_colors.map(c => c.name).join(', ')} accents`;
      }
      parts.push(colorDesc);
    }

    // Logo/branding
    if (visual.logo_description) {
      parts.push(visual.logo_description);
    }

    // Finish
    if (visual.finish) {
      parts.push(`${visual.finish} finish`);
    }

    // Distinctive features
    if (visual.distinctive_features?.length > 0) {
      parts.push(visual.distinctive_features.join(', '));
    }

    return parts.join('. ') + '.';
  }

  /**
   * Get recommended directions based on product analysis
   * @param {Object} analysis - Complete analysis
   * @returns {Object} - Recommended directions by type
   */
  getRecommendedDirections(analysis) {
    const recommendations = {
      aesthetic: [],
      influencer: [],
      ugc: [],
      model: []
    };

    const tone = analysis.brand_voice.tone;
    const category = analysis.product_info.category;

    // Tone-based recommendations
    if (['nurturing', 'natural'].includes(tone)) {
      recommendations.aesthetic.push('botanical_ingredient', 'calm_wellness');
      recommendations.model.push('closeup_warm');
    }

    if (['aggressive', 'rebellious', 'bold'].includes(tone)) {
      recommendations.aesthetic.push('bold_color_pop', 'texture_immersion');
      recommendations.ugc.push('gym_selfie');
    }

    if (['luxurious', 'premium'].includes(tone)) {
      recommendations.aesthetic.push('texture_immersion');
      recommendations.model.push('closeup_confident');
    }

    // Category-based recommendations
    if (category === 'supplement') {
      recommendations.aesthetic.push('botanical_ingredient', 'calm_wellness');
      recommendations.ugc.push('bathroom_mirror', 'kitchen_counter');
      recommendations.influencer.push('using_product');
    }

    if (category === 'skincare') {
      recommendations.aesthetic.push('calm_wellness');
      recommendations.ugc.push('bathroom_mirror');
      recommendations.model.push('closeup_warm');
    }

    if (category === 'fitness') {
      recommendations.ugc.push('gym_selfie');
      recommendations.model.push('lifestyle_yoga');
      recommendations.influencer.push('using_product');
    }

    // Deduplicate
    Object.keys(recommendations).forEach(key => {
      recommendations[key] = [...new Set(recommendations[key])];
    });

    return recommendations;
  }

  /**
   * Infer product category from visuals
   * @param {Object} visual - Visual analysis
   * @returns {string} - Category
   */
  inferCategory(visual) {
    // Would use visual cues to infer category
    // Placeholder logic
    if (visual.packaging_type === 'pouch') return 'supplement';
    if (visual.packaging_type === 'bottle') return 'skincare';
    if (visual.packaging_type === 'jar') return 'skincare';
    return 'general';
  }
}

module.exports = ProductAnalyzer;
