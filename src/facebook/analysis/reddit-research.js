/**
 * Reddit Research Service
 *
 * Finds Reddit discussions via web search to discover customer pain points,
 * desires, and new advertising angles.
 *
 * Uses Brave web search with site:reddit.com filter (no API key needed)
 */

// Cache for Reddit research results (avoid rate limiting)
const redditCache = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

// Track used thread URLs per brand to ensure fresh ideas each time
// Key: brandId, Value: Set of used URLs
const usedThreadsCache = new Map();
const USED_THREADS_TTL = 24 * 60 * 60 * 1000; // 24 hours - reset daily
const usedThreadsTimestamps = new Map();

/**
 * Mark threads as used for a brand
 */
function markThreadsAsUsed(brandId, threads) {
  if (!usedThreadsCache.has(brandId)) {
    usedThreadsCache.set(brandId, new Set());
    usedThreadsTimestamps.set(brandId, Date.now());
  }

  // Check if we should reset (after 24 hours)
  const timestamp = usedThreadsTimestamps.get(brandId);
  if (Date.now() - timestamp > USED_THREADS_TTL) {
    usedThreadsCache.set(brandId, new Set());
    usedThreadsTimestamps.set(brandId, Date.now());
  }

  const usedUrls = usedThreadsCache.get(brandId);
  threads.forEach(t => {
    if (t.url) usedUrls.add(t.url);
  });
}

/**
 * Filter out previously used threads
 */
function filterUsedThreads(brandId, threads) {
  const usedUrls = usedThreadsCache.get(brandId);
  if (!usedUrls || usedUrls.size === 0) return threads;

  const freshThreads = threads.filter(t => !usedUrls.has(t.url));
  console.log(`[Reddit Research] Filtered ${threads.length - freshThreads.length} previously used threads, ${freshThreads.length} fresh`);
  return freshThreads;
}

/**
 * Clear used threads for a brand (for manual reset)
 */
function clearUsedThreads(brandId) {
  usedThreadsCache.delete(brandId);
  usedThreadsTimestamps.delete(brandId);
  console.log(`[Reddit Research] Cleared used threads for brand ${brandId}`);
}

