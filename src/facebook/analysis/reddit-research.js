/**
 * Reddit Research Service
 *
 * Scrapes Reddit for customer discussions, pain points, and desires
 * to find new advertising angles for the brand.
 *
 * Uses Reddit's public JSON API (no auth required for public content)
 */

// Subreddit mapping by brand category
const SUBREDDITS_BY_CATEGORY = {
  fashion: ['malefashionadvice', 'mensfashion', 'streetwear', 'frugalmalefashion', 'rawdenim', 'goodyearwelt', 'outliermarket', 'buyitforlife', 'femalefashionadvice', 'Fitness'],
  apparel: ['malefashionadvice', 'mensfashion', 'buyitforlife', 'frugalmalefashion', 'streetwear', 'rawdenim', 'Fitness', 'running', 'crossfit'],
  supplement: ['supplements', 'nutrition', 'nootropics', 'fitness', 'StackAdvice', 'Biohackers', 'longevity', 'testosterone', 'PCOS', 'WomensHealth'],
  skincare: ['SkincareAddiction', 'AsianBeauty', '30PlusSkinCare', 'acne', 'MensGrooming', 'tretinoin'],
  fitness: ['fitness', 'bodybuilding', 'crossfit', 'running', 'homegym', 'weightroom', 'naturalbodybuilding'],
  food_beverage: ['Hydration', 'WaterCoolerWednesday', 'tea', 'coffee', 'nutrition', 'HealthyFood'],
  fragrance: ['fragrance', 'fragranceswap', 'Colognes', 'indiemakeupandmore'],
  general: ['buyitforlife', 'reviews', 'ProductTesting']
};

// Common pain point keywords to look for
const PAIN_POINT_PATTERNS = [
  /(?:hate|annoyed|frustrated|tired of|sick of|wish)\s+(.{10,100})/gi,
  /(?:the problem with|issue with|my complaint)\s+(.{10,100})/gi,
  /(?:why can't|why don't|i wish)\s+(.{10,100})/gi,
  /(?:anyone else|does anyone)\s+(.{10,100})\?/gi,
  /(?:looking for|searching for|need a|want a)\s+(.{10,100})/gi
];

// Desire/aspiration patterns
const DESIRE_PATTERNS = [
  /(?:i want|i need|looking for|recommend)\s+(.{10,100})/gi,
  /(?:best|favorite|go-to|holy grail)\s+(.{10,100})/gi,
  /(?:finally found|game changer|life changing)\s+(.{10,100})/gi
];

/**
 * Search Reddit for relevant discussions
 * @param {string} query - Search query
 * @param {string[]} subreddits - List of subreddits to search
 * @param {number} limit - Max results per subreddit
 * @returns {Promise<Array>} - Array of relevant posts
 */
async function searchReddit(query, subreddits, limit = 5) {
  const results = [];

  for (const subreddit of subreddits.slice(0, 5)) { // Limit to 5 subreddits
    try {
      // Reddit search URL with JSON endpoint
      const searchUrl = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&limit=${limit}&sort=relevance&t=year`;

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MTRX-Research/1.0)'
        }
      });

      if (!response.ok) {
        console.log(`[Reddit] Search failed for r/${subreddit}: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const posts = data?.data?.children || [];

      for (const post of posts) {
        const p = post.data;
        if (p.removed_by_category || p.selftext === '[removed]') continue;

        results.push({
          subreddit: p.subreddit,
          title: p.title,
          selftext: (p.selftext || '').substring(0, 500),
          score: p.score,
          num_comments: p.num_comments,
          url: `https://reddit.com${p.permalink}`,
          created: new Date(p.created_utc * 1000).toISOString()
        });
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.log(`[Reddit] Error searching r/${subreddit}:`, err.message);
    }
  }

  return results;
}

/**
 * Get top comments from a Reddit post
 * @param {string} permalink - Post permalink (e.g., /r/sub/comments/abc123/title)
 * @param {number} limit - Max comments to fetch
 * @returns {Promise<Array>} - Array of top comments
 */
async function getPostComments(permalink, limit = 10) {
  try {
    const url = `https://www.reddit.com${permalink}.json?limit=${limit}&depth=1&sort=top`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MTRX-Research/1.0)'
      }
    });

    if (!response.ok) return [];

    const data = await response.json();
    const comments = data[1]?.data?.children || [];

    return comments
      .filter(c => c.kind === 't1' && c.data.body && c.data.body !== '[removed]')
      .slice(0, limit)
      .map(c => ({
        body: c.data.body.substring(0, 400),
        score: c.data.score
      }));
  } catch (err) {
    console.log(`[Reddit] Error fetching comments:`, err.message);
    return [];
  }
}

/**
 * Extract pain points and desires from text
 * @param {string} text - Text to analyze
 * @returns {Object} - Extracted insights
 */
function extractInsights(text) {
  const painPoints = [];
  const desires = [];

  for (const pattern of PAIN_POINT_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const insight = match[1]?.trim();
      if (insight && insight.length > 10 && insight.length < 150) {
        painPoints.push(insight);
      }
    }
  }

  for (const pattern of DESIRE_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const insight = match[1]?.trim();
      if (insight && insight.length > 10 && insight.length < 150) {
        desires.push(insight);
      }
    }
  }

  return { painPoints, desires };
}

