import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import config from '../src/config/index.js';

console.log('==================================================');
console.log('PHASE 1: Candidate Brand Statistical Analysis');
console.log('==================================================\n');

const filePath = config.rawdataPath;

if (!fs.existsSync(filePath)) {
  console.error(`[BLOCKER] Dataset file not found at: ${filePath}`);
  console.error(`Please place 'twcs.csv' into ${path.dirname(filePath)} before running this script.`);
  process.exit(1);
}

console.log(`Analyzing dataset at: ${filePath}`);
console.log('Streaming through tweets (this may take 1-2 minutes for ~2.8M rows)...\n');

const brandStats = new Map();
let totalTweets = 0;
let inboundTweets = 0;
let outboundTweets = 0;
let lastReport = Date.now();

fs.createReadStream(filePath)
  .pipe(csv())
  .on('data', (row) => {
    totalTweets++;
    const isInbound = String(row.inbound).trim().toLowerCase() === 'true';
    const author = String(row.author_id).trim();

    if (isInbound) {
      inboundTweets++;
    } else {
      outboundTweets++;
      if (author) {
        if (!brandStats.has(author)) {
          brandStats.set(author, {
            brand: author,
            totalReplies: 0,
            directReplies: 0, // replies that respond to an in_reply_to_tweet_id
          });
        }
        const stats = brandStats.get(author);
        stats.totalReplies++;
        if (row.in_reply_to_tweet_id && row.in_reply_to_tweet_id.trim() !== '') {
          stats.directReplies++;
        }
      }
    }

    if (totalTweets % 500000 === 0) {
      const elapsed = ((Date.now() - lastReport) / 1000).toFixed(1);
      console.log(`Processed ${totalTweets.toLocaleString()} rows... (${elapsed}s)`);
      lastReport = Date.now();
    }
  })
  .on('end', () => {
    console.log(`\nStream complete.`);
    console.log(`Total tweets processed: ${totalTweets.toLocaleString()}`);
    console.log(`Inbound (Customer) tweets: ${inboundTweets.toLocaleString()}`);
    console.log(`Outbound (Support) tweets: ${outboundTweets.toLocaleString()}`);
    console.log(`Unique support brands found: ${brandStats.size}\n`);

    // Sort brands by total replies descending
    const sortedBrands = Array.from(brandStats.values())
      .sort((a, b) => b.totalReplies - a.totalReplies);

    console.log('Top 20 Candidate Brands by Support Activity:');
    console.log('-----------------------------------------------------------------------------');
    console.log(
      'Brand'.padEnd(22) +
      'Total Replies'.padStart(15) +
      'Direct Replies'.padStart(16) +
      '% Direct'.padStart(12)
    );
    console.log('-----------------------------------------------------------------------------');

    const top20 = sortedBrands.slice(0, 20);
    top20.forEach((b) => {
      const directPct = ((b.directReplies / b.totalReplies) * 100).toFixed(1) + '%';
      console.log(
        b.brand.padEnd(22) +
        b.totalReplies.toLocaleString().padStart(15) +
        b.directReplies.toLocaleString().padStart(16) +
        directPct.padStart(12)
      );
    });
    console.log('-----------------------------------------------------------------------------');

    // Save candidate analysis to JSON for downstream verification
    const outputPath = path.join(config.processedDataDir, 'candidate_brands.json');
    fs.mkdirSync(config.processedDataDir, { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify({
      totalTweets,
      inboundTweets,
      outboundTweets,
      uniqueBrandsCount: brandStats.size,
      topBrands: sortedBrands.slice(0, 30)
    }, null, 2));

    console.log(`\nCandidate brand analysis saved to: ${outputPath}`);
  })
  .on('error', (err) => {
    console.error('Error streaming dataset:', err);
    process.exit(1);
  });
