import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import config from '../src/config/index.js';

console.log('===============================================================');
console.log('PHASE 1: Comprehensive Dataset & Brand Statistical Analysis');
console.log('===============================================================\n');

const filePath = config.rawdataPath;

if (!fs.existsSync(filePath)) {
  console.error(`[BLOCKER] Dataset file not found at: ${filePath}`);
  process.exit(1);
}

const stats = fs.statSync(filePath);
console.log(`Analyzing: ${filePath}`);
console.log(`File Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);
console.log('Streaming ~2.8 million rows. Progress reported every 500k rows...\n');

let totalRows = 0;
let inboundCount = 0;
let outboundCount = 0;

// Missing value counters
const missingCounts = {
  tweet_id: 0,
  author_id: 0,
  inbound: 0,
  created_at: 0,
  text: 0,
  response_tweet_id: 0,
  in_response_to_tweet_id: 0,
};

// Response linkage counters
let outboundWithInResponseTo = 0;
let inboundWithResponseTweetId = 0;
let multiResponseCount = 0;

// Brand stats
const brandStats = new Map();
// Customer author set (using a Bloom filter / sampling or counting unique strings safely)
const sampleCustomerAuthors = new Set();
let totalCustomerAuthorOccurrences = 0;

const startTime = Date.now();
let lastLap = Date.now();

fs.createReadStream(filePath)
  .pipe(csv())
  .on('data', (row) => {
    totalRows++;

    // Check missing values
    for (const key of Object.keys(missingCounts)) {
      const val = row[key];
      if (val === undefined || val === null || String(val).trim() === '') {
        missingCounts[key]++;
      }
    }

    const isInbound = String(row.inbound).trim().toLowerCase() === 'true';
    const author = String(row.author_id).trim();
    const inResponseTo = row.in_response_to_tweet_id ? String(row.in_response_to_tweet_id).trim() : '';
    const responseTweetId = row.response_tweet_id ? String(row.response_tweet_id).trim() : '';

    if (responseTweetId.includes(',')) {
      multiResponseCount++;
    }

    if (isInbound) {
      inboundCount++;
      totalCustomerAuthorOccurrences++;
      if (sampleCustomerAuthors.size < 500000 && author) {
        sampleCustomerAuthors.add(author);
      }
      if (responseTweetId !== '') {
        inboundWithResponseTweetId++;
      }
    } else {
      outboundCount++;
      if (inResponseTo !== '') {
        outboundWithInResponseTo++;
      }

      if (author) {
        if (!brandStats.has(author)) {
          brandStats.set(author, {
            brand: author,
            totalReplies: 0,
            directReplies: 0, // has in_response_to_tweet_id
            multiRepliesTriggered: 0, // response_tweet_id has multiple
          });
        }
        const b = brandStats.get(author);
        b.totalReplies++;
        if (inResponseTo !== '') {
          b.directReplies++;
        }
        if (responseTweetId.includes(',')) {
          b.multiRepliesTriggered++;
        }
      }
    }

    if (totalRows % 500000 === 0) {
      const sec = ((Date.now() - lastLap) / 1000).toFixed(1);
      const memMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0);
      console.log(`Processed ${totalRows.toLocaleString()} rows (${sec}s, Heap: ${memMB} MB)...`);
      lastLap = Date.now();
    }
  })
  .on('end', () => {
    const totalDurationSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n===============================================================`);
    console.log(`DATASET SUMMARY (Processed in ${totalDurationSec}s)`);
    console.log(`===============================================================`);
    console.log(`Total Rows: ${totalRows.toLocaleString()}`);
    console.log(`Inbound (Customer) Tweets: ${inboundCount.toLocaleString()} (${((inboundCount / totalRows) * 100).toFixed(2)}%)`);
    console.log(`Outbound (Support) Tweets: ${outboundCount.toLocaleString()} (${((outboundCount / totalRows) * 100).toFixed(2)}%)`);
    console.log(`Unique Brand Handles: ${brandStats.size}`);
    console.log(`Customer Authors (Sampled Unique Count): >= ${sampleCustomerAuthors.size.toLocaleString()}`);

    console.log(`\n--- Missing Value Analysis ---`);
    for (const [col, count] of Object.entries(missingCounts)) {
      const pct = ((count / totalRows) * 100).toFixed(2);
      console.log(`  ${col.padEnd(26)}: ${count.toLocaleString().padStart(10)} missing (${pct}%)`);
    }

    console.log(`\n--- Response Linkage Quality ---`);
    const outboundDirectPct = ((outboundWithInResponseTo / outboundCount) * 100).toFixed(2);
    const inboundRespPct = ((inboundWithResponseTweetId / inboundCount) * 100).toFixed(2);
    console.log(`  Outbound replies with in_response_to_tweet_id: ${outboundWithInResponseTo.toLocaleString()} / ${outboundCount.toLocaleString()} (${outboundDirectPct}%)`);
    console.log(`  Inbound tweets with response_tweet_id:         ${inboundWithResponseTweetId.toLocaleString()} / ${inboundCount.toLocaleString()} (${inboundRespPct}%)`);
    console.log(`  Tweets with comma-separated multi-responses:   ${multiResponseCount.toLocaleString()}`);

    const sortedBrands = Array.from(brandStats.values())
      .sort((a, b) => b.totalReplies - a.totalReplies);

    console.log(`\n--- Top 20 Candidate Support Brands (by Outbound Support Tweets) ---`);
    console.log('-----------------------------------------------------------------------------------------');
    console.log(
      '#'.padStart(3) + ' ' +
      'Brand Handle'.padEnd(22) +
      'Total Support Tweets'.padStart(22) +
      'Direct Linked Replies'.padStart(24) +
      'Linkage %'.padStart(12)
    );
    console.log('-----------------------------------------------------------------------------------------');

    sortedBrands.slice(0, 20).forEach((b, idx) => {
      const pct = ((b.directReplies / b.totalReplies) * 100).toFixed(1) + '%';
      console.log(
        String(idx + 1).padStart(3) + ' ' +
        b.brand.padEnd(22) +
        b.totalReplies.toLocaleString().padStart(22) +
        b.directReplies.toLocaleString().padStart(24) +
        pct.padStart(12)
      );
    });
    console.log('-----------------------------------------------------------------------------------------');

    // Save report to disk for reference
    const reportData = {
      totalRows,
      inboundCount,
      outboundCount,
      inboundPercent: Number(((inboundCount / totalRows) * 100).toFixed(2)),
      outboundPercent: Number(((outboundCount / totalRows) * 100).toFixed(2)),
      uniqueBrandsCount: brandStats.size,
      missingCounts,
      linkage: {
        outboundWithInResponseTo,
        outboundDirectPercent: Number(outboundDirectPct),
        inboundWithResponseTweetId,
        inboundResponsePercent: Number(inboundRespPct),
        multiResponseCount
      },
      topBrands: sortedBrands.slice(0, 30)
    };

    fs.mkdirSync(config.processedDataDir, { recursive: true });
    fs.writeFileSync(
      path.join(config.processedDataDir, 'dataset_analysis.json'),
      JSON.stringify(reportData, null, 2)
    );
    console.log(`\nFull metrics saved to: ${path.join(config.processedDataDir, 'dataset_analysis.json')}`);
  })
  .on('error', (err) => {
    console.error('Error in analyze-brands:', err);
    process.exit(1);
  });
