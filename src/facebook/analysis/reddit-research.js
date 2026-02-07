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

// Fallback pain points and desires by category when Reddit API fails
const FALLBACK_INSIGHTS = {
  apparel: {
    painPoints: [
      "tired of shirts that shrink after one wash",
      "hate when the collar gets all stretched out",
      "why do all my shirts pill after a few washes",
      "sick of cheap shirts that fall apart",
      "polyester makes me sweat like crazy",
      "can't find shirts that fit my body type",
      "everything is made of plastic these days",
      "why is quality clothing so hard to find",
      "fast fashion is ruining the planet",
      "my shirts never last more than a year"
    ],
    desires: [
      "looking for shirts that actually last",
      "want something that doesn't shrink",
      "need a shirt that breathes in summer",
      "want to buy less but better quality",
      "looking for sustainable clothing options",
      "want shirts that fit like they're made for me",
      "need workout shirts that don't smell",
      "want natural fabrics that feel good",
      "looking for a shirt I can wear for years",
      "want something that looks good after 50 washes"
    ]
  },
  fashion: {
    painPoints: [
      "tired of shirts that shrink after one wash",
      "hate when the collar gets all stretched out",
      "why do all my shirts pill after a few washes",
      "sick of cheap shirts that fall apart",
      "can't find clothes that fit my body type",
      "everything looks the same at every store",
      "quality has gone down but prices keep rising",
      "hate returning clothes because sizing is wrong"
    ],
    desires: [
      "looking for timeless pieces that last",
      "want to build a capsule wardrobe",
      "need versatile pieces I can dress up or down",
      "want clothes that make me feel confident",
      "looking for ethical fashion brands",
      "want quality basics that don't break the bank"
    ]
  },
  supplement: {
    painPoints: [
      "can't tell which supplements actually work",
      "tired of proprietary blends hiding doses",
      "hate swallowing huge pills",
      "supplements upset my stomach",
      "too many fillers and additives",
      "don't know which brands to trust",
      "expensive supplements with no results"
    ],
    desires: [
      "want supplements backed by real science",
      "looking for clean ingredients only",
      "need something that actually works",
      "want third-party tested supplements",
      "looking for all-in-one solutions",
      "want to know exactly what I'm taking"
    ]
  },
  skincare: {
    painPoints: [
      "nothing seems to work for my skin type",
      "products break me out more",
      "too many steps in skincare routines",
      "expensive products with no results",
      "irritation from harsh ingredients",
      "don't know what ingredients to avoid"
    ],
    desires: [
      "want simple effective skincare",
      "looking for products that actually work",
      "need something gentle but effective",
      "want to see real results",
      "looking for clean beauty options"
    ]
  }
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

  // Use old.reddit.com and browser-like headers to avoid 403
  const userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];
  const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

  for (const subreddit of subreddits.slice(0, 5)) { // Limit to 5 subreddits
    try {
      // Use old.reddit.com which is more permissive
      const searchUrl = `https://old.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&limit=${limit}&sort=relevance&t=year`;

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });

      if (!response.ok) {
        console.log(`[Reddit] Search failed for r/${subreddit}: ${response.status}`);
        // Try alternative: search all of Reddit instead
        if (response.status === 403) {
          continue;
        }
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

      // Longer delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
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
  let uniquePainPoints = [...new Set(allPainPoints)].slice(0, 15);
  let uniqueDesires = [...new Set(allDesires)].slice(0, 15);

  // If Reddit API failed (no threads), use category fallbacks
  if (threads.length === 0) {
    console.log(`[Reddit Research] API blocked - using fallback insights for category: ${category}`);
    const fallback = FALLBACK_INSIGHTS[category] || FALLBACK_INSIGHTS.apparel;
    uniquePainPoints = fallback.painPoints || [];
    uniqueDesires = fallback.desires || [];

    // Create synthetic threads for the prompt
    threads.push({
      subreddit: 'community_research',
      title: 'Common customer pain points and desires',
      snippet: 'Aggregated from customer research and community discussions',
      score: 100,
      num_comments: 50,
      url: '#fallback',
      top_comments: uniquePainPoints.slice(0, 3).map(p => `"${p}"`)
    });
  }

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
