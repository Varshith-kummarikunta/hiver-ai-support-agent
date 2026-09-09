/**
 * Training Script for Phase 4 Baseline Models.
 * 
 * 1. Excludes all 200 Golden Evaluation tweets from the training population (0% leakage).
 * 2. Labels eligible initial inquiries using the Phase 2 taxonomy rules.
 * 3. Fits Baseline 1 (Majority Class) on the full eligible population.
 * 4. Fits Baseline 2 (TF-IDF + Naive Bayes) using deterministic stratified sampling.
 * 5. Serializes trained model artifacts to data/models/.
 */

import fs from 'fs';
import readline from 'readline';
import path from 'path';
import config from '../src/config/index.js';
import { MajorityClassClassifier } from '../src/baselines/majority.js';
import { TfidfVectorizer } from '../src/baselines/tfidf.js';
import { MultinomialNaiveBayesClassifier } from '../src/baselines/naive-bayes.js';
import { classifyInquiry } from './audit-and-fix-taxonomy.js';
import { createPrng, shuffleArray } from '../src/utils/prng.js';

const pairsPath = path.join(config.processedDataDir, 'applesupport_pairs.jsonl');
const goldenPath = path.join(config.projectRoot, 'data', 'golden', 'golden-set.jsonl');
const modelsDir = path.join(config.projectRoot, 'data', 'models');

if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

const RANDOM_SEED = 20260909;
const MAX_SAMPLES_PER_INTENT = 1000; // Stratified balancing cap for Naive Bayes

