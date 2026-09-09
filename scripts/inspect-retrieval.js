/**
 * Interactive CLI Tool for Inspecting Historical AppleSupport Retrieval.
 * 
 * Usage:
 *   node scripts/inspect-retrieval.js "my iphone battery is draining very fast"
 *   node scripts/inspect-retrieval.js "screen is black and frozen" --topK 3
 */

import path from 'path';
import config from '../src/config/index.js';
import { loadIndex, search } from '../src/retrieval/index.js';

const indexPath = path.join(config.projectRoot, 'data/models/applesupport-retrieval-index.json');

const args = process.argv.slice(2);
let topK = 5;
let query = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--topK' || args[i] === '-k') {
    topK = parseInt(args[i + 1], 10) || 5;
    i++;
  } else if (!query) {
    query = args[i];
  }
}

if (!query) {
  query = 'my iphone battery is draining very fast';
}

console.log('===============================================================');
console.log(`HISTORICAL RETRIEVAL INSPECTOR (Top-${topK})`);
console.log(`Query: "${query}"`);
console.log('===============================================================\n');

const index = loadIndex(indexPath);
const results = search(index, query, topK);

if (results.length === 0) {
  console.log('No matching historical interactions found.');
  process.exit(0);
}

results.forEach(res => {
  console.log(`--------------------------------------------------------------------------------`);
  console.log(`[Rank ${res.rank}] BM25 Score: ${res.score.toFixed(4)} | Intent: ${res.intent} | Replies: ${res.allSupportRepliesCount}`);
  console.log(`  Customer Tweet (${res.customerTweetId}):`);
  console.log(`    "${res.customerText}"`);
  console.log(`  Historical AppleSupport Reply (${res.supportTweetId}):`);
  console.log(`    "${res.supportResponse}"`);
  if (res.supportResponses.length > 1) {
    console.log(`  Additional Support Responses (${res.supportResponses.length - 1}):`);
    res.supportResponses.slice(1).forEach((r, idx) => {
      console.log(`    [Reply ${idx + 2} - Tweet ${r.tweetId}]: "${r.textClean}"`);
    });
  }
  console.log(`--------------------------------------------------------------------------------\n`);
});
