import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import config from '../src/config/index.js';
import { cleanTweetText, extractEntities, unescapeHtml } from '../src/data/cleaner.js';

console.log('===============================================================');
console.log('PHASE 2A: Prepare AppleSupport Interaction Pairs');
console.log('===============================================================\n');

const rawPath = config.rawdataPath;
const outputJsonlPath = path.join(config.processedDataDir, 'applesupport_pairs.jsonl');
const outputStatsPath = path.join(config.processedDataDir, 'applesupport_pair_stats.json');

if (!fs.existsSync(rawPath)) {
  console.error(`[BLOCKER] Raw dataset not found at ${rawPath}`);
  process.exit(1);
}

fs.mkdirSync(config.processedDataDir, { recursive: true });

console.log('Pass 1/2: Indexing AppleSupport outbound support tweets...');
const supportByInResponseTo = new Map();
const allSupportTweetIds = new Set();
let totalSupportTweets = 0;
let supportWithoutInResponseTo = 0;
let duplicateInResponseToCount = 0;

let pass1Start = Date.now();

fs.createReadStream(rawPath)
  .pipe(csv())
  .on('data', (row) => {
    const isInbound = String(row.inbound).trim().toLowerCase() === 'true';
    const author = String(row.author_id).trim().toLowerCase();

    if (!isInbound && author === 'applesupport') {
      totalSupportTweets++;
      const tweetId = String(row.tweet_id).trim();
      allSupportTweetIds.add(tweetId);

      const inResponseTo = row.in_response_to_tweet_id ? String(row.in_response_to_tweet_id).trim() : '';

      if (!inResponseTo) {
        supportWithoutInResponseTo++;
      } else {
        if (supportByInResponseTo.has(inResponseTo)) {
          duplicateInResponseToCount++;
          // Append to array of replies for this customer tweet
          const existing = supportByInResponseTo.get(inResponseTo);
          if (Array.isArray(existing)) {
            existing.push(row);
          } else {
            supportByInResponseTo.set(inResponseTo, [existing, row]);
          }
        } else {
          supportByInResponseTo.set(inResponseTo, row);
        }
      }
    }
  })
  .on('end', () => {
    const pass1Duration = ((Date.now() - pass1Start) / 1000).toFixed(1);
    console.log(`Pass 1 completed in ${pass1Duration}s.`);
    console.log(`  Total AppleSupport outbound tweets: ${totalSupportTweets.toLocaleString()}`);
    console.log(`  AppleSupport replies with in_response_to_tweet_id: ${(totalSupportTweets - supportWithoutInResponseTo).toLocaleString()}`);
    console.log(`  Unmatched outbound tweets (no parent ID): ${supportWithoutInResponseTo.toLocaleString()}`);
    console.log(`  Customer tweets receiving multiple Apple replies: ${duplicateInResponseToCount.toLocaleString()}`);
    console.log(`  Unique target customer tweet IDs to find: ${supportByInResponseTo.size.toLocaleString()}\n`);

    startPass2();
  })
  .on('error', (err) => {
    console.error('Error during Pass 1:', err);
    process.exit(1);
  });

