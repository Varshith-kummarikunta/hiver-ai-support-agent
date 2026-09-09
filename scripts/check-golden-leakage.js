import fs from 'fs';
import path from 'path';
import config from '../src/config/index.js';

console.log('===============================================================');
console.log('LEAKAGE & INTEGRITY AUDIT: 200 Golden Evaluation Records');
console.log('===============================================================\n');

const goldenPath = path.join(config.projectRoot, 'data/golden/golden-set.jsonl');
const pairsPath = path.join(config.processedDataDir, 'applesupport_pairs.jsonl');

if (!fs.existsSync(goldenPath)) {
  console.error(`[FAIL] Golden set file missing: ${goldenPath}`);
  process.exit(1);
}

const lines = fs.readFileSync(goldenPath, 'utf8').split('\n').filter(Boolean);
const goldenRecords = lines.map(line => JSON.parse(line));

console.log(`Golden records loaded: ${goldenRecords.length}`);

let passedChecks = 0;
let totalChecks = 6;

// Check 1: Exactly 200 records
if (goldenRecords.length === 200) {
  console.log('  [Check 1/6] Record Count: Exactly 200 items -> PASS ✅');
  passedChecks++;
} else {
  console.error(`  [Check 1/6] Record Count: ${goldenRecords.length} (Expected 200) -> FAIL ❌`);
}

// Check 2: No duplicate Tweet IDs
const tweetIdSet = new Set();
let dupIdCount = 0;
goldenRecords.forEach(r => {
  if (tweetIdSet.has(r.tweetId)) dupIdCount++;
  tweetIdSet.add(r.tweetId);
});
if (dupIdCount === 0) {
  console.log('  [Check 2/6] Tweet ID Uniqueness: Zero duplicates -> PASS ✅');
  passedChecks++;
} else {
  console.error(`  [Check 2/6] Tweet ID Uniqueness: ${dupIdCount} duplicate IDs found -> FAIL ❌`);
}

// Check 3: No duplicate text
const textSet = new Set();
let dupTextCount = 0;
goldenRecords.forEach(r => {
  const norm = r.customerTextClean.trim().toLowerCase();
  if (textSet.has(norm)) dupTextCount++;
  textSet.add(norm);
});
if (dupTextCount === 0) {
  console.log('  [Check 3/6] Text Uniqueness: Zero duplicate texts -> PASS ✅');
  passedChecks++;
} else {
  console.error(`  [Check 3/6] Text Uniqueness: ${dupTextCount} duplicate texts found -> FAIL ❌`);
}

// Check 4: Human labels are unpopulated (Anti-Fabrication Check)
const populatedHumanLabels = goldenRecords.filter(r => r.humanLabel !== null);
if (populatedHumanLabels.length === 0) {
  console.log('  [Check 4/6] Anti-Fabrication Rule: All humanLabel fields are null -> PASS ✅');
  passedChecks++;
} else {
  console.error(`  [Check 4/6] Anti-Fabrication Rule: ${populatedHumanLabels.length} records have premature labels! -> FAIL ❌`);
}

// Check 5: Candidate label separation
const hasCandidateLabels = goldenRecords.every(r => r.automaticCandidateLabel && r.samplingStratum);
if (hasCandidateLabels) {
  console.log('  [Check 5/6] Candidate Metadata: Separated in automaticCandidateLabel -> PASS ✅');
  passedChecks++;
} else {
  console.error('  [Check 5/6] Candidate Metadata: Missing automaticCandidateLabel in some records -> FAIL ❌');
}

// Check 6: All records are genuine initial inquiries from applesupport_pairs
const goldenTweetIds = new Set(goldenRecords.map(r => r.tweetId));
let matchedInPairs = 0;
let followUpLeakage = 0;

if (fs.existsSync(pairsPath)) {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: fs.createReadStream(pairsPath),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    const pair = JSON.parse(line);
    if (goldenTweetIds.has(pair.customerTweetId)) {
      matchedInPairs++;
      if (!pair.isInitialInquiry) {
        followUpLeakage++;
      }
    }
  }

  if (matchedInPairs === 200 && followUpLeakage === 0) {
    console.log(`  [Check 6/6] Real Initial Inquiry Grounding: 200/200 verified, 0 follow-up leaks -> PASS ✅`);
    passedChecks++;
  } else {
    console.error(`  [Check 6/6] Grounding Error: ${matchedInPairs}/200 matched, ${followUpLeakage} follow-up leaks -> FAIL ❌`);
  }
} else {
  console.log('  [Check 6/6] pairs.jsonl not found for verification -> SKIPPED ⚠️');
}

console.log('\n===============================================================');
console.log(`LEAKAGE AUDIT RESULT: ${passedChecks} / ${totalChecks} CHECKS PASSED`);
console.log('===============================================================');

if (passedChecks === totalChecks) {
  console.log('Golden evaluation set is 100% compliant with anti-leakage rules.');
  process.exit(0);
} else {
  console.error('Integrity checks failed!');
  process.exit(1);
}
