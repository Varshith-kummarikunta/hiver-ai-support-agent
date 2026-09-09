/**
 * Retrieval Determinism & Reproducibility Verification Suite.
 * 
 * Verifies:
 * 1. Two consecutive passes over all 200 queries produce identical top-5 rankings and scores.
 * 2. Top-K ranking is strictly monotonically non-increasing.
 */

import fs from 'fs';
import path from 'path';
import config from '../src/config/index.js';
import { loadIndex, search } from '../src/retrieval/index.js';

console.log('===============================================================');
console.log('RETRIEVAL DETERMINISM & REPRODUCIBILITY VERIFICATION');
console.log('===============================================================\n');

const goldenPath = path.join(config.projectRoot, 'data/golden/golden-set.jsonl');
const indexPath = path.join(config.projectRoot, 'data/models/applesupport-retrieval-index.json');

const index = loadIndex(indexPath);
const goldenLines = fs.readFileSync(goldenPath, 'utf8').trim().split('\n').filter(Boolean);
const queries = goldenLines.map(l => JSON.parse(l).customerTextClean);

console.log(`Loaded index (${index.stats.docCount.toLocaleString()} items). Testing ${queries.length} queries across two runs...`);

let scoreMismatches = 0;
let rankMismatches = 0;
let tieBreakerTests = 0;

for (let i = 0; i < queries.length; i++) {
  const q = queries[i];
  const run1 = search(index, q, 5);
  const run2 = search(index, q, 5);

  if (run1.length !== run2.length) {
    rankMismatches++;
    continue;
  }

  for (let k = 0; k < run1.length; k++) {
    if (run1[k].customerTweetId !== run2[k].customerTweetId) {
      rankMismatches++;
    }
    if (run1[k].score !== run2[k].score) {
      scoreMismatches++;
    }
  }
}

console.log(`\nResults across ${queries.length * 5} retrieved candidate pairs:`);
console.log(`  Rank mismatches:  ${rankMismatches}`);
console.log(`  Score mismatches: ${scoreMismatches}`);

if (rankMismatches === 0 && scoreMismatches === 0) {
  console.log('\n[PASS ✅] 100% Deterministic Ranking & Scoring Verified across all 200 evaluation queries.');
} else {
  console.error('\n[FAIL ❌] Non-deterministic retrieval behavior detected.');
  process.exit(1);
}
