/**
 * Tests for MTRX Ad Name Parser
 */

const { parse, isMtrxFormat, summarize } = require('../../src/facebook/data/ad-name-parser');

function assert(condition, msg) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  console.log(`  PASS: ${msg}`);
}

function runTests() {
  console.log('\n=== Ad Name Parser Tests ===\n');

  // Test 1: Valid MTRX format
  {
    const result = parse('MTRX_ACME01_CS1_TOF_PAIN2_BROAD_JOHN_MIKE_V1');
    assert(result !== null, 'Parses valid MTRX name');
    assert(result.brand === 'ACME', 'Extracts brand');
    assert(result.batch === '01', 'Extracts batch');
    assert(result.copyStyle === 'CS1', 'Extracts copy style');
    assert(result.awareness === 'TOF', 'Extracts awareness');
    assert(result.angleType === 'PAIN', 'Extracts angle type');
    assert(result.angleNum === '2', 'Extracts angle number');
    assert(result.audience === 'BROAD', 'Extracts audience');
    assert(result.creator === 'JOHN', 'Extracts creator');
    assert(result.editor === 'MIKE', 'Extracts editor');
    assert(result.version === '1', 'Extracts version');
  }

  // Test 2: Another valid format
  {
    const result = parse('MTRX_SKINCO05_CS3_BOF_BENEFIT1_LOOKALIKE_SARAH_DAN_V3');
    assert(result !== null, 'Parses another valid MTRX name');
    assert(result.brand === 'SKINCO', 'Extracts multi-char brand');
    assert(result.batch === '05', 'Extracts batch 05');
    assert(result.awareness === 'BOF', 'Extracts BOF awareness');
    assert(result.angleType === 'BENEFIT', 'Extracts BENEFIT angle');
    assert(result.audience === 'LOOKALIKE', 'Extracts LOOKALIKE audience');
    assert(result.version === '3', 'Extracts version 3');
  }

  // Test 3: Case insensitive
  {
    const result = parse('mtrx_acme01_cs1_tof_pain2_broad_john_mike_v1');
    assert(result !== null, 'Case insensitive parsing');
    assert(result.brand === 'ACME', 'Normalizes brand to uppercase');
  }

  // Test 4: Non-MTRX names return null
  {
    assert(parse('My Cool Ad') === null, 'Non-MTRX name returns null');
    assert(parse('Campaign 1 - Ad Group 2') === null, 'Standard FB name returns null');
    assert(parse('') === null, 'Empty string returns null');
    assert(parse(null) === null, 'null returns null');
    assert(parse(undefined) === null, 'undefined returns null');
  }

  // Test 5: isMtrxFormat
  {
    assert(isMtrxFormat('MTRX_ACME01_CS1_TOF_PAIN2_BROAD_JOHN_MIKE_V1') === true, 'isMtrxFormat true for valid');
    assert(isMtrxFormat('Random Ad Name') === false, 'isMtrxFormat false for invalid');
  }

  // Test 6: summarize
  {
    const parsed = parse('MTRX_ACME01_CS1_TOF_PAIN2_BROAD_JOHN_MIKE_V1');
    const summary = summarize(parsed);
    assert(summary.includes('ACME'), 'Summary includes brand');
    assert(summary.includes('TOF'), 'Summary includes awareness');
    assert(summary.includes('PAIN'), 'Summary includes angle');
    assert(summarize(null) === 'Non-MTRX ad', 'Null parsed returns default');
  }

  // Test 7: Incomplete MTRX name
  {
    assert(parse('MTRX_ACME01_CS1_TOF') === null, 'Incomplete MTRX name returns null');
    assert(parse('MTRX_') === null, 'MTRX_ alone returns null');
  }

  console.log('\n=== All Parser Tests Passed! ===\n');
}

runTests();