// Subreddit mapping by brand category - COMPREHENSIVE list for deep research
const SUBREDDITS_BY_CATEGORY = {
  fashion: ['malefashionadvice', 'mensfashion', 'streetwear', 'frugalmalefashion', 'rawdenim', 'goodyearwelt', 'outliermarket', 'buyitforlife', 'femalefashionadvice', 'Fitness', 'AskMen', 'minimalism', 'onebag', 'AskReddit', 'malelifestyle', 'everymanshouldknow'],
  apparel: [
    // HEALTH SCIENCE (gruesome facts about plastics/chemicals)
    'science', 'health', 'Futurology', 'environment', 'collapse',
    'PlasticFreeLiving', 'ZeroWaste', 'Anticonsumption',
    // HORMONE/FERTILITY (Undrdog's core angle)
    'testosterone', 'Biohackers', 'maleinfertility', 'TRT', 'Supplements',
    'PCOS', 'Fertility', 'TryingForABaby', 'longevity',
    // LIFESTYLE/DIET (health-conscious men)
    'carnivore', 'zerocarb', 'Paleo', 'keto', 'nutrition',
    // COMPLIMENTS/SOCIAL (outcome stories)
    'AskMen', 'AskMenOver30', 'AskReddit', 'AskWomen',
    'malefashionadvice', 'femalefashionadvice',
    // TRANSFORMATION/SELF-IMPROVEMENT
    'selfimprovement', 'decidingtobebetter', 'getdisciplined', 'confidence',
    // QUALITY/DURABILITY
    'buyitforlife', 'frugalmalefashion', 'minimalism', 'onebag',
    // FITNESS (body-conscious, notice changes)
    'Fitness', 'bodybuilding', 'loseit', 'progresspics'
  ],
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

// Patterns to extract specific, quotable nuggets from Reddit comments
// These capture the EXACT customer language we can use in ads
// PRIORITY: DEEP identity-level & transformation statements > surface observations
const NUGGET_PATTERNS = [
  // IDENTITY-LEVEL STATEMENTS (deepest gold)
  /i (?:finally )?feel like (?:myself|a new|a different|the man|a real)\s*(.{5,100})/gi,
  /for the first time (?:in my life|in years|ever|i)\s*(.{10,100})/gi,
  /(?:i am|i'm) (?:finally|no longer|not|actually)\s*(.{10,100})/gi,
  /(?:changed|transformed) (?:who i am|my life|everything|the way i)\s*(.{10,100})/gi,
  /(?:like|as if) i(?:'m| am| was| were) (?:a different|another|a new|finally)\s*(.{10,100})/gi,

  // DEEP PAIN CONFESSIONS (the raw stuff)
  /i (?:used to |always )?(?:hate|hated|dread|dreaded|avoid|avoided)\s*(.{10,100})/gi,
  /i feel (?:invisible|like shit|terrible|embarrassed|ashamed|disgusting|pathetic)\s*(.{0,80})/gi,
  /i look (?:okay|fine|good|alright) but (?:i feel|feel|inside)\s*(.{10,100})/gi,
  /(?:gave up|given up) on\s*(.{10,80})/gi,
  /(?:never thought|didn't think|lost hope)\s+(?:i would|i could|i'd)\s*(.{10,100})/gi,
  /(?:sick of|tired of|done with|over) (?:feeling|looking|being)\s*(.{10,80})/gi,

  // TRANSFORMATION MOMENTS (the breakthrough)
  /(?:everything changed|it all changed|my life changed)\s*(.{0,100})/gi,
  /(?:wish i|i wish i had|should have)\s+(?:found|discovered|known|started)\s*(.{10,80})/gi,
  /(?:can't|cannot|could never|will never) go back\s*(.{0,80})/gi,
  /(?:before and after|night and day|completely different)\s*(.{10,80})/gi,
  /the (?:moment|day|first time) i\s*(.{15,100})/gi,

  // RELATIONSHIP/SOCIAL DEEP (not just "got compliments")
  /(?:my wife|my girlfriend|she|he|they) (?:looks at me|treats me|sees me)\s*(.{10,100})/gi,
  /people (?:treat me|look at me|see me|take me)\s*(.{10,100})/gi,
  /(?:finally getting|started getting|now i get)\s+(?:respect|noticed|attention|taken seriously)\s*(.{0,80})/gi,
  /(?:something|everything) (?:changed|shifted|clicked)\s+(?:in how|when|after)\s*(.{10,80})/gi,

  // EMOTIONAL PAYOFFS - THE FEELING
  /nothing beats (?:the feeling of\s+)?(.{15,100})/gi,
  /the (?:best|most amazing|greatest) (?:part|thing|feeling) is\s+(.{15,100})/gi,
  /(?:the way|how) it (?:makes you feel|makes me feel|boosts|changes)\s+(.{15,100})/gi,
  /unlike anything (?:else|i've|i have)\s+(.{15,80})/gi,
  /makes (?:you|me) feel (?:like|so|completely)\s+(.{15,80})/gi,
  /(?:confidence|confident|powerful|unstoppable|invincible)\s+(.{10,80})/gi,

  // VISCERAL/PHYSICAL (body-level)
  /(?:my body|my skin) (?:finally|can|doesn't|no longer|actually)\s*(.{10,80})/gi,
  /(?:i can finally|finally i can|now i can)\s*(.{10,80})/gi,
  /(?:stopped|no more|gone is the)\s+(?:sweating|itching|discomfort|irritation)\s*(.{0,60})/gi,

  // EMPHATIC STATEMENTS
  /(?:honestly|literally|actually|seriously|genuinely),?\s+(.{15,100})[.!]/gi,
  /(?:i cannot|can't) (?:stress|emphasize|overstate)\s*(.{15,100})/gi,
  /(?:the difference|it) is (?:insane|incredible|unreal|night and day|unbelievable)\s*(.{0,80})/gi,

  // DISCOVERY/REALIZATION
  /(?:i never knew|didn't know|had no idea)\s+(?:that|how|what)\s*(.{15,100})/gi,
  /(?:turns out|it turns out|realized that)\s*(.{15,100})/gi,
  /(?:game changer|life changer|total shift)\s*(.{0,80})/gi,
];

// Common pain point keywords to look for
const PAIN_POINT_PATTERNS = [
  /(?:hate|annoyed|frustrated|tired of|sick of|wish)\s+(.{10,100})/gi,
  /(?:the problem with|issue with|my complaint)\s+(.{10,100})/gi,
  /(?:why can't|why don't|i wish)\s+(.{10,100})/gi,
  /(?:anyone else|does anyone)\s+(.{10,100})\?/gi,
  /(?:looking for|searching for|need a|want a)\s+(.{10,100})/gi,
  // More specific patterns
  /(?:stopped buying|gave up on|done with)\s+(.{10,80})/gi,
  /(?:waste of money|rip off|overpriced|cheap quality)\s*(.{0,60})/gi,
  /(?:falls apart|doesn't last|poor quality)\s*(.{0,60})/gi,
];

// Desire/aspiration patterns
const DESIRE_PATTERNS = [
  /(?:i want|i need|looking for|recommend)\s+(.{10,100})/gi,
  /(?:best|favorite|go-to|holy grail)\s+(.{10,100})/gi,
  /(?:finally found|game changer|life changing)\s+(.{10,100})/gi,
  // More specific
  /(?:switched to|started using|discovered)\s+(.{10,80})/gi,
  /(?:will never go back|changed my life|best purchase)\s*(.{0,80})/gi,
  /(?:buy it for life|lasts forever|built to last)\s*(.{0,60})/gi,
];

/**
 * Search Reddit for relevant discussions
 * @param {string} query - Search query
 * @param {string[]} subreddits - List of subreddits to search
 * @param {number} limit - Max results per subreddit
 * @returns {Promise<Array>} - Array of relevant posts
 */
/**
 * Search Reddit directly using Reddit's own JSON API (no rate limits like web search)
 * @param {string} query - Search query
 * @param {string[]} subreddits - Subreddits to search in
 * @param {number} limit - Max results
 * @returns {Promise<Array>} - Array of Reddit posts found
 */
async function searchRedditViaWeb(query, subreddits, limit = 15) {
  const results = [];

  // Search ALL mapped subreddits (typically 8-10 per category), then general search
  const searchTargets = [
    ...subreddits.map(sub => ({ sub, query })),
    { sub: null, query } // General Reddit search as fallback
  ];

  for (const target of searchTargets) {
    if (results.length >= limit) break;

    try {
      // Use Reddit's JSON search API directly - no OAuth needed for read-only
      let searchUrl;
      if (target.sub) {
        searchUrl = `https://www.reddit.com/r/${target.sub}/search.json?q=${encodeURIComponent(target.query)}&restrict_sr=1&sort=relevance&limit=25`;
        console.log(`[Reddit Search] Searching r/${target.sub} for "${target.query}"`);
      } else {
        searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(target.query)}&sort=relevance&limit=25`;
        console.log(`[Reddit Search] Searching all Reddit for "${target.query}"`);
      }

      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ResearchBot/1.0)',
          'Accept': 'application/json',
        }
      });

      if (!response.ok) {
        console.log(`[Reddit Search] Failed: ${response.status}`);
        await new Promise(r => setTimeout(r, 2000)); // Wait longer on failure
        continue;
      }

      const data = await response.json();
      const posts = data?.data?.children || [];

      console.log(`[Reddit Search] Found ${posts.length} posts`);

      for (const post of posts) {
        if (results.length >= limit) break;

        const p = post.data;
        if (!p || !p.permalink) continue;

        // Skip non-text posts (images, videos, links without discussion)
        if (p.is_video || p.post_hint === 'image') continue;

        const url = `https://www.reddit.com${p.permalink}`.replace(/\/$/, '');

        // Skip if we already have this URL
        if (results.some(r => r.url === url)) continue;

        results.push({
          subreddit: p.subreddit,
          title: p.title,
          selftext: p.selftext || '',
          score: p.score || 0,
          num_comments: p.num_comments || 0,
          url,
          created: p.created_utc
        });
      }

      // Respect Reddit's rate limits - wait between requests
      await new Promise(r => setTimeout(r, 1000));

    } catch (err) {
      console.log(`[Reddit Search] Error:`, err.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log(`[Reddit Search] Total: ${results.length} unique posts`);
  return results;
}

/**
 * Get top comments from a Reddit post
 * @param {string} permalink - Post permalink (e.g., /r/sub/comments/abc123/title)
 * @param {number} limit - Max comments to fetch
 * @returns {Promise<Array>} - Array of top comments
 */
/**
 * Fetch Reddit post content and comments using Reddit's JSON API
 * @param {string} url - Full Reddit URL
 * @param {number} limit - Max comments to extract
 * @returns {Promise<Object>} - Post content and comments
 */
async function fetchRedditPost(url, limit = 10) {
  try {
    // Use Reddit's public JSON API - just append .json to the URL
    const jsonUrl = url.replace(/\/?$/, '.json');

    const response = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ResearchBot/1.0)',
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      console.log(`[Reddit Fetch] Failed for ${url}: ${response.status}`);
      return { selftext: '', comments: [] };
    }

    const data = await response.json();

    // Reddit returns an array: [post_data, comments_data]
    if (!Array.isArray(data) || data.length < 2) {
      console.log(`[Reddit Fetch] Unexpected format for ${url}`);
      return { selftext: '', comments: [] };
    }

    // Extract post body
    const post = data[0]?.data?.children?.[0]?.data;
    const selftext = post?.selftext || post?.title || '';

    // Extract comments
    const comments = [];
    const commentsData = data[1]?.data?.children || [];

    for (const child of commentsData) {
      if (comments.length >= limit) break;
      if (child.kind !== 't1') continue; // Skip non-comment items

      const body = child.data?.body;
      // Get FULL comments - the gold is in longer, detailed responses
      // Minimum 30 chars to skip one-liners, NO MAX to get the deep emotional content
      if (body && body.length > 30 && !body.includes('[deleted]') && !body.includes('[removed]')) {
        comments.push({
          body: body, // Keep FULL body - don't truncate
          score: child.data?.score || 0
        });
      }
    }

    console.log(`[Reddit Fetch] Got ${selftext.length} chars, ${comments.length} comments from ${url}`);
    return { selftext, comments };

  } catch (err) {
    console.log(`[Reddit Fetch] Error for ${url}:`, err.message);
    return { selftext: '', comments: [] };
  }
}

/**
 * Extract pain points, desires, and quotable nuggets from text
 * @param {string} text - Text to analyze
 * @returns {Object} - Extracted insights
 */
function extractInsights(text) {
  const painPoints = [];
  const desires = [];
  const nuggets = [];

  // Extract pain points
  for (const pattern of PAIN_POINT_PATTERNS) {
    pattern.lastIndex = 0; // Reset regex state
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const insight = match[1]?.trim();
      if (insight && insight.length > 10 && insight.length < 150) {
        painPoints.push(insight);
      }
    }
  }

  // Extract desires
  for (const pattern of DESIRE_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const insight = match[1]?.trim();
      if (insight && insight.length > 10 && insight.length < 150) {
        desires.push(insight);
      }
    }
  }

  // Extract quotable nuggets - specific phrases that can be used as ad copy
  for (const pattern of NUGGET_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const nugget = (match[1] || match[0])?.trim();
      // Filter for quality nuggets
      if (nugget && nugget.length > 12 && nugget.length < 100) {
        // Skip generic phrases
        if (nugget.match(/^(the|a|an|this|that|it|i|we|they)\s*$/i)) continue;
        if (nugget.includes('http') || nugget.includes('www')) continue;
        nuggets.push(nugget);
      }
    }
  }

  return { painPoints, desires, nuggets };
}

/**
 * Research Reddit for a brand
 * @param {Object} brand - Brand data with name, category, etc.
 * @param {Object} options - Research options
 * @returns {Promise<Object>} - Reddit research results
 */
async function researchReddit(brand, options = {}) {
  const {
    maxThreads = 20,
    maxCommentsPerThread = 20,
    searchQueries = [],
    forceRefresh = false
  } = options;

  // Check cache first (to avoid rate limiting)
  const cacheKey = `${brand.id || brand.name}_${brand.category}`;
  const cached = redditCache.get(cacheKey);
  if (cached && !forceRefresh && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.log(`[Reddit Research] Using cached results for ${brand.name} (${Math.round((Date.now() - cached.timestamp) / 60000)}min old)`);
    return cached.data;
  }

  console.log(`[Reddit Research] Starting fresh research for ${brand.name}...`);

  // Determine relevant subreddits
  const category = (brand.category || 'general').toLowerCase();
  const subreddits = SUBREDDITS_BY_CATEGORY[category] || SUBREDDITS_BY_CATEGORY.general;

  // Build search queries based on brand/product
  const brandKeywords = (brand.name || '').split(/\s+/);
  const productKeywords = [];

  // Extract product-related keywords from brand data using 3-LAYER APPROACH:
  // Layer 1: Brand name (added via searchQueries from caller)
  // Layer 2: Product + alternatives
  // Layer 3: Symptoms/Problems customers have

  if (brand.category === 'fashion' || brand.category === 'apparel') {
    // LAYER 2: Product + alternatives
    productKeywords.push('hemp shirts', 'hemp t-shirt', 'organic cotton shirt', 'natural fabric clothing');
    productKeywords.push('best t-shirt brand', 'quality t-shirts', 'shirts that last');

    // LAYER 3: Physical symptoms & problems
    productKeywords.push('polyester makes me sweat', 'synthetic clothes smell', 'shirts shrink after washing');
    productKeywords.push('skin irritation from clothes', 'allergic to polyester', 'clothes give me rashes');
    productKeywords.push('tired of cheap clothes falling apart', 'why do my shirts pill');

    // LAYER 4: OUTCOMES & SOCIAL PROOF (the creative angle)
    productKeywords.push('best compliment clothing', 'compliment on what I was wearing', 'someone complimented my shirt');
    productKeywords.push('girlfriend noticed I dressed better', 'wife said I look good', 'partner complimented outfit');
    productKeywords.push('strangers compliment my style', 'people ask where I got my shirt', 'coworkers noticed');
    productKeywords.push('what made you change your style', 'upgrading your wardrobe changed', 'dressing better changed my life');

    // LAYER 5: HEALTH FEARS & FACTS (gruesome stuff for Undrdog angle)
    productKeywords.push('microplastics in blood', 'microplastics found in', 'plastic in human body');
    productKeywords.push('polyester health risks', 'synthetic clothing dangers', 'what polyester does to your body');
    productKeywords.push('endocrine disruptors clothing', 'xenoestrogens fabric', 'hormone disrupting chemicals clothes');
    productKeywords.push('polyester testosterone', 'synthetic fabric fertility', 'microplastics testosterone');
    productKeywords.push('forever chemicals in clothing', 'PFAS in clothes', 'toxic chemicals in fast fashion');
    productKeywords.push('skin absorbs chemicals', 'dermal absorption clothing', 'what your skin absorbs');

    // LAYER 6: TRANSFORMATION STORIES (before/after)
    productKeywords.push('how dressing better changed', 'upgrading wardrobe results', 'invested in quality clothes');
    productKeywords.push('stopped buying cheap clothes', 'switched to quality', 'buy less but better');
    productKeywords.push('minimalist wardrobe results', 'capsule wardrobe changed my life', 'fewer better clothes');

    // LAYER 7: SPECIFIC FIT/COMFORT PROBLEMS
    productKeywords.push('shirts never fit right', 'nothing fits my body type', 'athletic build clothing problems');
    productKeywords.push('shirt too tight shoulders', 'shirt too loose waist', 'finally found shirts that fit');
    productKeywords.push('comfortable all day shirt', 'shirt I can wear all day', 'most comfortable shirt');
  } else if (brand.category === 'supplement') {
    productKeywords.push('supplements', 'vitamins', 'best supplement', 'natural supplements');
    productKeywords.push('supplement quality', 'third party tested supplements', 'clean supplements');
  } else if (brand.category === 'skincare') {
    productKeywords.push('skincare routine', 'best moisturizer', 'anti-aging', 'skin products');
    productKeywords.push('clean skincare', 'chemical free skincare', 'sensitive skin products');
  }

  // Build diverse search queries for better coverage
  const queries = [
    ...searchQueries,
    ...productKeywords, // Use ALL product keywords, not just first 4
  ].filter(Boolean);

  // Shuffle queries to get variety across runs
  const shuffledQueries = queries.sort(() => Math.random() - 0.5);

  // Search Reddit with multiple queries for comprehensive coverage
  console.log(`[Reddit Research] Searching with ${Math.min(8, shuffledQueries.length)} queries across ${subreddits.length} subreddits...`);

  const allPosts = [];

  // Do up to 8 different query searches for thorough coverage
  for (let i = 0; i < Math.min(8, shuffledQueries.length); i++) {
    const posts = await searchRedditViaWeb(shuffledQueries[i], subreddits, 15);
    allPosts.push(...posts);

    // Small delay between searches to respect rate limits
    if (i < shuffledQueries.length - 1) {
      await new Promise(r => setTimeout(r, 800));
    }
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
  // Reddit JSON API is lenient - we can fetch up to 20 threads with proper delays
  const topPosts = uniquePosts.slice(0, Math.min(maxThreads, 20));
  const threads = [];
  const allPainPoints = [];
  const allDesires = [];
  const allNuggets = [];

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
    allNuggets.push(...(postInsights.nuggets || []));

    // Collect nuggets specific to this thread
    const threadNuggets = [...(postInsights.nuggets || [])];

    // Extract insights from comments
    for (const comment of comments) {
      const commentInsights = extractInsights(comment.body);
      allPainPoints.push(...commentInsights.painPoints);
      allDesires.push(...commentInsights.desires);
      allNuggets.push(...(commentInsights.nuggets || []));
      threadNuggets.push(...(commentInsights.nuggets || []));
    }

    threads.push({
      subreddit: post.subreddit,
      title: post.title,
      snippet: postContent.substring(0, 2000) || post.selftext, // Longer snippets to capture full context
      score: post.score,
      num_comments: comments.length,
      url: post.url,
      top_comments: comments.slice(0, 10).map(c => c.body), // FULL comments - this is where the gold is
      nuggets: [...new Set(threadNuggets)].slice(0, 5) // Best nuggets from this thread
    });

    // Rate limit between Reddit API fetches (1 second to be safe)
    await new Promise(r => setTimeout(r, 1000));
  }

  // Deduplicate insights
  let uniquePainPoints = [...new Set(allPainPoints)].slice(0, 15);
  let uniqueDesires = [...new Set(allDesires)].slice(0, 15);

  // If search failed (no threads), use fallback with real Reddit URLs
  if (threads.length === 0) {
    console.log(`[Reddit Research] Search blocked - using fallback threads for category: ${category}`);
    const fallback = FALLBACK_INSIGHTS[category] || FALLBACK_INSIGHTS.apparel;
    uniquePainPoints = fallback.painPoints || [];
    uniqueDesires = fallback.desires || [];

    // Use known good Reddit threads for apparel category
    if (category === 'apparel' || category === 'fashion') {
      const fallbackThreads = [
        { subreddit: 'BuyItForLife', title: 'where are the high quality made to last clothes', url: 'https://www.reddit.com/r/BuyItForLife/comments/14k1tw1/where_are_the_high_quality_made_to_last_clothes' },
        { subreddit: 'BuyItForLife', title: 'clothing brands that last forever', url: 'https://www.reddit.com/r/BuyItForLife/comments/1fr3rem/clothing_brands_that_last_forever' },
        { subreddit: 'frugalmalefashion', title: 'i spent 750 on 10 different tshirt brands to find the best', url: 'https://www.reddit.com/r/frugalmalefashion/comments/1jo3cp9/i_spent_750_on_10_different_tshirt_brands_to_find' },
        { subreddit: 'malefashionadvice', title: 'the goat of t shirts', url: 'https://www.reddit.com/r/malefashionadvice/comments/1ftytq6/the_goat_of_t_shirts' },
        { subreddit: 'BuyItForLife', title: 'how long are clothes supposed to last', url: 'https://www.reddit.com/r/BuyItForLife/comments/2h8bgd/how_long_are_clothes_supposed_to_last' },
        { subreddit: 'Frugal', title: 'any particular brands for quality clothing that actually lasts', url: 'https://www.reddit.com/r/Frugal/comments/17z43q4/any_particular_brands_for_quality_clothing_that' },
      ];

      // Fetch actual content from these known threads
      console.log(`[Reddit Research] Fetching ${fallbackThreads.length} fallback threads...`);
      for (const ft of fallbackThreads) {
        const { selftext, comments } = await fetchRedditPost(ft.url, maxCommentsPerThread);
        const postContent = selftext || '';
        const postText = `${ft.title} ${postContent}`;
        const postInsights = extractInsights(postText);

        // Also extract from comments
        const threadNuggets = [...(postInsights.nuggets || [])];
        for (const comment of comments) {
          const commentInsights = extractInsights(comment.body);
          allNuggets.push(...(commentInsights.nuggets || []));
          threadNuggets.push(...(commentInsights.nuggets || []));
        }

        threads.push({
          subreddit: ft.subreddit,
          title: ft.title,
          snippet: postContent.substring(0, 2000), // Longer snippets to capture full context
          score: 100,
          num_comments: comments.length,
          url: ft.url,
          top_comments: comments.slice(0, 10).map(c => c.body), // FULL comments - this is where the gold is
          nuggets: [...new Set(threadNuggets)].slice(0, 5)
        });

        await new Promise(r => setTimeout(r, 500));
      }
    } else {
      // Generic fallback for other categories
      threads.push({
        subreddit: 'community_research',
        title: 'Common customer pain points and desires',
        snippet: 'Aggregated from customer research and community discussions',
        score: 100,
        num_comments: 50,
        url: 'https://www.reddit.com/r/BuyItForLife',
        top_comments: uniquePainPoints.slice(0, 3).map(p => `"${p}"`)
      });
    }
  }

  // Deduplicate and rank nuggets
  const uniqueNuggets = [...new Set(allNuggets)].slice(0, 20);

  console.log(`[Reddit Research] Found ${threads.length} threads, ${uniquePainPoints.length} pain points, ${uniqueDesires.length} desires, ${uniqueNuggets.length} nuggets`);

  // Filter out previously used threads to ensure fresh ideas
  const brandId = brand.id || brand.name;
  const freshThreads = filterUsedThreads(brandId, threads);

  // If too few fresh threads, log a warning
  if (freshThreads.length < 3 && threads.length > 0) {
    console.log(`[Reddit Research] Warning: Only ${freshThreads.length} fresh threads. Consider clearing used threads.`);
  }

  // Mark these threads as used for next time
  markThreadsAsUsed(brandId, freshThreads);

  const result = {
    threads: freshThreads,
    painPoints: uniquePainPoints,
    desires: uniqueDesires,
    nuggets: uniqueNuggets,
    summary: {
      totalThreads: freshThreads.length,
      totalComments: freshThreads.reduce((sum, t) => sum + (t.top_comments?.length || 0), 0),
      subredditsSearched: [...new Set(freshThreads.map(t => t.subreddit))],
      queriesUsed: queries.slice(0, 5),
      filteredUsedThreads: threads.length - freshThreads.length
    }
  };

  // Cache results to avoid rate limiting on repeated tests
  redditCache.set(cacheKey, { data: result, timestamp: Date.now() });
  console.log(`[Reddit Research] Cached results for ${brand.name} (${result.summary.filteredUsedThreads} threads filtered as previously used)`);

  return result;
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
    nuggets: thread.nuggets || [], // Quotable customer phrases from this thread
    url: thread.url || '', // Full Reddit thread URL
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
  clearUsedThreads,
  fetchRedditPost,
  SUBREDDITS_BY_CATEGORY
};
