/**
 * Tests for Ad Performance Classifier
 * Tests classification logic without database dependency
 */

const { classifyAd } = require('../../src/facebook/analysis/classifier');

function assert(condition, msg) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
  console.log(`  PASS: ${msg}`);
}

function runTests() {
  console.log('\n=== Classifier Tests ===\n');

  const benchmarks = {
    medianSpend: 1000,
    medianCpa: 25,
    avgCtr: 2.0,
    totalAds: 50,
  };

  // Test 1: Winner — high spend, low CPA
  {
    const ad = { spend: 500, cpa: 15, ctr: 3.0, purchases: 30 };
    const result = classifyAd(ad, benchmarks);
    assert(result === 'winner', `Winner: spend $500 > threshold $100, CPA $15 < median $25 → ${result}`);
  }

  // Test 2: Scalable — high spend, high CPA
  {
    const ad = { spend: 500, cpa: 30, ctr: 2.0, purchases: 15 };
    const result = classifyAd(ad, benchmarks);
    assert(result === 'scalable', `Scalable: spend $500 > threshold, CPA $30 > median $25 → ${result}`);
  }

  // Test 3: Efficient — low spend, low CPA
  {
    const ad = { spend: 80, cpa: 15, ctr: 4.0, purchases: 5 };
    const result = classifyAd(ad, benchmarks);
    assert(result === 'efficient', `Efficient: spend $80 < threshold $100, CPA $15 < median $25 → ${result}`);
  }

  // Test 4: Loser — very high CPA
  {
    const ad = { spend: 80, cpa: 40, ctr: 0.5, purchases: 5 };
    const result = classifyAd(ad, benchmarks);
    assert(result === 'loser', `Loser: CPA $40 > median*1.5 $37.5 → ${result}`);
  }

  // Test 5: Insufficient — not enough purchases
  {
    const ad = { spend: 30, cpa: 15, ctr: 2.0, purchases: 2 };
    const result = classifyAd(ad, benchmarks);
    assert(result === 'insufficient', `Insufficient: purchases 2 < 5 → ${result}`);
  }

  // Test 6: Insufficient — not enough spend
  {
    const ad = { spend: 20, cpa: 10, ctr: 3.0, purchases: 10 };
    const result = classifyAd(ad, benchmarks);
    assert(result === 'insufficient', `Insufficient: spend $20 < $50 → ${result}`);
  }

  // Test 7: Fatigued — CTR declining + CPA rising above threshold
  {
    const ad = { spend: 500, cpa: 33, ctr: 1.0, purchases: 15 };
    const trendData = { ctrTrend: 'declining', recentCtr: 1.0, previousCtr: 2.5 };
    const result = classifyAd(ad, benchmarks, trendData);
    assert(result === 'fatigued', `Fatigued: CTR declining + CPA $33 > median*1.3 $32.5 → ${result}`);
  }

  // Test 8: Not fatigued if CTR is stable
  {
    const ad = { spend: 500, cpa: 33, ctr: 2.0, purchases: 15 };
    const trendData = { ctrTrend: 'stable', recentCtr: 2.0, previousCtr: 2.1 };
    const result = classifyAd(ad, benchmarks, trendData);
    assert(result !== 'fatigued', `Not fatigued with stable CTR → ${result}`);
  }

  // Test 9: Winner even at exactly the spend threshold
  {
    const ad = { spend: 101, cpa: 20, ctr: 2.5, purchases: 5 };
    const result = classifyAd(ad, benchmarks);
    assert(result === 'winner', `Winner at spend=$101 > threshold=$100, low CPA → ${result}`);
  }

  // Test 10: Edge case — zero median CPA
  {
    const zeroBench = { medianSpend: 100, medianCpa: 0, avgCtr: 2.0, totalAds: 5 };
    const ad = { spend: 200, cpa: 10, ctr: 2.0, purchases: 20 };
    const result = classifyAd(ad, zeroBench);
    assert(result === 'insufficient', `Zero median CPA → insufficient → ${result}`);
  }

  console.log('\n=== All Classifier Tests Passed! ===\n');
}

runTests();
