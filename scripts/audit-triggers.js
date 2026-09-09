import fs from 'fs';
import readline from 'readline';
import path from 'path';
import config from '../src/config/index.js';

console.log('Auditing keyword precision and false-positive triggers...\n');

const pairsPath = path.join(config.processedDataDir, 'applesupport_pairs.jsonl');

async function auditTriggers() {
  const rl = readline.createInterface({
    input: fs.createReadStream(pairsPath),
    crlfDelay: Infinity
  });

  // Track specific suspicious trigger words
  const suspiciousWords = {
    'bill': [],
    'paid': [],
    'card': [],
    'lock screen': [],
    'screenshot': [],
    'repair': []
  };

  let count = 0;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const pair = JSON.parse(line);
    if (!pair.isInitialInquiry) continue;

    count++;
    const text = (pair.customerTextClean || '').toLowerCase();

    for (const word of Object.keys(suspiciousWords)) {
      const reg = new RegExp(`\\b${word}\\b`, 'i');
      if (reg.test(text) && suspiciousWords[word].length < 5) {
        suspiciousWords[word].push({
          id: pair.customerTweetId,
          text: pair.customerTextClean
        });
      }
    }
  }

  console.log(`Audited across ${count.toLocaleString()} initial inquiries.\n`);
  for (const [word, examples] of Object.entries(suspiciousWords)) {
    console.log(`Trigger: "${word}" (Sample Occurrences):`);
    examples.forEach((ex, i) => {
      console.log(`  ${i + 1}. [Tweet ${ex.id}]: "${ex.text}"`);
    });
    console.log('');
  }
}

auditTriggers().catch(console.error);