function startPass2() {
  console.log('Pass 2/2: Extracting customer inquiries, normalizing text, and constructing pairs...');
  const pass2Start = Date.now();

  const writeStream = fs.createWriteStream(outputJsonlPath, { flags: 'w', encoding: 'utf8' });

  let totalCsvRows = 0;
  let totalInboundTweets = 0;
  let inboundMentioningApple = 0;
  let validPairsConstructed = 0;
  let initialInquiryPairs = 0;
  let followUpInquiryPairs = 0;
  let emptyOrInvalidTextPairs = 0;
  let multiResponseCount = 0;
  const matchedCustomerTweetIds = new Set();

  let normalizationStats = {
    htmlEntitiesUnescaped: 0,
    urlsStripped: 0,
    mentionsStripped: 0,
    glitchCharsStripped: 0
  };

  fs.createReadStream(rawPath)
    .pipe(csv())
    .on('data', (row) => {
      totalCsvRows++;
      const isInbound = String(row.inbound).trim().toLowerCase() === 'true';
      if (!isInbound) return;

      totalInboundTweets++;
      const rawText = String(row.text || '');
      const customerTweetId = String(row.tweet_id).trim();

      if (rawText.toLowerCase().includes('@applesupport')) {
        inboundMentioningApple++;
      }

      if (supportByInResponseTo.has(customerTweetId)) {
        matchedCustomerTweetIds.add(customerTweetId);
        const supportData = supportByInResponseTo.get(customerTweetId);
        // If multiple replies exist, pick the first reply deterministically
        const primarySupportRow = Array.isArray(supportData) ? supportData[0] : supportData;

        const customerClean = cleanTweetText(rawText);
        const supportRaw = String(primarySupportRow.text || '');
        const supportClean = cleanTweetText(supportRaw);

        // Check if normalization made changes
        if (/&[a-z0-9#]+;/i.test(rawText)) normalizationStats.htmlEntitiesUnescaped++;
        if (/https?:\/\/t\.co\//i.test(rawText)) normalizationStats.urlsStripped++;
        if (/@\w+/i.test(rawText)) normalizationStats.mentionsStripped++;
        if (/[\uFE0F\u200D\uFFFD]/.test(rawText)) normalizationStats.glitchCharsStripped++;

        if (!customerClean || customerClean.length < 3) {
          emptyOrInvalidTextPairs++;
          return;
        }

        const isInitial = !row.in_response_to_tweet_id || String(row.in_response_to_tweet_id).trim() === '';
        if (isInitial) {
          initialInquiryPairs++;
        } else {
          followUpInquiryPairs++;
        }

        const respIds = row.response_tweet_id ? String(row.response_tweet_id).trim().split(',') : [];
        if (respIds.length > 1) {
          multiResponseCount++;
        }

        const customerEntities = extractEntities(rawText);
        const supportEntities = extractEntities(supportRaw);

        const pairRecord = {
          pairId: `pair_${customerTweetId}_${primarySupportRow.tweet_id}`,
          customerTweetId,
          customerAuthorId: String(row.author_id).trim(),
          customerCreatedAt: String(row.created_at).trim(),
          customerTextRaw: rawText,
          customerTextClean: customerClean,
          isInitialInquiry: isInitial,
          customerInResponseToId: isInitial ? null : String(row.in_response_to_tweet_id).trim(),
          customerResponseTweetIds: respIds,
          supportTweetId: String(primarySupportRow.tweet_id).trim(),
          supportAuthorId: 'AppleSupport',
          supportCreatedAt: String(primarySupportRow.created_at).trim(),
          supportTextRaw: supportRaw,
          supportTextClean: supportClean,
          allSupportRepliesCount: Array.isArray(supportData) ? supportData.length : 1,
          entities: {
            customerMentions: customerEntities.mentions,
            customerUrls: customerEntities.urls,
            supportMentions: supportEntities.mentions,
            supportUrls: supportEntities.urls
          }
        };

        writeStream.write(JSON.stringify(pairRecord) + '\n');
        validPairsConstructed++;
      }
    })
    .on('end', () => {
      writeStream.end();
      const pass2Duration = ((Date.now() - pass2Start) / 1000).toFixed(1);
      console.log(`Pass 2 completed in ${pass2Duration}s.`);
      console.log(`\n===============================================================`);
      console.log(`APPLESUPPORT PAIRING SUMMARY`);
      console.log(`===============================================================`);
      console.log(`Total Inbound Customer Tweets Encountered: ${totalInboundTweets.toLocaleString()}`);
      console.log(`Inbound Tweets explicitly mentioning @AppleSupport: ${inboundMentioningApple.toLocaleString()}`);
      console.log(`Valid Customer -> Support Pairs Constructed: ${validPairsConstructed.toLocaleString()}`);
      console.log(`  - Root / Initial Inquiry Pairs (isInitialInquiry: true): ${initialInquiryPairs.toLocaleString()} (${((initialInquiryPairs / validPairsConstructed) * 100).toFixed(1)}%)`);
      console.log(`  - Follow-up Interaction Pairs: ${followUpInquiryPairs.toLocaleString()} (${((followUpInquiryPairs / validPairsConstructed) * 100).toFixed(1)}%)`);
      console.log(`Unmatched AppleSupport outbound tweets: ${(totalSupportTweets - validPairsConstructed).toLocaleString()}`);
      console.log(`Inbound tweets with multi-response IDs: ${multiResponseCount.toLocaleString()}`);
      console.log(`Pairs dropped due to empty/too-short text: ${emptyOrInvalidTextPairs.toLocaleString()}`);

      console.log(`\n--- Normalization Stats ---`);
      console.log(`  HTML entities unescaped: ${normalizationStats.htmlEntitiesUnescaped.toLocaleString()}`);
      console.log(`  URLs stripped in clean text: ${normalizationStats.urlsStripped.toLocaleString()}`);
      console.log(`  Mentions stripped in clean text: ${normalizationStats.mentionsStripped.toLocaleString()}`);
      console.log(`  iOS unicode glitch chars stripped: ${normalizationStats.glitchCharsStripped.toLocaleString()}`);

      const statsOutput = {
        totalAppleSupportOutboundTweets: totalSupportTweets,
        outboundWithoutParentId: supportWithoutInResponseTo,
        duplicateInResponseToCount,
        uniqueTargetCustomerTweetIds: supportByInResponseTo.size,
        totalInboundTweetsInDataset: totalInboundTweets,
        inboundMentioningAppleSupport: inboundMentioningApple,
        validPairsConstructed,
        initialInquiryPairs,
        initialInquiryPercent: Number(((initialInquiryPairs / validPairsConstructed) * 100).toFixed(2)),
        followUpInquiryPairs,
        unmatchedSupportTweets: totalSupportTweets - validPairsConstructed,
        unmatchedInboundMentions: inboundMentioningApple - validPairsConstructed,
        emptyOrInvalidTextPairs,
        multiResponseCount,
        normalizationStats,
        processedTimestamp: new Date().toISOString()
      };

      fs.writeFileSync(outputStatsPath, JSON.stringify(statsOutput, null, 2));
      console.log(`\nPairs saved to: ${outputJsonlPath}`);
      console.log(`Stats saved to: ${outputStatsPath}`);
    })
    .on('error', (err) => {
      console.error('Error during Pass 2:', err);
      process.exit(1);
    });
}
