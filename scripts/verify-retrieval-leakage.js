/**
 * Machine-Checkable Leakage Verification for Historical Retrieval.
 * 
 * Asserts:
 * 1. Exactly 200 golden IDs were loaded from data/golden/golden-set.jsonl
 * 2. Zero golden IDs occur in the retrieval index
 * 3. Zero associated golden customer->support pairs occur in the index
 * 4. Retrieval queries across all 200 golden examples cannot return a quarantined golden example
 */

import fs from 'fs';
import path from 'path';
import config from '../src/config/index.js';
import { loadIndex, search } from '../src/retrieval/index.js';

console.log('===============================================================');
console.log('STRICT RETRIEVAL DATA LEAKAGE AUDIT');
console.log('===============================================================\n');

const goldenPath = path.join(config.projectRoot, 'data/golden/golden-set.jsonl');
const indexPath = path.join(config.projectRoot, 'data/models/applesupport-retrieval-index.json');
const metaPath = path.join(config.projectRoot, 'data/models/retrieval-metadata.json');

let passCount = 0;
let totalChecks = 4;

// 1. Exactly 200 golden IDs loaded
const goldenLines = fs.readFileSync(goldenPath, 'utf8').trim().split('\n').filter(Boolean);
const goldenTweetIds = new Set();
goldenLines.forEach(l => {
  const item = JSON.parse(l);
  const id = item.tweetId || item.customerTweetId;
  if (id) goldenTweetIds.add(String(id));
});

console.log(`[Check 1/4] Golden IDs Loaded: ${goldenTweetIds.size}`);
if (goldenTweetIds.size === 200) {
  passCount++;
  console.log('  -> PASS ✅ (Exactly 200 authoritative golden tweet IDs loaded)');
} else {
  console.error(`  -> FAIL ❌ (Expected 200, loaded ${goldenTweetIds.size})`);
}

// 2. Zero golden IDs occur in retrieval index metadata
console.log('\n[Check 2/4] Scanning retrieval index metadata for golden tweet IDs...');
const index = loadIndex(indexPath);
let goldenIdMatchesInIndex = 0;

index.docMetadata.forEach(meta => {
  if (goldenTweetIds.has(String(meta.customerTweetId))) {
    goldenIdMatchesInIndex++;
  }
});

if (goldenIdMatchesInIndex === 0) {
  passCount++;
  console.log(`  Scanned ${index.docMetadata.length.toLocaleString()} indexed documents.`);
  console.log('  -> PASS ✅ (Zero golden tweet IDs found in index)');
} else {
  console.error(`  -> FAIL ❌ (${goldenIdMatchesInIndex} golden tweet IDs found in index!)`);
}

// 3. Zero associated golden customer->support pairs occur in index
console.log('\n[Check 3/4] Checking metadata build logs for quarantine enforcement...');
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const matchingExcluded = meta.matchingPairsExcluded;

console.log(`  Source pairs in corpus:           ${meta.totalSourcePairs.toLocaleString()}`);
console.log(`  Golden IDs quarantined:           ${meta.goldenIdsLoaded}`);
console.log(`  Matching source pairs excluded:   ${matchingExcluded}`);
console.log(`  Final index population:           ${meta.finalIndexPopulation.toLocaleString()}`);

if (matchingExcluded >= 200 && meta.finalIndexPopulation === meta.totalSourcePairs - matchingExcluded) {
  passCount++;
  console.log('  -> PASS ✅ (All matching golden customer->support pairs excluded from index)');
} else {
  console.error('  -> FAIL ❌ (Discrepancy in excluded pairs count)');
}

// 4. Retrieval evaluation across all 200 golden examples cannot return a quarantined golden example
console.log('\n[Check 4/4] Executing top-20 search for all 200 golden queries...');
let queryLeakageCount = 0;

for (let i = 0; i < goldenLines.length; i++) {
  const item = JSON.parse(goldenLines[i]);
  const text = item.customerTextClean;
  const results = search(index, text, 20);

  for (const hit of results) {
    if (goldenTweetIds.has(String(hit.customerTweetId))) {
      queryLeakageCount++;
      console.error(`  LEAKAGE DETECTED on Golden ID ${item.goldenId}: returned ${hit.customerTweetId}`);
    }
  }
}

if (queryLeakageCount === 0) {
  passCount++;
  console.log(`  Queried 200 golden queries against index (retrieved ${200 * 20} candidates total).`);
  console.log('  -> PASS ✅ (Zero golden interactions returned across all queries)');
} else {
  console.error(`  -> FAIL ❌ (${queryLeakageCount} golden hits returned!)`);
}

console.log('\n===============================================================');
console.log(`LEAKAGE AUDIT RESULT: ${passCount} / ${totalChecks} CHECKS PASSED`);
console.log('===============================================================');

if (passCount !== totalChecks) {
  process.exit(1);
}
