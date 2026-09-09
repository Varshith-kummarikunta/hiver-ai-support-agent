import fs from 'fs';
import readline from 'readline';
import path from 'path';
import config from '../src/config/index.js';

console.log('===============================================================');
console.log('PHASE 2B: Intent Boundary Definition & Coverage Analysis');
console.log('===============================================================\n');

const pairsPath = path.join(config.processedDataDir, 'applesupport_pairs.jsonl');

// Explicit intent keyword/pattern signatures derived from n-gram analysis
const INTENT_PATTERNS = {
  battery_power: {
    name: 'Battery & Power Performance',
    keywords: ['battery', 'drain', 'draining', 'drained', 'charge', 'charging', 'charger', 'overheating', 'overheat', 'percent', 'percentage', 'dies', 'dying', 'turn off', 'powers off']
  },
  software_update: {
    name: 'Software Update & OS Installation',
    keywords: ['update', 'updated', 'updating', 'ios11', 'ios 11', 'high sierra', 'upgrade', 'upgraded', 'install', 'installing', 'firmware', 'restore', 'restoring', 'downgrade']
  },
  keyboard_input: {
    name: 'Keyboard & Predictive Text Glitches',
    keywords: ['keyboard', 'autocorrect', 'auto correct', 'typing', 'type', 'predictive', 'question mark', 'question marks', 'mark box', 'letter', 'capital', 'emoji', 'emojis']
  },
  display_touch: {
    name: 'Screen, Touch & Display Freezing',
    keywords: ['screen', 'touch', 'display', 'freeze', 'freezes', 'freezing', 'frozen', 'unresponsive', 'black screen', 'glitch', 'glitching', 'cracked', 'shattered']
  },
  audio_media: {
    name: 'Apple Music, iTunes & Media Playback',
    keywords: ['music', 'itunes', 'song', 'songs', 'playlist', 'playlists', 'album', 'sound', 'speaker', 'speakers', 'volume', 'headphone', 'headphones', 'earpod', 'earpods', 'airpod', 'airpods']
  },
  connectivity_network: {
    name: 'Connectivity, Wi-Fi & Bluetooth',
    keywords: ['wifi', 'wi fi', 'bluetooth', 'connect', 'connecting', 'connection', 'cellular', 'signal', 'service', 'airdrop', 'hotspot', 'lte', 'network', 'sim']
  },
  account_icloud: {
    name: 'Apple ID, iCloud & Security Access',
    keywords: ['icloud', 'apple id', 'appleid', 'account', 'password', 'passcode', 'locked', 'lock', 'unlock', 'verification', 'verify', 'backup', 'back up', 'storage', 'two factor', '2fa']
  },
  billing_purchases: {
    name: 'App Store Purchases & Subscriptions',
    keywords: ['charge', 'charged', 'charges', 'billing', 'bill', 'subscription', 'subscribe', 'refund', 'purchase', 'purchased', 'receipt', 'card', 'payment', 'paid', 'credit']
  }
};

