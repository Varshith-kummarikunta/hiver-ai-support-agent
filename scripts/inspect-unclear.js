import fs from 'fs';
import readline from 'readline';
import path from 'path';
import config from '../src/config/index.js';

const pairsPath = path.join(config.processedDataDir, 'applesupport_pairs.jsonl');

async function inspectUnclear() {
  const auditData = JSON.parse(fs.readFileSync(path.join(config.processedDataDir, 'audited_intent_classification.json'), 'utf8'));
  console.log('Sample other_unclear tweets from audit:');
  auditData.examples.other_unclear.slice(0, 15).forEach((ex, i) => {
    console.log(`  ${i + 1}. [Tweet ${ex.tweetId}]: "${ex.customerText}"`);
  });
}

inspectUnclear().catch(console.error);
