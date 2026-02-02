/**
 * Brand Scraper Service
 * 
 * Scrapes website to extract:
 * - Brand name and product name
 * - Key ingredients and benefits
 * - Brand voice and tone
 * - Target customer signals
 */

class BrandScraper {
  constructor() {
    this.toneKeywords = {
      nurturing: ['care', 'support', 'gentle', 'nourish', 'love', 'mom', 'mother', 'family', 'natural'],
      aggressive: ['power', 'crush', 'dominate', 'beast', 'alpha', 'elite', 'extreme', 'maximum'],
      clinical: ['clinically', 'proven', 'research', 'study', 'doctor', 'science', 'formula', 'tested'],
      playful: ['fun', 'enjoy', 'happy', 'smile', 'joy', 'love', 'amazing', 'awesome'],
      luxurious: ['premium', 'luxury', 'exclusive', 'elite', 'refined', 'sophisticated', 'artisan'],
      rebellious: ['rebel', 'break', 'disrupt', 'different', 'challenge', 'bold', 'unapologetic']
    };

    this.categoryKeywords = {
      fashion: ['shirt', 't-shirt', 'tee', 'hoodie', 'jacket', 'pants', 'jeans', 'dress', 'clothing', 'apparel', 'wear', 'outfit', 'fabric', 'cotton', 'size', 'fit', 'sleeve', 'collar', 'streetwear', 'fashion'],
      supplement: ['supplement', 'capsule', 'vitamin', 'mineral', 'nutrient', 'dose', 'serving', 'dietary'],
      skincare: ['skin', 'glow', 'radiant', 'serum', 'cream', 'moisturize', 'anti-aging', 'skincare'],
      fitness: ['workout', 'muscle', 'protein', 'gym', 'athlete', 'performance', 'energy'],
      food_beverage: ['taste', 'flavor', 'drink', 'eat', 'delicious', 'recipe', 'water', 'bottle', 'beverage', 'hydration', 'sparkling', 'mineral water', 'spring water', 'refreshing'],
      fragrance: ['fragrance', 'perfume', 'cologne', 'scent', 'eau de', 'toilette', 'parfum', 'oud', 'musk', 'notes']
    };
  }

  /**
   * Scrape brand information from URL
   * @param {string} url - Website URL
   * @returns {Promise<Object>} - Brand analysis
   */
  async scrape(url) {
    try {
      // Fetch the page
      const response = await fetch(url);
      const html = await response.text();

      // Extract information
      const analysis = {
        brand_name: this.extractBrandName(html, url),
        product_name: this.extractProductName(html),
        category: this.inferCategory(html),
        ingredients: this.extractIngredients(html),
        benefits: this.extractBenefits(html),
        tone: this.inferTone(html),
        energy: this.inferEnergy(html),
        target_gender: this.inferTargetGender(html),
        target_age: this.inferTargetAge(html),
        price_point: this.extractPrice(html),
        key_phrases: this.extractKeyPhrases(html)
      };

      return analysis;
    } catch (error) {
      console.error('Brand scraping failed:', error);
      return this.getDefaultAnalysis();
    }
  }

  /**
   * Extract brand name from page
   * @param {string} html - Page HTML
   * @param {string} url - Page URL
   * @returns {string} - Brand name
   */
  extractBrandName(html, url) {
    // Try meta tags first
    const ogSiteName = this.extractMeta(html, 'og:site_name');
    if (ogSiteName) return ogSiteName;

    // Try title tag
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      const title = titleMatch[1];
      // Often format is "Product | Brand" or "Brand - Product"
      const parts = title.split(/[|\-–—]/);
      if (parts.length > 1) {
        return parts[parts.length - 1].trim();
      }
    }