async function evaluateTaxonomy() {
  const rl = readline.createInterface({
    input: fs.createReadStream(pairsPath),
    crlfDelay: Infinity
  });

  const intentCounts = {};
  const intentExclusiveCounts = {};
  const intentSamples = {};
  for (const k of Object.keys(INTENT_PATTERNS)) {
    intentCounts[k] = 0;
    intentExclusiveCounts[k] = 0;
    intentSamples[k] = [];
  }

  let totalInquiries = 0;
  let singleIntentCount = 0;
  let multiIntentCount = 0;
  let zeroIntentCount = 0;
  const multiIntentPairs = new Map();
  const unmatchedSamples = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    const pair = JSON.parse(line);
    if (!pair.isInitialInquiry) continue;

    totalInquiries++;
    const text = (pair.customerTextClean || '').toLowerCase();

    const matchedIntents = [];
    for (const [intentKey, def] of Object.entries(INTENT_PATTERNS)) {
      const isMatched = def.keywords.some(kw => {
        // match word boundary
        const regex = new RegExp(`\\b${kw.replace(/ /g, '\\s+')}\\b`, 'i');
        return regex.test(text);
      });

      if (isMatched) {
        matchedIntents.push(intentKey);
      }
    }

    if (matchedIntents.length === 0) {
      zeroIntentCount++;
      if (unmatchedSamples.length < 15) {
        unmatchedSamples.push({
          id: pair.customerTweetId,
          text: pair.customerTextClean,
          reply: pair.supportTextClean
        });
      }
    } else if (matchedIntents.length === 1) {
      singleIntentCount++;
      const key = matchedIntents[0];
      intentCounts[key]++;
      intentExclusiveCounts[key]++;
      if (intentSamples[key].length < 5) {
        intentSamples[key].push({
          id: pair.customerTweetId,
          text: pair.customerTextClean,
          reply: pair.supportTextClean
        });
      }
    } else {
      multiIntentCount++;
      matchedIntents.forEach(key => {
        intentCounts[key]++;
      });
      // track multi-intent co-occurrences
      const combo = matchedIntents.sort().join(' + ');
      multiIntentPairs.set(combo, (multiIntentPairs.get(combo) || 0) + 1);
    }
  }

  console.log(`Total Initial Inquiries Analyzed: ${totalInquiries.toLocaleString()}`);
  console.log(`Explicitly Matched (1+ intents): ${(totalInquiries - zeroIntentCount).toLocaleString()} (${(((totalInquiries - zeroIntentCount) / totalInquiries) * 100).toFixed(1)}%)`);
  console.log(`Single Intent (Unambiguous): ${singleIntentCount.toLocaleString()} (${((singleIntentCount / totalInquiries) * 100).toFixed(1)}%)`);
  console.log(`Multi-Intent Co-occurrences: ${multiIntentCount.toLocaleString()} (${((multiIntentCount / totalInquiries) * 100).toFixed(1)}%)`);
  console.log(`Zero Pattern Matches: ${zeroIntentCount.toLocaleString()} (${((zeroIntentCount / totalInquiries) * 100).toFixed(1)}%)\n`);

  console.log('--- Candidate Intent Coverage (Initial Inquiries) ---');
  console.log('-----------------------------------------------------------------------------------------');
  console.log(
    'Intent ID'.padEnd(24) +
    'Total Matches'.padStart(14) +
    '% of All'.padStart(10) +
    'Exclusive'.padStart(14) +
    '% Excl'.padStart(10)
  );
  console.log('-----------------------------------------------------------------------------------------');

  const sortedIntents = Object.keys(INTENT_PATTERNS).sort((a, b) => intentCounts[b] - intentCounts[a]);
  sortedIntents.forEach(key => {
    const total = intentCounts[key];
    const excl = intentExclusiveCounts[key];
    const totalPct = ((total / totalInquiries) * 100).toFixed(1) + '%';
    const exclPct = ((excl / totalInquiries) * 100).toFixed(1) + '%';
    console.log(
      key.padEnd(24) +
      total.toLocaleString().padStart(14) +
      totalPct.padStart(10) +
      excl.toLocaleString().padStart(14) +
      exclPct.padStart(10)
    );
  });
  console.log('-----------------------------------------------------------------------------------------');

  console.log('\n--- Top 10 Multi-Intent Co-occurrences (Overlap Analysis) ---');
  const sortedCombos = Array.from(multiIntentPairs.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  sortedCombos.forEach(([combo, count]) => {
    console.log(`  ${combo.padEnd(50)}: ${count.toLocaleString()} occurrences`);
  });

  console.log('\n--- Sample Zero-Pattern Matches (What did we miss?) ---');
  unmatchedSamples.slice(0, 8).forEach((s, idx) => {
    console.log(`  ${idx + 1}. [Tweet ${s.id}]: "${s.text}"`);
  });

  // Export discovery summary
  const summary = {
    totalInquiries,
    singleIntentCount,
    multiIntentCount,
    zeroIntentCount,
    intentCounts,
    intentExclusiveCounts,
    intentSamples,
    topCoOccurrences: sortedCombos,
    unmatchedSamples
  };

  fs.writeFileSync(
    path.join(config.processedDataDir, 'intent_discovery_summary.json'),
    JSON.stringify(summary, null, 2)
  );
  console.log(`\nSummary saved to data/processed/intent_discovery_summary.json`);
}

evaluateTaxonomy().catch(console.error);
