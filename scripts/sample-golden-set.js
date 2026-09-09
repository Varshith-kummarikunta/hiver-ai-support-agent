import fs from 'fs';
import readline from 'readline';
import path from 'path';
import config from '../src/config/index.js';
import { createPrng, shuffleArray } from '../src/utils/prng.js';
import { classifyInquiry } from './audit-and-fix-taxonomy.js';

console.log('===============================================================');
console.log('PHASE 3: Stratified Sampling of 200 Golden Evaluation Examples');
console.log('===============================================================\n');

const RANDOM_SEED = 20260909; // Fixed, deterministic seed for 100% reproducibility
const TARGET_TOTAL = 200;

// Stratified allocation ensuring all technical intents have measurable sample sizes
// while keeping other_unclear as the largest single stratum (20%).
const STRATA_ALLOCATION = {
  other_unclear: 40,
  battery_power: 25,
  keyboard_typing: 25,
  audio_media: 20,
  display_hardware: 20,
  account_icloud: 18,
  connectivity_network: 18,
  apps_appstore: 16,
  billing_subscriptions: 10,
  software_update: 8
};

const pairsPath = path.join(config.processedDataDir, 'applesupport_pairs.jsonl');
const goldenJsonlPath = path.join(config.projectRoot, 'data/golden/golden-set.jsonl');
const goldenAgreementPath = path.join(config.projectRoot, 'data/golden/golden-agreement.jsonl');

fs.mkdirSync(path.dirname(goldenJsonlPath), { recursive: true });