    // Extract from URL
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace('www.', '');
      const brand = hostname.split('.')[0];
      return this.titleCase(brand);
    } catch {
      return '';
    }
  }

  /**
   * Extract product name
   * @param {string} html - Page HTML
   * @returns {string} - Product name
   */
  extractProductName(html) {
    // Try h1 first
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) return h1Match[1].trim();

    // Try og:title
    const ogTitle = this.extractMeta(html, 'og:title');
    if (ogTitle) return ogTitle;

    // Try product schema
    const productNameMatch = html.match(/"name"\s*:\s*"([^"]+)"/);
    if (productNameMatch) return productNameMatch[1];

    return '';
  }

  /**
   * Extract ingredients list
   * @param {string} html - Page HTML
   * @returns {string[]} - Ingredients
   */
  extractIngredients(html) {
    const ingredients = [];
    
    // Look for common ingredient patterns
    const patterns = [
      /ingredients?:?\s*([^<]+)/gi,
      /contains?:?\s*([^<]+)/gi,
      /made with:?\s*([^<]+)/gi
    ];

    for (const pattern of patterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        const text = match[1];
        // Split by commas and clean
        const items = text.split(/[,;]/).map(i => i.trim()).filter(i => i.length < 50);
        ingredients.push(...items);
      }
    }

    // Deduplicate and limit
    return [...new Set(ingredients)].slice(0, 10);
  }

  /**
   * Extract benefits
   * @param {string} html - Page HTML
   * @returns {string[]} - Benefits
   */
  extractBenefits(html) {
    const benefits = [];
    
    // Look for benefit patterns
    const patterns = [
      /benefits?:?\s*([^<]+)/gi,
      /helps?\s+(with\s+)?([^<.]+)/gi,
      /supports?\s+([^<.]+)/gi,
      /promotes?\s+([^<.]+)/gi,
      /improves?\s+([^<.]+)/gi
    ];

    for (const pattern of patterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        const text = match[match.length - 1]?.trim();
        if (text && text.length < 100) {
          benefits.push(text);
        }
      }
    }

    return [...new Set(benefits)].slice(0, 8);
  }

  /**
   * Infer brand tone from content
   * @param {string} html - Page HTML
   * @returns {string} - Tone
   */
  inferTone(html) {
    const text = this.extractTextContent(html).toLowerCase();
    
    const scores = {};
    for (const [tone, keywords] of Object.entries(this.toneKeywords)) {
      scores[tone] = keywords.filter(k => text.includes(k)).length;
    }

    // Find highest scoring tone
    const maxTone = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return maxTone[1] > 0 ? maxTone[0] : 'nurturing';
  }

  /**
   * Infer energy level
   * @param {string} html - Page HTML
   * @returns {string} - Energy
   */
  inferEnergy(html) {
    const text = this.extractTextContent(html).toLowerCase();
    
    const highEnergyWords = ['power', 'energy', 'boost', 'explosive', 'intense', 'maximum'];
    const calmWords = ['calm', 'peace', 'gentle', 'soothe', 'relax', 'balance'];

    const highCount = highEnergyWords.filter(w => text.includes(w)).length;
    const calmCount = calmWords.filter(w => text.includes(w)).length;

    if (highCount > calmCount) return 'high';
    if (calmCount > highCount) return 'calm';
    return 'balanced';
  }

  /**
   * Infer target gender
   * @param {string} html - Page HTML
   * @returns {string} - Gender
   */
  inferTargetGender(html) {
    const text = this.extractTextContent(html).toLowerCase();
    const url = html.toLowerCase();

    // Strong male indicators (product names/categories)
    const strongMaleIndicators = [
      'for men', 'for him', "men's", 'mens ', 'homme', 'pour homme',
      'masculin', 'gentleman', 'grooming', 'beard', 'shave', 'aftershave',
      'cologne', 'barbershop', 'rugged', 'alpha male'
    ];

    // Strong female indicators
    const strongFemaleIndicators = [
      'for women', 'for her', "women's", 'womens ', 'femme', 'pour femme',
      'feminine', 'ladies', 'goddess', 'queen', 'floral', 'blossom'
    ];

    // Check for strong indicators first
    const hasStrongMale = strongMaleIndicators.some(w => text.includes(w));
    const hasStrongFemale = strongFemaleIndicators.some(w => text.includes(w));

    if (hasStrongMale && !hasStrongFemale) return 'male';
    if (hasStrongFemale && !hasStrongMale) return 'female';

    // Fallback to word counting
    const femaleWords = ['women', 'woman', 'her', 'she', 'mom', 'mother', 'feminine', 'queen', 'goddess', 'girl', 'lady'];
    const maleWords = ['men', 'man', 'his', 'he', 'dad', 'father', 'masculine', 'king', 'alpha', 'guy', 'gentleman', 'boy'];

    const femaleCount = femaleWords.filter(w => text.includes(w)).length;
    const maleCount = maleWords.filter(w => text.includes(w)).length;

    if (maleCount > femaleCount) return 'male';
    if (femaleCount > maleCount) return 'female';

    // Check URL for gender hints
    if (url.includes('/men') || url.includes('-men') || url.includes('homme')) return 'male';
    if (url.includes('/women') || url.includes('-women') || url.includes('femme')) return 'female';

    return 'female'; // Default to female as most beauty products target women
  }

  /**
   * Infer target age range
   * @param {string} html - Page HTML
   * @returns {string} - Age range
   */
  inferTargetAge(html) {
    const text = this.extractTextContent(html).toLowerCase();
    
    if (text.includes('anti-aging') || text.includes('menopause') || text.includes('40+')) {
      return '40-60';
    }
    if (text.includes('college') || text.includes('young') || text.includes('20s')) {
      return '18-30';
    }
    if (text.includes('mom') || text.includes('parent') || text.includes('busy professional')) {
      return '28-45';
    }

    return '25-45';
  }

  /**
   * Infer product category
   * @param {string} html - Page HTML
   * @returns {string} - Category
   */
  inferCategory(html) {
    const text = this.extractTextContent(html).toLowerCase();
    
    const scores = {};
    for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
      scores[category] = keywords.filter(k => text.includes(k)).length;
    }

    const maxCategory = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return maxCategory[1] > 0 ? maxCategory[0] : 'general';
  }

  /**
   * Extract price from page
   * @param {string} html - Page HTML
   * @returns {string} - Price point
   */
  extractPrice(html) {
    const priceMatch = html.match(/\$(\d+(?:\.\d{2})?)/);
    if (priceMatch) {
      const price = parseFloat(priceMatch[1]);
      if (price < 20) return 'budget';
      if (price < 50) return 'mid-range';
      if (price < 100) return 'premium';
      return 'luxury';
    }
    return 'mid-range';
  }

  /**
   * Extract key phrases/taglines
   * @param {string} html - Page HTML
   * @returns {string[]} - Key phrases
   */
  extractKeyPhrases(html) {
    const phrases = [];
    
    // Look for taglines in meta
    const description = this.extractMeta(html, 'description');
    if (description) phrases.push(description);

    // Look for short bold/strong text
    const strongMatches = html.matchAll(/<(?:strong|b)[^>]*>([^<]{10,80})<\/(?:strong|b)>/gi);
    for (const match of strongMatches) {
      phrases.push(match[1].trim());
    }

    return phrases.slice(0, 5);
  }

  /**
   * Extract meta tag content
   * @param {string} html - Page HTML
   * @param {string} name - Meta name/property
   * @returns {string|null} - Content
   */
  extractMeta(html, name) {
    const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
    const match = html.match(pattern);
    return match ? match[1] : null;
  }

  /**
   * Extract text content from HTML
   * @param {string} html - Page HTML
   * @returns {string} - Text content
   */
  extractTextContent(html) {
    // Remove scripts, styles, and tags
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Convert to title case
   * @param {string} str - String
   * @returns {string} - Title cased
   */
  titleCase(str) {
    return str.replace(/\w\S*/g, txt => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  }

  /**
   * Get default analysis when scraping fails
   * @returns {Object} - Default analysis
   */
  getDefaultAnalysis() {
    return {
      brand_name: '',
      product_name: '',
      category: 'supplement',
      ingredients: [],
      benefits: [],
      tone: 'nurturing',
      energy: 'balanced',
      target_gender: 'female',
      target_age: '25-45',
      price_point: 'mid-range',
      key_phrases: []
    };
  }
}

module.exports = BrandScraper;