async function trainBaselines() {
  console.log('===============================================================');
  console.log('PHASE 4: TRAINING BASELINE MODELS');
  console.log('===============================================================\n');

  // 1. Load Golden Set IDs for strict quarantine
  const goldenRaw = fs.readFileSync(goldenPath, 'utf8').trim().split('\n');
  const goldenTweetIds = new Set();
  goldenRaw.forEach(line => {
    if (!line.trim()) return;
    const item = JSON.parse(line);
    const id = item.tweetId || item.customerTweetId;
    if (id) goldenTweetIds.add(String(id));
  });

  if (goldenTweetIds.size !== 200) {
    throw new Error(`Expected exactly 200 golden tweet IDs, but loaded ${goldenTweetIds.size}`);
  }

  console.log(`[Step 1] Loaded exactly ${goldenTweetIds.size} Golden Evaluation tweet IDs for strict quarantine.`);

  // 2. Stream through applesupport_pairs.jsonl
  console.log('[Step 2] Streaming customer support pairs and extracting non-golden initial inquiries...');
  const rl = readline.createInterface({
    input: fs.createReadStream(pairsPath),
    crlfDelay: Infinity
  });

  let totalInquiriesInCorpus = 0;
  let excludedGoldenInquiries = 0;
  const eligibleInquiriesByIntent = {};
  const fullEligibleTrainingSet = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    const pair = JSON.parse(line);
    if (!pair.isInitialInquiry) continue;

    totalInquiriesInCorpus++;
    const tweetId = String(pair.customerTweetId || pair.tweetId);

    // Strict quarantine check
    if (goldenTweetIds.has(tweetId)) {
      excludedGoldenInquiries++;
      continue;
    }

    // Assign rule-based taxonomy label
    const intent = classifyInquiry(pair.customerTextClean, pair.customerTextRaw);
    const record = {
      tweetId,
      text: pair.customerTextClean,
      intent
    };

    if (!eligibleInquiriesByIntent[intent]) {
      eligibleInquiriesByIntent[intent] = [];
    }
    eligibleInquiriesByIntent[intent].push(record);
    fullEligibleTrainingSet.push(record);
  }

  const eligibleCount = fullEligibleTrainingSet.length;
  console.log(`\nPopulation Split & Leakage Verification:`);
  console.log(`  Total Initial Inquiries in Corpus: ${totalInquiriesInCorpus.toLocaleString()}`);
  console.log(`  Golden Evaluation Tweets Quarantined: ${excludedGoldenInquiries} / 200`);
  console.log(`  Eligible Training Pool Size: ${eligibleCount.toLocaleString()}`);

  if (excludedGoldenInquiries !== 200) {
    throw new Error(`Data leakage assertion failed! Quarantined ${excludedGoldenInquiries}/200 golden tweets.`);
  }
  console.log(`  Leakage Check: PASS ✅ (Zero test contamination — 100% of 200 golden tweets quarantined)`);

  console.log('\nEligible Training Population Distribution (All 74,226 Inquiries):');
  console.log('----------------------------------------------------------------------');
  console.log('  Intent ID'.padEnd(26) + 'Count'.padStart(10) + 'Share %'.padStart(10));
  console.log('----------------------------------------------------------------------');
  const sortedIntents = Object.keys(eligibleInquiriesByIntent).sort(
    (a, b) => eligibleInquiriesByIntent[b].length - eligibleInquiriesByIntent[a].length
  );
  sortedIntents.forEach(id => {
    const count = eligibleInquiriesByIntent[id].length;
    const pct = ((count / eligibleCount) * 100).toFixed(2) + '%';
    console.log('  ' + id.padEnd(24) + count.toLocaleString().padStart(10) + pct.padStart(10));
  });
  console.log('----------------------------------------------------------------------');

  // 3. Train Baseline 1: Majority Class Classifier on Full Eligible Pool
  console.log('\n[Step 3] Fitting Baseline 1: Majority Class Classifier...');
  const majorityClassifier = new MajorityClassClassifier();
  majorityClassifier.fit(fullEligibleTrainingSet);

  console.log(`  Empirical Majority Class: "${majorityClassifier.majorityClass}"`);
  console.log(`  Majority Count: ${majorityClassifier.majorityCount.toLocaleString()} / ${majorityClassifier.trainingSize.toLocaleString()}`);
  console.log(`  Majority Class Share: ${(majorityClassifier.majorityShare * 100).toFixed(2)}%`);

  const majorityModelPath = path.join(modelsDir, 'majority-baseline.json');
  fs.writeFileSync(majorityModelPath, JSON.stringify(majorityClassifier.toJSON(), null, 2), 'utf8');
  console.log(`  Saved Baseline 1 model to: ${majorityModelPath}`);

  // 4. Construct Stratified Balanced Training Sample for Baseline 2
  console.log('\n[Step 4] Sampling balanced training subset for Baseline 2 (TF-IDF + Naive Bayes)...');
  const rng = createPrng(RANDOM_SEED);
  const balancedTrainingSet = [];
  const samplingStats = {};

  sortedIntents.forEach(intentId => {
    const pool = eligibleInquiriesByIntent[intentId];
    const shuffled = shuffleArray(pool, rng);
    const take = Math.min(shuffled.length, MAX_SAMPLES_PER_INTENT);
    const sampled = shuffled.slice(0, take);
    balancedTrainingSet.push(...sampled);
    samplingStats[intentId] = {
      available: pool.length,
      sampled: take,
      shareInTraining: 0
    };
  });

  // Shuffle combined training set
  const finalTrainingSet = shuffleArray(balancedTrainingSet, rng);
  const totalSampled = finalTrainingSet.length;
  Object.keys(samplingStats).forEach(k => {
    samplingStats[k].shareInTraining = Number(((samplingStats[k].sampled / totalSampled) * 100).toFixed(2));
  });

  console.log(`  Total Balanced Training Samples: ${totalSampled.toLocaleString()}`);
  console.log(`  Capped at up to ${MAX_SAMPLES_PER_INTENT} per intent using deterministic PRNG (seed: ${RANDOM_SEED}).`);

  // 5. Train Baseline 2: TF-IDF + Naive Bayes
  console.log('\n[Step 5] Fitting Baseline 2: TF-IDF + Multinomial Naive Bayes...');
  const vectorizer = new TfidfVectorizer({
    minDocFreq: 3,
    maxDocFreqRatio: 0.85,
    useBigrams: true,
    sublinearTf: true
  });

  const naiveBayesClassifier = new MultinomialNaiveBayesClassifier({
    alpha: 0.5,
    classPriorMode: 'uniform',
    vectorizer
  });

  naiveBayesClassifier.fit(finalTrainingSet);

  console.log(`  Vocabulary Size: ${vectorizer.featureNames.length.toLocaleString()} n-grams (unigrams + bigrams)`);
  console.log(`  Sample Feature Names: ${vectorizer.featureNames.slice(0, 10).join(', ')}...`);
  console.log(`  Classes Modeled: ${naiveBayesClassifier.classes.length} intents`);
  console.log(`  Laplace Smoothing Alpha: ${naiveBayesClassifier.alpha}`);
  console.log(`  Class Prior Mode: ${naiveBayesClassifier.classPriorMode}`);

  const nbModelPath = path.join(modelsDir, 'tfidf-nb-baseline.json');
  fs.writeFileSync(nbModelPath, JSON.stringify(naiveBayesClassifier.toJSON(), null, 2), 'utf8');
  console.log(`  Saved Baseline 2 model to: ${nbModelPath}`);

  // 6. Save Training Metadata
  const metadata = {
    trainedAt: new Date().toISOString(),
    randomSeed: RANDOM_SEED,
    quarantinedGoldenTweetCount: goldenTweetIds.size,
    totalInitialInquiriesInCorpus: totalInquiriesInCorpus,
    eligibleTrainingPoolSize: eligibleCount,
    majorityBaseline: {
      modelType: 'MajorityClassClassifier',
      trainingSize: fullEligibleTrainingSet.length,
      majorityClass: majorityClassifier.majorityClass,
      majorityShare: majorityClassifier.majorityShare
    },
    tfidfNaiveBayesBaseline: {
      modelType: 'MultinomialNaiveBayesClassifier',
      trainingSize: totalSampled,
      maxSamplesPerIntent: MAX_SAMPLES_PER_INTENT,
      samplingStats,
      vocabularySize: vectorizer.featureNames.length,
      alpha: naiveBayesClassifier.alpha,
      classPriorMode: naiveBayesClassifier.classPriorMode,
      useBigrams: vectorizer.useBigrams,
      minDocFreq: vectorizer.minDocFreq,
      sublinearTf: vectorizer.sublinearTf
    }
  };

  const metadataPath = path.join(modelsDir, 'training-metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
  console.log(`  Saved training metadata to: ${metadataPath}`);

  console.log('\n===============================================================');
  console.log('BASELINE TRAINING COMPLETED SUCCESSFULLY');
  console.log('===============================================================');
}

trainBaselines().catch(err => {
  console.error('Error during baseline training:', err);
  process.exit(1);
});
