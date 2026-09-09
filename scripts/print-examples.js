import fs from 'fs';
import path from 'path';
import config from '../src/config/index.js';

const data = JSON.parse(fs.readFileSync(path.join(config.processedDataDir, 'audited_intent_classification.json'), 'utf8'));

for (const [intentId, examples] of Object.entries(data.examples)) {
  console.log(`================================================================`);
  console.log(`INTENT: ${intentId.toUpperCase()} (${data.intentCounts[intentId].toLocaleString()} cases)`);
  console.log(`================================================================`);
  examples.slice(0, 10).forEach((ex, idx) => {
    console.log(`${idx + 1}. [Tweet ${ex.tweetId}] -> ${ex.assignedIntent}`);
    console.log(`   "${ex.customerText}"\n`);
  });
}
