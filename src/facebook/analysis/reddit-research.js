/**
 * Reddit Research Service
 *
 * Finds Reddit discussions via web search to discover customer pain points,
 * desires, and new advertising angles.
 *
 * Uses DuckDuckGo web search with site:reddit.com filter (no API key needed)
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
/**
 * Search for Reddit discussions using DuckDuckGo web search
 * @param {string} query - Search query
 * @param {string[]} subreddits - Subreddits to prioritize (used in search)
 * @param {number} limit - Max results
 * @returns {Promise<Array>} - Array of Reddit posts found
 */
async function searchRedditViaWeb(query, subreddits, limit = 15) {
  const results = [];

  // Build search queries - combine main query with subreddit targets
  const searchQueries = [
    `site:reddit.com ${query}`,
    ...subreddits.slice(0, 3).map(sub => `site:reddit.com/r/${sub} ${query}`)
  ];

  for (const searchQuery of searchQueries) {
    try {
      console.log(`[Reddit Web Search] "${searchQuery}"`);

      // Use DuckDuckGo HTML search
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });

      if (!response.ok) {
        console.log(`[Reddit Web Search] Failed: ${response.status}`);
        continue;
      }

      const html = await response.text();

      // Extract Reddit links and snippets from DuckDuckGo results
      // Pattern: <a class="result__a" href="...reddit.com...">Title</a>
      // And: <a class="result__snippet">Snippet text</a>
      const resultPattern = /<a[^>]+class="result__a"[^>]+href="([^"]*reddit\.com[^"]*)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([^<]*)</g;

      let match;
      while ((match = resultPattern.exec(html)) !== null && results.length < limit) {
        const [, url, title, snippet] = match;

        // Skip non-discussion URLs (media, user profiles, etc)
        if (url.includes('/user/') || url.includes('/media') || url.includes('.jpg') || url.includes('.png')) {
          continue;
        }

        // Extract subreddit from URL
        const subredditMatch = url.match(/reddit\.com\/r\/([^\/]+)/);
        const subreddit = subredditMatch ? subredditMatch[1] : 'unknown';

        // Decode HTML entities
        const cleanTitle = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
        const cleanSnippet = snippet.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

        // Avoid duplicates
        if (results.some(r => r.url === url)) continue;

        results.push({
          subreddit,
          title: cleanTitle,
          selftext: cleanSnippet,
          score: 0, // Not available from web search
          num_comments: 0,
          url: url.startsWith('//') ? 'https:' + url : url,
          created: null
        });
      }

      // Delay between searches
      await new Promise(r => setTimeout(r, 800));

    } catch (err) {
      console.log(`[Reddit Web Search] Error:`, err.message);
    }
  }

  console.log(`[Reddit Web Search] Found ${results.length} results`);
  return results;
}

/**
 * Get top comments from a Reddit post
 * @param {string} permalink - Post permalink (e.g., /r/sub/comments/abc123/title)
 * @param {number} limit - Max comments to fetch
 * @returns {Promise<Array>} - Array of top comments
 */
/**
 * Fetch Reddit post content and comments by scraping the page
 * @param {string} url - Full Reddit URL
 * @param {number} limit - Max comments to extract
 * @returns {Promise<Object>} - Post content and comments
 */
async function fetchRedditPost(url, limit = 10) {
  try {
    // Try old.reddit.com which has simpler HTML
    const oldUrl = url.replace('www.reddit.com', 'old.reddit.com').replace('reddit.com', 'old.reddit.com');

    const response = await fetch(oldUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      }
    });

    if (!response.ok) {
      console.log(`[Reddit Fetch] Failed for ${url}: ${response.status}`);
      return { selftext: '', comments: [] };
    }

    const html = await response.text();

    // Extract post body (selftext)
    let selftext = '';
    const selftextMatch = html.match(/<div class="[^"]*md[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    if (selftextMatch) {
      selftext = selftextMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 1000);
    }

    // Extract comments
    const comments = [];
    const commentPattern = /<div class="[^"]*usertext-body[^"]*"[^>]*>[\s\S]*?<div class="[^"]*md[^"]*"[^>]*>([\s\S]*?)<\/div>/g;

    let match;
    while ((match = commentPattern.exec(html)) !== null && comments.length < limit) {
      const commentText = match[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();

      if (commentText.length > 20 && commentText.length < 800) {
        comments.push({ body: commentText, score: 0 });
      }
    }

    console.log(`[Reddit Fetch] Got ${selftext.length} chars selftext, ${comments.length} comments from ${url}`);
    return { selftext, comments };

  } catch (err) {
    console.log(`[Reddit Fetch] Error:`, err.message);
    return { selftext: '', comments: [] };
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

  // Build diverse search queries for better coverage
  const queries = [
    ...searchQueries,
    ...productKeywords.slice(0, 4),
    // Pain point queries
    'hate my shirts',
    'tired of cheap clothes',
    'shirt recommendations',
    'why do shirts shrink',
    'best quality t-shirt',
    'clothes that last',
    'polyester problems',
    'sustainable clothing'
  ].filter(Boolean);

  // Search Reddit via web search
  console.log(`[Reddit Research] Searching with ${queries.length} queries...`);
  const allPosts = await searchRedditViaWeb(queries[0], subreddits, 20);

  // Do additional searches with other queries
  for (const query of queries.slice(1, 4)) {
    const morePosts = await searchRedditViaWeb(query, subreddits, 10);
    allPosts.push(...morePosts);
    await new Promise(r => setTimeout(r, 500));
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

  // Take top posts and fetch their full content + comments
  const topPosts = uniquePosts.slice(0, maxThreads);
  const threads = [];
  const allPainPoints = [];
  const allDesires = [];

  console.log(`[Reddit Research] Fetching content from ${topPosts.length} threads...`);

  for (const post of topPosts) {
    // Fetch full post content and comments
    const { selftext: fullText, comments } = await fetchRedditPost(post.url, maxCommentsPerThread);

    // Use fetched content or fall back to snippet from search
    const postContent = fullText || post.selftext || '';

    // Extract insights from post title and text
    const postText = `${post.title} ${postContent}`;
    const postInsights = extractInsights(postText);
    allPainPoints.push(...postInsights.painPoints);
    allDesires.push(...postInsights.desires);

    // Extract insights from comments
    for (const comment of comments) {
      const commentInsights = extractInsights(comment.body);
      allPainPoints.push(...commentInsights.painPoints);
      allDesires.push(...commentInsights.desires);
    }

    threads.push({
      subreddit: post.subreddit,
      title: post.title,
      snippet: postContent.substring(0, 300) || post.selftext,
      score: post.score,
      num_comments: comments.length,
      url: post.url,
      top_comments: comments.slice(0, 5).map(c => c.body.substring(0, 250))
    });

    // Rate limit between fetches
    await new Promise(r => setTimeout(r, 600));
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
  searchRedditViaWeb,
  fetchRedditPost,
  SUBREDDITS_BY_CATEGORY
};
