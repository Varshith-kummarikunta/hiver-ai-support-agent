import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import config from '../src/config/index.js';

console.log('Measuring inbound customer inquiries for top candidates...\n');

const candidates = ['AmazonHelp', 'AppleSupport', 'Uber_Support', 'SpotifyCares', 'Delta'];
const candidateStats = {};
candidates.forEach(c => {
  candidateStats[c.toLowerCase()] = {
    brand: c,
    inboundTotal: 0,
    initialInquiries: 0, // inbound where in_response_to_tweet_id is empty
    sampleInquiries: []
  };
});

fs.createReadStream(config.rawdataPath)
  .pipe(csv())
  .on('data', (row) => {
    const isInbound = String(row.inbound).trim().toLowerCase() === 'true';
    if (!isInbound) return;

    const text = String(row.text || '');
    const isInitial = !row.in_response_to_tweet_id || String(row.in_response_to_tweet_id).trim() === '';

    for (const [key, stats] of Object.entries(candidateStats)) {
      if (text.toLowerCase().includes('@' + key)) {
        stats.inboundTotal++;
        if (isInitial) {
          stats.initialInquiries++;
          if (stats.sampleInquiries.length < 3) {
            stats.sampleInquiries.push({
              tweet_id: row.tweet_id,
              author_id: row.author_id,
              text: row.text.trim()
            });
          }
        }
      }
    }
  })
  .on('end', () => {
    console.log('Top Candidate Brands: Inbound Customer Message Analysis:');
    console.log('-----------------------------------------------------------------------------------------');
    console.log(
      'Brand'.padEnd(16) +
      'Inbound Tweets'.padStart(16) +
      'Initial Inquiries'.padStart(20) +
      '% Initial'.padStart(14)
    );
    console.log('-----------------------------------------------------------------------------------------');

    for (const stats of Object.values(candidateStats)) {
      const initPct = ((stats.initialInquiries / stats.inboundTotal) * 100).toFixed(1) + '%';
      console.log(
        stats.brand.padEnd(16) +
        stats.inboundTotal.toLocaleString().padStart(16) +
        stats.initialInquiries.toLocaleString().padStart(20) +
        initPct.padStart(14)
      );
    }
    console.log('-----------------------------------------------------------------------------------------');

    console.log('\nSample Initial Customer Inquiries per Brand:');
    for (const stats of Object.values(candidateStats)) {
      console.log(`\n[${stats.brand}]`);
      stats.sampleInquiries.forEach((s, idx) => {
        console.log(`  ${idx + 1}. [User ${s.author_id}]: ${s.text}`);
      });
    }

    fs.writeFileSync(
      path.join(config.processedDataDir, 'candidate_inbound_analysis.json'),
      JSON.stringify(candidateStats, null, 2)
    );
  });
