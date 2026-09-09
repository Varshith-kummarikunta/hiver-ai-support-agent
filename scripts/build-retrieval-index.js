/**
 * Build Script for Historical Retrieval Index.
 * 
 * 1. Loads all 200 Golden Evaluation tweet IDs.
 * 2. Streams through data/processed/applesupport_pairs.jsonl.
 * 3. Strictly excludes any pair matching a golden tweet ID.
 * 4. Measures exact counts: source pairs, golden IDs, excluded pairs, final population.
 * 5. Builds deterministic BM25 inverted index in pure Node.js.
 * 6. Serializes index to data/models/applesupport-retrieval-index.json.
 */

import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { performance } from 'perf_hooks';
import config from '../src/config/index.js';
import { buildIndex, saveIndex } from '../src/retrieval/index.js';
import { classifyInquiry } from './audit-and-fix-taxonomy.js';

const pairsPath = path.join(config.processedDataDir, 'applesupport_pairs.jsonl');
const goldenPath = path.join(config.projectRoot, 'data/golden/golden-set.jsonl');
const modelsDir = path.join(config.projectRoot, 'data/models');
const indexPath = path.join(modelsDir, 'applesupport-retrieval-index.json');
const metaPath = path.join(modelsDir, 'retrieval-metadata.json');

if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

