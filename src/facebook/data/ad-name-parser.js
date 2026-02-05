/**
 * MTRX Ad Naming Convention Parser
 * Format: MTRX_{BRAND}{BATCH}_{CS}_{AWARENESS}_{ANGLETYPE}{NUM}_{AUDIENCE}_{CREATOR}_{EDITOR}_{VERSION}
 *
 * Example: MTRX_ACME01_CS1_TOF_PAIN2_BROAD_JOHN_MIKE_V1
 *
 * Returns null for non-MTRX names (flagged as 'unparsed')
 */

// Pattern: MTRX_{brand+batch}_{copyStyle}_{awareness}_{angleType+num}_{audience}_{creator}_{editor}_{version}
const MTRX_REGEX = /^MTRX_([A-Z]+)(\d+)_([A-Z0-9]+)_([A-Z]+)_([A-Z]+)(\d+)_([A-Z0-9]+)_([A-Z]+)_([A-Z]+)_V(\d+)$/i;

/**
 * Parse an MTRX-formatted ad name
 * @param {string} adName
 * @returns {object|null} Parsed fields or null if not MTRX format
 */
function parse(adName) {
  if (!adName || typeof adName !== 'string') return null;

  const match = adName.trim().match(MTRX_REGEX);
  if (!match) return null;

  return {
    brand: match[1].toUpperCase(),
    batch: match[2],
    copyStyle: match[3].toUpperCase(),
    awareness: match[4].toUpperCase(),
    angleType: match[5].toUpperCase(),
    angleNum: match[6],
    audience: match[7].toUpperCase(),
    creator: match[8].toUpperCase(),
    editor: match[9].toUpperCase(),
    version: match[10],
  };
}

/**
 * Check if an ad name follows MTRX convention
 * @param {string} adName
 * @returns {boolean}
 */
function isMtrxFormat(adName) {
  return parse(adName) !== null;
}

/**
 * Build a human-readable summary from parsed fields
 * @param {object} parsed - Output from parse()
 * @returns {string}
 */
function summarize(parsed) {
  if (!parsed) return 'Non-MTRX ad';
  return `${parsed.brand} B${parsed.batch} | ${parsed.awareness} | ${parsed.angleType}#${parsed.angleNum} | ${parsed.audience} | by ${parsed.creator}`;
}

module.exports = { parse, isMtrxFormat, summarize };
