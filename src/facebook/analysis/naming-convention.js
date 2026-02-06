/**
 * Ad Naming Convention Generator
 * Creates structured names for test ads to enable tracking and feedback loops
 *
 * Format: MTRX_T{ID}_{DATE}_{FORMAT}_{HOOK_SHORT}_{RATIO}
 * Example: MTRX_T001_0206_HERO_ExpertVsFounder_4x5
 */

/**
 * Format abbreviations for ad names
 */
const FORMAT_CODES = {
  'product_hero': 'HERO',
  'meme': 'MEME',
  'aesthetic': 'AEST',
  'illustrated': 'ILLUST',
  'vintage': 'VINT',
  'ugc': 'UGC',
  'comparison': 'COMP',
};

/**
 * Convert aspect ratio to short code
 */
function ratioCode(aspectRatio) {
  if (aspectRatio === '4:5') return '4x5';
  if (aspectRatio === '9:16') return '9x16';
  if (aspectRatio === '1:1') return '1x1';
  return aspectRatio.replace(':', 'x');
}

/**
 * Create a short hook summary (max 20 chars, no spaces)
 * @param {string} hook - The full hook text
 * @param {string} title - The test title (used if hook is empty)
 * @returns {string} Short hook code
 */
function createHookCode(hook, title) {
  const text = hook || title || 'Test';

  // Extract key words from the text
  const words = text
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
    .split(/\s+/)
    .filter(w => w.length > 2) // Skip short words
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .slice(0, 3); // Max 3 words

  let code = words.join('');

  // If still too long, truncate
  if (code.length > 20) {
    code = code.substring(0, 20);
  }

  // If empty, use generic
  if (!code) {
    code = 'Creative';
  }

  return code;
}

/**
 * Generate a unique ad name
 * @param {Object} params
 * @param {number|string} params.campaignId - The campaign/test ID
 * @param {string} params.format - The format type (product_hero, meme, etc.)
 * @param {string} params.aspectRatio - The aspect ratio (4:5, 9:16)
 * @param {string} params.hook - The ad hook/headline
 * @param {string} params.title - The test title
 * @param {Date} params.date - Optional date (defaults to now)
 * @returns {string} The structured ad name
 */
function generateAdName({ campaignId, format, aspectRatio, hook, title, date = new Date() }) {
  // Format campaign ID with padding
  const campaignCode = String(campaignId || 0).padStart(3, '0');

  // Format date as MMDD
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateCode = `${month}${day}`;

  // Get format code
  const formatCode = FORMAT_CODES[format] || format?.toUpperCase().substring(0, 4) || 'STAT';

  // Get hook code
  const hookCode = createHookCode(hook, title);

  // Get ratio code
  const ratio = ratioCode(aspectRatio || '4:5');

  // Build the name
  return `MTRX_T${campaignCode}_${dateCode}_${formatCode}_${hookCode}_${ratio}`;
}

/**
 * Generate ad names for a batch of statics
 * @param {Object} params
 * @param {number|string} params.campaignId - The campaign/test ID
 * @param {Array} params.statics - Array of static objects with format, aspectRatio
 * @param {string} params.hook - The ad hook
 * @param {string} params.title - The test title
 * @returns {Array} Statics with adName added
 */
function addNamesToStatics({ campaignId, statics, hook, title }) {
  const date = new Date();

  return statics.map((staticItem, index) => ({
    ...staticItem,
    adName: generateAdName({
      campaignId: campaignId || index + 1,
      format: staticItem.format,
      aspectRatio: staticItem.aspectRatio,
      hook,
      title,
      date,
    }),
  }));
}

/**
 * Parse an ad name back into its components
 * @param {string} adName - The structured ad name
 * @returns {Object|null} Parsed components or null if invalid
 */
function parseAdName(adName) {
  const match = adName.match(/^MTRX_T(\d+)_(\d{4})_([A-Z]+)_([^_]+)_(\dx\d+)$/);

  if (!match) return null;

  const [, campaignId, dateCode, formatCode, hookCode, ratio] = match;

  // Reverse lookup format
  const format = Object.entries(FORMAT_CODES).find(([, code]) => code === formatCode)?.[0] || formatCode.toLowerCase();

  return {
    campaignId: parseInt(campaignId, 10),
    dateCode,
    format,
    formatCode,
    hookCode,
    aspectRatio: ratio.replace('x', ':'),
  };
}

/**
 * Check if an ad name matches a specific campaign
 * @param {string} adName - The ad name to check
 * @param {number|string} campaignId - The campaign ID to match
 * @returns {boolean} True if matches
 */
function isFromCampaign(adName, campaignId) {
  const parsed = parseAdName(adName);
  return parsed?.campaignId === parseInt(campaignId, 10);
}

/**
 * Generate a descriptive filename for saving
 * @param {string} adName - The structured ad name
 * @param {string} extension - File extension (default: 'png')
 * @returns {string} Filename
 */
function generateFilename(adName, extension = 'png') {
  return `${adName}.${extension}`;
}

module.exports = {
  generateAdName,
  addNamesToStatics,
  parseAdName,
  isFromCampaign,
  generateFilename,
  FORMAT_CODES,
};