async function runIndexBuild() {
  console.log('===============================================================');
  console.log('PHASE 5: BUILDING BM25 HISTORICAL RETRIEVAL INDEX');
  console.log('===============================================================\n');

  const buildStart = performance.now();

  // 1. Load Golden Set IDs
  console.log('[Step 1] Loading Golden Evaluation Set for authoritative exclusion...');
  const goldenRaw = fs.readFileSync(goldenPath, 'utf8').trim().split('\n');
  const goldenTweetIds = new Set();
  goldenRaw.forEach(line => {
    if (!line.trim()) return;
    const item = JSON.parse(line);
    const id = item.tweetId || item.customerTweetId;
    if (id) goldenTweetIds.add(String(id));
  });

  console.log(`  Golden evaluation IDs loaded: ${goldenTweetIds.size}`);
  if (goldenTweetIds.size !== 200) {
    throw new Error(`Expected exactly 200 golden tweet IDs, but loaded ${goldenTweetIds.size}`);
  }

  // 2. Stream through applesupport_pairs.jsonl
  console.log('\n[Step 2] Streaming interaction pairs and applying golden-ID quarantine...');
  const rl = readline.createInterface({
    input: fs.createReadStream(pairsPath),
    crlfDelay: Infinity
  });

  let totalSourcePairs = 0;
  let excludedGoldenPairsCount = 0;
  const excludedGoldenTweetIdsFound = new Set();
  const eligibleRecords = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    totalSourcePairs++;
    const pair = JSON.parse(line);
    const customerTweetId = String(pair.customerTweetId || pair.tweetId);

    // Check quarantine
    if (goldenTweetIds.has(customerTweetId)) {
      excludedGoldenPairsCount++;
      excludedGoldenTweetIdsFound.add(customerTweetId);
      continue;
    }

    // Classify taxonomy intent for retrieval evaluation diagnostics
    const intent = classifyInquiry(pair.customerTextClean, pair.customerTextRaw);

    eligibleRecords.push({
      customerTweetId,
      supportTweetId: String(pair.supportTweetId),
      customerAuthorId: pair.customerAuthorId,
      customerCreatedAt: pair.customerCreatedAt,
      supportCreatedAt: pair.supportCreatedAt,
      customerTextClean: pair.customerTextClean,
      customerTextRaw: pair.customerTextRaw,
      supportTextClean: pair.supportTextClean,
      supportTextRaw: pair.supportTextRaw,
      isInitialInquiry: Boolean(pair.isInitialInquiry),
      allSupportRepliesCount: pair.allSupportRepliesCount || 1,
      intent
    });
  }

  const finalIndexPopulation = eligibleRecords.length;

  console.log('\nPopulation & Exclusion Breakdown:');
  console.log('---------------------------------------------------------------');
  console.log(`  Source pairs in applesupport_pairs.jsonl:   ${totalSourcePairs.toLocaleString()}`);
  console.log(`  Golden IDs loaded:                          ${goldenTweetIds.size}`);
  console.log(`  Matching retrieval pairs excluded:          ${excludedGoldenPairsCount}`);
  console.log(`  Unique golden IDs encountered in pairs:     ${excludedGoldenTweetIdsFound.size} / 200`);
  console.log(`  Final eligible retrieval index population:  ${finalIndexPopulation.toLocaleString()}`);
  console.log(`  Population Check: ${totalSourcePairs} - ${excludedGoldenPairsCount} = ${finalIndexPopulation} (${finalIndexPopulation === totalSourcePairs - excludedGoldenPairsCount ? 'MATCH ✅' : 'MISMATCH ❌'})`);
  console.log('---------------------------------------------------------------');

  // 3. Build BM25 Index
  console.log('\n[Step 3] Fitting BM25 inverted index on eligible interactions...');
  const tFitStart = performance.now();
  const index = buildIndex(eligibleRecords, {
    k1: 1.2,
    b: 0.75,
    minDocFreq: 2
  });
  const tFitEnd = performance.now();

  console.log(`  Indexed documents:    ${index.stats.docCount.toLocaleString()}`);
  console.log(`  Vocabulary size:      ${index.stats.vocabularySize.toLocaleString()} terms`);
  console.log(`  Average doc length:   ${index.stats.avgDocLen} tokens`);
  console.log(`  BM25 parameters:      k1 = ${index.stats.k1}, b = ${index.stats.b}, minDocFreq = ${index.stats.minDocFreq}`);
  console.log(`  Multi-response docs:  ${index.stats.multiResponseDocsCount}`);
  console.log(`  Inverted index fit:   ${((tFitEnd - tFitStart) / 1000).toFixed(2)} seconds`);

  // 4. Save Index to disk
  console.log('\n[Step 4] Serializing index to disk...');
  const tSaveStart = performance.now();
  saveIndex(index, indexPath);
  const tSaveEnd = performance.now();

  const fileStats = fs.statSync(indexPath);
  const indexSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);
  console.log(`  Index file written:   ${indexPath}`);
  console.log(`  Index size on disk:   ${indexSizeMB} MB`);
  console.log(`  Serialization time:   ${((tSaveEnd - tSaveStart) / 1000).toFixed(2)} seconds`);

  const buildEnd = performance.now();
  const totalBuildDurationSec = ((buildEnd - buildStart) / 1000).toFixed(2);

  // 5. Save Build Metadata
  const metadata = {
    builtAt: new Date().toISOString(),
    sourceFile: pairsPath,
    totalSourcePairs,
    goldenIdsLoaded: goldenTweetIds.size,
    matchingPairsExcluded: excludedGoldenPairsCount,
    uniqueGoldenIdsFoundInPairs: excludedGoldenTweetIdsFound.size,
    finalIndexPopulation,
    populationFormula: `${totalSourcePairs} - ${excludedGoldenPairsCount} = ${finalIndexPopulation}`,
    indexSizeDiskBytes: fileStats.size,
    indexSizeDiskMB: Number(indexSizeMB),
    vocabularySize: index.stats.vocabularySize,
    avgDocLength: index.stats.avgDocLen,
    bm25Parameters: {
      k1: index.stats.k1,
      b: index.stats.b,
      minDocFreq: index.stats.minDocFreq
    },
    multiResponseConversationsCount: index.stats.multiResponseDocsCount,
    buildDurationSeconds: Number(totalBuildDurationSec)
  };

  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');
  console.log(`  Saved build metadata: ${metaPath}`);

  console.log('\n===============================================================');
  console.log(`BM25 INDEX BUILD COMPLETE IN ${totalBuildDurationSec}s`);
  console.log('===============================================================');
}

runIndexBuild().catch(err => {
  console.error('Error during BM25 index build:', err);
  process.exit(1);
});
