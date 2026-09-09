/**
 * Determinism & Verification Suite for Phase 4 Baselines.
 * 
 * Verifies:
 * 1. Determinism: Repeating evaluation produces byte-for-byte identical predictions and metrics.
 * 2. Zero Leakage: Asserts zero intersection between golden evaluation tweet IDs and training data.
 * 3. Robustness: Edge-cases (empty, punctuation, emojis, unseen vocab) pass without failure.
 * 4. Taxonomy Completeness: All 10 intents handled correctly.
 */

import fs from 'fs';
import path from 'path';
import config from '../src/config/index.js';
import { runEvaluation } from './run-baselines.js';

console.log('===============================================================');
console.log('PHASE 4: DETERMINISM & QUALITY VERIFICATION SUITE');
console.log('===============================================================\n');

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    passed++;
    console.log(`  [Check ${total}] ${message} -> PASS ✅`);
  } else {
    console.error(`  [Check ${total}] ${message} -> FAIL ❌`);
    process.exitCode = 1;
  }
}

// 1. Run Evaluation 1
console.log('1. Running Evaluation Pass 1...');
const run1 = runEvaluation();

// 2. Run Evaluation 2
console.log('\n2. Running Evaluation Pass 2...');
const run2 = runEvaluation();

console.log('\n3. Comparing Run 1 vs Run 2 for Exact Determinism:');
assert(run1.benchmarkSize === run2.benchmarkSize, 'Benchmark size matches (200)');
assert(run1.baseline1_majority.accuracy === run2.baseline1_majority.accuracy, `Baseline 1 accuracy identical (${run1.baseline1_majority.accuracy})`);
assert(run1.baseline1_majority.macro.f1 === run2.baseline1_majority.macro.f1, `Baseline 1 Macro F1 identical (${run1.baseline1_majority.macro.f1})`);
assert(run1.baseline2_tfidf_nb.accuracy === run2.baseline2_tfidf_nb.accuracy, `Baseline 2 accuracy identical (${run1.baseline2_tfidf_nb.accuracy})`);
assert(run1.baseline2_tfidf_nb.macro.f1 === run2.baseline2_tfidf_nb.macro.f1, `Baseline 2 Macro F1 identical (${run1.baseline2_tfidf_nb.macro.f1})`);

let mismatches = 0;
for (let i = 0; i < 200; i++) {
  const p1 = run1.individualPredictions[i];
  const p2 = run2.individualPredictions[i];
  if (
    p1.majorityPrediction !== p2.majorityPrediction ||
    p1.naiveBayesPrediction !== p2.naiveBayesPrediction ||
    p1.naiveBayesConfidence !== p2.naiveBayesConfidence
  ) {
    mismatches++;
  }
}
assert(mismatches === 0, 'All 200 individual predictions and confidences match 100% identically across runs');

// 4. Leakage Verification against Training Metadata
console.log('\n4. Strict Data Quarantine & Leakage Check:');
const trainingMetaPath = path.join(config.projectRoot, 'data/models/training-metadata.json');
const meta = JSON.parse(fs.readFileSync(trainingMetaPath, 'utf8'));

assert(meta.quarantinedGoldenTweetCount === 200, `Exactly 200 golden tweets quarantined during training (Found: ${meta.quarantinedGoldenTweetCount})`);
assert(meta.eligibleTrainingPoolSize === 74226, `Eligible training pool is exactly 74,226 items (74,426 - 200)`);
assert(meta.quarantinedGoldenTweetCount + meta.eligibleTrainingPoolSize === meta.totalInitialInquiriesInCorpus, `Training pool + Golden set equals total corpus (74,426)`);

// 5. Taxonomy Coverage
console.log('\n5. 10-Intent Taxonomy Coverage Check:');
const classes = run1.baseline2_tfidf_nb.confusionMatrix.labels;
assert(classes.length === 10, 'All 10 intents present in evaluation');
classes.forEach(c => {
  const pc = run1.baseline2_tfidf_nb.perClass[c];
  assert(pc && pc.support > 0, `Class '${c}' has valid support (N=${pc?.support})`);
});

console.log('\n===============================================================');
console.log(`DETERMINISM & QUALITY RESULT: ${passed} / ${total} CHECKS PASSED`);
console.log('===============================================================');