/**
 * Research Reddit for a brand
 * @param {Object} brand - Brand data with name, category, etc.
 * @param {Object} options - Research options
 * @returns {Promise<Object>} - Reddit research results
 */
async function researchReddit(brand, options = {}) {
  const {
    maxThreads = 15,
    maxCommentsPerThread = 8,
    searchQueries = []
  } = options;

  console.log(`[Reddit Research] Starting for ${brand.name}...`);

  // Determine relevant subreddits
  const category = (brand.category || 'general').toLowerCase();
  const subreddits = SUBREDDITS_BY_CATEGORY[category] || SUBREDDITS_BY_CATEGORY.general;

  // Build search queries based on brand/product
  const brandKeywords = (brand.name || '').split(/\s+/);
  const productKeywords = [];

  // Extract product-related keywords from brand data
  if (brand.category === 'fashion' || brand.category === 'apparel') {
    productKeywords.push('shirts', 't-shirts', 'quality clothing', 'best fabric', 'hemp clothing', 'organic cotton', 'sustainable fashion');
  } else if (brand.category === 'supplement') {
    productKeywords.push('supplements', 'vitamins', 'best supplement', 'natural supplements');
  } else if (brand.category === 'skincare') {
    productKeywords.push('skincare routine', 'best moisturizer', 'anti-aging', 'skin products');
  }

  // Add custom queries if provided
  const queries = [
    ...searchQueries,
    ...productKeywords.slice(0, 3),
    brand.name,
    // Add angle-specific queries
    'polyester vs natural',
    'best quality shirts',
    'shirts that last',
    'why are my clothes',
    'clothing recommendations'
  ].filter(Boolean);

  // Search Reddit
  const allPosts = [];
  for (const query of queries.slice(0, 5)) { // Limit to 5 queries
    console.log(`[Reddit Research] Searching: "${query}"`);
    const posts = await searchReddit(query, subreddits, 5);
    allPosts.push(...posts);
    await new Promise(r => setTimeout(r, 300)); // Rate limit
  }

  // Deduplicate posts by URL
  const uniquePosts = [];
  const seenUrls = new Set();
  for (const post of allPosts) {
    if (!seenUrls.has(post.url)) {
      seenUrls.add(post.url);
      uniquePosts.push(post);
    }
  }

  // Sort by engagement (score + comments)
  uniquePosts.sort((a, b) => (b.score + b.num_comments) - (a.score + a.num_comments));

  // Take top posts and fetch their comments
  const topPosts = uniquePosts.slice(0, maxThreads);
  const threads = [];
  const allPainPoints = [];
  const allDesires = [];

  for (const post of topPosts) {
    // Extract insights from post title and text
    const postText = `${post.title} ${post.selftext}`;
    const postInsights = extractInsights(postText);
    allPainPoints.push(...postInsights.painPoints);
    allDesires.push(...postInsights.desires);

    // Get top comments
    const permalink = post.url.replace('https://reddit.com', '');
    const comments = await getPostComments(permalink, maxCommentsPerThread);

    // Extract insights from comments
    for (const comment of comments) {
      const commentInsights = extractInsights(comment.body);
      allPainPoints.push(...commentInsights.painPoints);
      allDesires.push(...commentInsights.desires);
    }

    threads.push({
      subreddit: post.subreddit,
      title: post.title,
      snippet: post.selftext.substring(0, 200),
      score: post.score,
      num_comments: post.num_comments,
      url: post.url,
      top_comments: comments.slice(0, 5).map(c => c.body.substring(0, 200))
    });

    await new Promise(r => setTimeout(r, 200)); // Rate limit
  }

  // Deduplicate insights
  const uniquePainPoints = [...new Set(allPainPoints)].slice(0, 15);
  const uniqueDesires = [...new Set(allDesires)].slice(0, 15);

  console.log(`[Reddit Research] Found ${threads.length} threads, ${uniquePainPoints.length} pain points, ${uniqueDesires.length} desires`);

  return {
    threads,
    painPoints: uniquePainPoints,
    desires: uniqueDesires,
    summary: {
      totalThreads: threads.length,
      totalComments: threads.reduce((sum, t) => sum + (t.top_comments?.length || 0), 0),
      subredditsSearched: [...new Set(threads.map(t => t.subreddit))],
      queriesUsed: queries.slice(0, 5)
    }
  };
}

/**
 * Format Reddit research for the test suggestions prompt
 * @param {Object} research - Research results from researchReddit
 * @returns {Array} - Formatted threads for externalSignals.reddit
 */
function formatForPrompt(research) {
  if (!research || !research.threads) return [];

  return research.threads.slice(0, 10).map(thread => ({
    subreddit: thread.subreddit,
    title: thread.title,
    snippet: thread.snippet,
    top_comments: thread.top_comments || [],
    engagement: {
      score: thread.score,
      comments: thread.num_comments
    }
  }));
}

module.exports = {
  researchReddit,
  formatForPrompt,
  searchReddit,
  getPostComments,
  SUBREDDITS_BY_CATEGORY
};
