/**
 * Empirical Timing Benchmark for Baseline Models.
 * Measures exact wall-clock training time and inference latency using performance.now().
 */

import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import config from '../src/config/index.js';
import { TfidfVectorizer } from '../src/baselines/tfidf.js';
import { MultinomialNaiveBayesClassifier } from '../src/baselines/naive-bayes.js';
import { MajorityClassClassifier } from '../src/baselines/majority.js';

const goldenPath = path.join(config.projectRoot, 'data/golden/golden-set.jsonl');
const modelsDir = path.join(config.projectRoot, 'data/models');
const nbModelPath = path.join(modelsDir, 'tfidf-nb-baseline.json');
const metaPath = path.join(modelsDir, 'training-metadata.json');

const goldenRecords = fs.readFileSync(goldenPath, 'utf8').trim().split('\n').map(l => JSON.parse(l));
const texts = goldenRecords.map(r => r.customerTextClean);

// 1. Measure Inference Latency
console.log('1. Measuring Inference Latency across 2,000 queries...');
const nbModel = JSON.parse(fs.readFileSync(nbModelPath, 'utf8'));
const classifier = MultinomialNaiveBayesClassifier.fromJSON(nbModel);

// Warmup
for (let i = 0; i < 100; i++) {
  classifier.predict(texts[i % texts.length]);
}

const latencies = [];
const N_RUNS = 2000;
const tStart = performance.now();

for (let i = 0; i < N_RUNS; i++) {
  const query = texts[i % texts.length];
  const t0 = performance.now();
  classifier.predict(query);
  const t1 = performance.now();
  latencies.push(t1 - t0);
}
const tEnd = performance.now();

const totalInferenceMs = tEnd - tStart;
const meanLatencyMs = totalInferenceMs / N_RUNS;
latencies.sort((a, b) => a - b);
const medianLatencyMs = latencies[Math.floor(latencies.length / 2)];
const p95LatencyMs = latencies[Math.floor(latencies.length * 0.95)];

console.log(`  Total Time (2,000 queries): ${totalInferenceMs.toFixed(2)} ms`);
console.log(`  Mean Inference Latency:     ${meanLatencyMs.toFixed(4)} ms / query (~${(meanLatencyMs * 1000).toFixed(1)} microseconds)`);
console.log(`  Median Inference Latency:   ${medianLatencyMs.toFixed(4)} ms / query`);
console.log(`  P95 Inference Latency:      ${p95LatencyMs.toFixed(4)} ms / query`);

// 2. Measure Model Training Time on 8,557 Balanced Samples
console.log('\n2. Measuring Training Time on 8,557 documents...');
const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

// Re-generate training sample from PRNG seed 20260909
import { createPrng, shuffleArray } from '../src/utils/prng.js';
import readline from 'readline';

const pairsPath = path.join(config.processedDataDir, 'applesupport_pairs.jsonl');
const goldenTweetIds = new Set(goldenRecords.map(r => String(r.tweetId || r.customerTweetId)));

// Stream non-golden
const eligibleInquiriesByIntent = {};
const rl = readline.createInterface({
  input: fs.createReadStream(pairsPath),
  crlfDelay: Infinity
});

import { classifyInquiry } from './audit-and-fix-taxonomy.js';

for await (const line of rl) {
  if (!line.trim()) continue;
  const pair = JSON.parse(line);
  if (!pair.isInitialInquiry) continue;
  const tweetId = String(pair.customerTweetId || pair.tweetId);
  if (goldenTweetIds.has(tweetId)) continue;
  const intent = classifyInquiry(pair.customerTextClean, pair.customerTextRaw);
  if (!eligibleInquiriesByIntent[intent]) eligibleInquiriesByIntent[intent] = [];
  eligibleInquiriesByIntent[intent].push({ text: pair.customerTextClean, intent });
}

const rng = createPrng(20260909);
const trainingSet = [];
Object.keys(eligibleInquiriesByIntent).forEach(id => {
  const pool = eligibleInquiriesByIntent[id];
  const shuffled = shuffleArray(pool, rng);
  trainingSet.push(...shuffled.slice(0, Math.min(shuffled.length, 1000)));
});
const finalTrainingSet = shuffleArray(trainingSet, rng);

console.log(`  Loaded ${finalTrainingSet.length} balanced documents for timing benchmark.`);

const tStartTrain = performance.now();
const testVec = new TfidfVectorizer({ minDocFreq: 3, maxDocFreqRatio: 0.85, useBigrams: true, sublinearTf: true });
const testNb = new MultinomialNaiveBayesClassifier({ alpha: 0.5, classPriorMode: 'uniform', vectorizer: testVec });
testNb.fit(finalTrainingSet);
const tEndTrain = performance.now();

const trainingDurationMs = tEndTrain - tStartTrain;
console.log(`  Measured Training Time (fit 8,557 docs): ${trainingDurationMs.toFixed(2)} ms (~${(trainingDurationMs / 1000).toFixed(2)} seconds)`);

// Save empirical timing results
const timingResults = {
  measuredAt: new Date().toISOString(),
  environment: `Node.js ${process.version} (${process.platform} ${process.arch})`,
  inference: {
    runs: N_RUNS,
    totalTimeMs: Number(totalInferenceMs.toFixed(2)),
    meanLatencyMs: Number(meanLatencyMs.toFixed(4)),
    medianLatencyMs: Number(medianLatencyMs.toFixed(4)),
    p95LatencyMs: Number(p95LatencyMs.toFixed(4))
  },
  training: {
    documentsCount: finalTrainingSet.length,
    vocabularySize: testVec.featureNames.length,
    wallClockFitTimeMs: Number(trainingDurationMs.toFixed(2))
  }
};

fs.writeFileSync(
  path.join(modelsDir, 'timing-benchmark.json'),
  JSON.stringify(timingResults, null, 2),
  'utf8'
);

console.log('\nTiming benchmark saved to data/models/timing-benchmark.json');

