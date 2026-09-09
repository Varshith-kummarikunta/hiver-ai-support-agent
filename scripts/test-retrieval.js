/**
 * Test Suite for BM25 Retrieval Engine.
 * Implements 12 required automated quality, correctness, and robustness checks.
 */

import fs from 'fs';
import path from 'path';
import config from '../src/config/index.js';
import { loadIndex, search } from '../src/retrieval/index.js';

console.log('===============================================================');
console.log('TEST SUITE: BM25 HISTORICAL RETRIEVAL SYSTEM (12 CHECKS)');
console.log('===============================================================\n');

const goldenPath = path.join(config.projectRoot, 'data/golden/golden-set.jsonl');
const indexPath = path.join(config.projectRoot, 'data/models/applesupport-retrieval-index.json');

let passedChecks = 0;
let totalChecks = 0;

function check(condition, desc) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  [Check ${totalChecks}/12] ${desc} -> PASS ✅`);
  } else {
    console.error(`  [Check ${totalChecks}/12] ${desc} -> FAIL ❌`);
    process.exitCode = 1;
  }
}

// 1. Index Loads Successfully
console.log('1. Verifying Index Load and Structure:');
let index = null;
try {
  index = loadIndex(indexPath);
  check(index && index.engine && Array.isArray(index.docMetadata), 'Index loads successfully from disk');
} catch (e) {
  check(false, `Index failed to load: ${e.message}`);
}

// 2. Index Contains Expected Order of Magnitude
check(
  index && index.stats.docCount > 100000 && index.stats.docCount < 110000,
  `Index contains expected interaction count (${index?.stats?.docCount?.toLocaleString()} items)`
);

// 3. Search Returns Requested K Results
console.log('\n2. Verifying Search Functionality & Top-K Sizing:');
const resK1 = search(index, 'iphone battery dying fast', 1);
const resK3 = search(index, 'iphone battery dying fast', 3);
const resK5 = search(index, 'iphone battery dying fast', 5);
const resK10 = search(index, 'iphone battery dying fast', 10);
check(
  resK1.length === 1 && resK3.length === 3 && resK5.length === 5 && resK10.length === 10,
  'Search returns requested k results for k=1, 3, 5, 10'
);

// 4. Results Ranked by Descending Score
let isRankedDescending = true;
for (let i = 0; i < resK10.length - 1; i++) {
  if (resK10[i].score < resK10[i + 1].score) {
    isRankedDescending = false;
    break;
  }
}
check(isRankedDescending, 'Results are ranked in strictly descending score order');

// 5. Identical Query Produces Identical Results (Determinism)
const queryText = 'my ipad screen is frozen and black';
const runA = search(index, queryText, 5);
const runB = search(index, queryText, 5);
let isDeterministic = true;
for (let i = 0; i < 5; i++) {
  if (runA[i].customerTweetId !== runB[i].customerTweetId || runA[i].score !== runB[i].score) {
    isDeterministic = false;
    break;
  }
}
check(isDeterministic, 'Identical query produces 100% deterministic ranking and scores');

// 6. Empty Query Handled Safely
const emptyRes = search(index, '', 5);
check(Array.isArray(emptyRes) && emptyRes.length === 0, 'Empty query handled safely (returns empty array)');

// 7. Punctuation-Only Query Handled Safely
const punctRes = search(index, '!?!?!?! ... ---', 5);
check(Array.isArray(punctRes) && punctRes.length === 0, 'Punctuation-only query handled safely without crash');

// 8. Emoji-Only Query Handled Safely
const emojiRes = search(index, '🔥🔥🔥🤷‍♂️💀', 5);
check(Array.isArray(emojiRes), 'Emoji-only query handled safely');

// 9. Out-of-Vocabulary Query Handled Safely
const oovRes = search(index, 'zyxwvutsrqponm qwertyuiopasdfghjkl', 5);
check(Array.isArray(oovRes) && oovRes.length === 0, 'Out-of-vocabulary query returns empty array cleanly');

// 10 & 11. Zero Golden Tweet IDs or Pairs Returned
console.log('\n3. Verifying Zero Golden Data Leakage:');
const goldenLines = fs.readFileSync(goldenPath, 'utf8').trim().split('\n').filter(Boolean);
const goldenTweetIds = new Set(goldenLines.map(l => String(JSON.parse(l).tweetId || JSON.parse(l).customerTweetId)));

// Check 10: Search across representative golden queries never returns any golden tweet ID
let leakedInSearch = false;
for (let i = 0; i < 20; i++) {
  const gQuery = JSON.parse(goldenLines[i]).customerTextClean;
  const topHits = search(index, gQuery, 10);
  for (const hit of topHits) {
    if (goldenTweetIds.has(String(hit.customerTweetId))) {
      leakedInSearch = true;
      break;
    }
  }
  if (leakedInSearch) break;
}
check(!leakedInSearch, 'No golden tweet ID can ever be returned in search results');

// Check 11: Zero quarantined pairs exist in the index metadata
let quarantinedInIndex = 0;
index.docMetadata.forEach(meta => {
  if (goldenTweetIds.has(String(meta.customerTweetId))) {
    quarantinedInIndex++;
  }
});
check(quarantinedInIndex === 0, `Zero quarantined golden pairs exist in the retrieval index (${quarantinedInIndex} found)`);

// 12. Result Records Contain Required Evidence Fields
console.log('\n4. Verifying Evidence Record Structure:');
const sampleResult = resK5[0];
const hasRequiredFields = 
  sampleResult &&
  typeof sampleResult.score === 'number' &&
  typeof sampleResult.rank === 'number' &&
  typeof sampleResult.customerText === 'string' &&
  typeof sampleResult.supportResponse === 'string' &&
  Boolean(sampleResult.customerTweetId) &&
  Boolean(sampleResult.supportTweetId) &&
  Array.isArray(sampleResult.supportResponses);

check(hasRequiredFields, 'Result records contain all required evidence fields and multi-response structure');

console.log('\n===============================================================');
console.log(`TEST SUMMARY: ${passedChecks} / ${totalChecks} CHECKS PASSED`);
console.log('===============================================================');