async function sampleGoldenSet() {
  const rng = createPrng(RANDOM_SEED);
  const rl = readline.createInterface({
    input: fs.createReadStream(pairsPath),
    crlfDelay: Infinity
  });

  // Buckets for candidate strata
  const strataBuckets = {};
  for (const k of Object.keys(STRATA_ALLOCATION)) {
    strataBuckets[k] = [];
  }

  console.log(`Streaming pairs from ${pairsPath}...`);
  let initialInquiryCount = 0;
  const seenTweetIds = new Set();
  const seenTexts = new Set();

  for await (const line of rl) {
    if (!line.trim()) continue;
    const pair = JSON.parse(line);

    // Rule 1: ONLY sample from initial inquiries
    if (!pair.isInitialInquiry) continue;

    // Rule 2: Anti-leakage: No duplicate tweet IDs or exact text duplicates
    if (seenTweetIds.has(pair.customerTweetId)) continue;
    seenTweetIds.add(pair.customerTweetId);

    const clean = pair.customerTextClean.trim().toLowerCase();
    if (seenTexts.has(clean)) continue;
    seenTexts.add(clean);

    initialInquiryCount++;

    // Classify using Phase 2 audited taxonomy rules to guide stratification
    const candidateLabel = classifyInquiry(pair.customerTextClean, pair.customerTextRaw);

    // Check for boundary ambiguity flags
    const isAmbiguous = 
      (/\bupdate\b/i.test(clean) && /\b(battery|screen|keyboard|wifi|bluetooth|sound)\b/i.test(clean)) ||
      (/\b(repair|bill)\b/i.test(clean) && /\b(screen|glass|display)\b/i.test(clean)) ||
      (/\b(charge|card)\b/i.test(clean) && /\b(wifi|sim|free app)\b/i.test(clean)) ||
      (/\b(music|spotify)\b/i.test(clean) && /\b(app|crash|store)\b/i.test(clean)) ||
      clean.length < 25; // Short message

    strataBuckets[candidateLabel].push({
      tweetId: pair.customerTweetId,
      customerAuthorId: pair.customerAuthorId,
      customerCreatedAt: pair.customerCreatedAt,
      customerTextRaw: pair.customerTextRaw,
      customerTextClean: pair.customerTextClean,
      automaticCandidateLabel: candidateLabel,
      isAmbiguousCase: isAmbiguous,
      hasUrl: pair.entities.customerUrls.length > 0,
      charLength: pair.customerTextClean.length
    });
  }

  console.log(`Population Scanned: ${initialInquiryCount.toLocaleString()} unique initial inquiries.\n`);

  console.log('Strata Pool Sizes & Sampling Targets:');
  console.log('-----------------------------------------------------------------------------------------');
  console.log(
    'Stratum / Intent ID'.padEnd(26) +
    'Pool Available'.padStart(16) +
    'Target Sample'.padStart(16) +
    'Sample % of Pool'.padStart(18)
  );
  console.log('-----------------------------------------------------------------------------------------');

  const selectedSamples = [];
  let goldenCounter = 1;

  for (const [stratum, targetCount] of Object.entries(STRATA_ALLOCATION)) {
    const pool = strataBuckets[stratum];
    const shuffledPool = shuffleArray(pool, rng);

    // Prioritize including 30-40% ambiguous / boundary cases within each stratum
    const ambiguousInPool = shuffledPool.filter(s => s.isAmbiguousCase);
    const standardInPool = shuffledPool.filter(s => !s.isAmbiguousCase);

    const targetAmbiguous = Math.min(Math.round(targetCount * 0.35), ambiguousInPool.length);
    const targetStandard = targetCount - targetAmbiguous;

    const stratumSample = [
      ...ambiguousInPool.slice(0, targetAmbiguous),
      ...standardInPool.slice(0, targetStandard)
    ];

    console.log(
      stratum.padEnd(26) +
      pool.length.toLocaleString().padStart(16) +
      stratumSample.length.toLocaleString().padStart(16) +
      (((stratumSample.length / pool.length) * 100).toFixed(2) + '%').padStart(18)
    );

    stratumSample.forEach(item => {
      const padId = String(goldenCounter++).padStart(3, '0');
      selectedSamples.push({
        goldenId: `GOLD-${padId}`,
        tweetId: item.tweetId,
        customerAuthorId: item.customerAuthorId,
        customerCreatedAt: item.customerCreatedAt,
        customerTextRaw: item.customerTextRaw,
        customerTextClean: item.customerTextClean,
        // The candidate label is strictly metadata for stratification auditing;
        // it must NEVER be treated as the ground-truth human label!
        automaticCandidateLabel: item.automaticCandidateLabel,
        samplingStratum: stratum,
        isAmbiguousCase: item.isAmbiguousCase,
        hasUrl: item.hasUrl,
        charLength: item.charLength,
        // Human annotation fields (MUST INITIALIZE TO NULL - NO FABRICATION)
        humanLabel: null,
        labelReason: null,
        annotator: null,
        annotatedAt: null
      });
    });
  }

  // Deterministically shuffle the final 200 items so annotators don't see all items from one intent in a row
  const finalGoldenSet = shuffleArray(selectedSamples, rng);
  // Re-index golden IDs cleanly 1 to 200
  finalGoldenSet.forEach((item, idx) => {
    item.goldenId = `GOLD-${String(idx + 1).padStart(3, '0')}`;
  });

  // Write golden-set.jsonl
  const jsonlLines = finalGoldenSet.map(item => JSON.stringify(item)).join('\n') + '\n';
  fs.writeFileSync(goldenJsonlPath, jsonlLines, 'utf8');

  // Create double-annotation agreement subset (first 50 items)
  const agreementSubset = finalGoldenSet.slice(0, 50).map(item => ({
    goldenId: item.goldenId,
    tweetId: item.tweetId,
    customerTextClean: item.customerTextClean,
    annotatorA: null,
    annotatorB: null,
    adjudicatedLabel: null,
    isAgreement: null,
    notes: null
  }));
  const agreementLines = agreementSubset.map(item => JSON.stringify(item)).join('\n') + '\n';
  fs.writeFileSync(goldenAgreementPath, agreementLines, 'utf8');

  console.log('-----------------------------------------------------------------------------------------');
  console.log(`\nSampling Complete!`);
  console.log(`Golden Set Total Records: ${finalGoldenSet.length}`);
  console.log(`Ambiguous / Boundary Cases Included: ${finalGoldenSet.filter(s => s.isAmbiguousCase).length} (${((finalGoldenSet.filter(s => s.isAmbiguousCase).length / finalGoldenSet.length) * 100).toFixed(1)}%)`);
  console.log(`Short Messages (<30 chars): ${finalGoldenSet.filter(s => s.charLength < 30).length}`);
  console.log(`Messages Containing URLs: ${finalGoldenSet.filter(s => s.hasUrl).length}`);
  console.log(`Double-Annotation Agreement Subset: ${agreementSubset.length} records`);
  console.log(`\nOutput Files:`);
  console.log(`  - ${goldenJsonlPath}`);
  console.log(`  - ${goldenAgreementPath}`);
}

sampleGoldenSet().catch(console.error);
