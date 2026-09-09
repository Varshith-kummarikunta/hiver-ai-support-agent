import fs from 'fs';
import readline from 'readline';
import path from 'path';
import config from '../src/config/index.js';

console.log('Testing refined 9-intent taxonomy on AppleSupport initial inquiries...\n');

const pairsPath = path.join(config.processedDataDir, 'applesupport_pairs.jsonl');

const TAXONOMY = {
  battery_power: {
    id: 'battery_power',
    name: 'Battery & Power Performance',
    keywords: ['battery', 'drain', 'draining', 'drained', 'charge', 'charging', 'charger', 'overheating', 'overheat', 'dies', 'dying', 'powers off', 'shut off', 'shutting off', 'percentage']
  },
  keyboard_typing: {
    id: 'keyboard_typing',
    name: 'Keyboard, Typing & Autocorrect Bug',
    keywords: ['keyboard', 'autocorrect', 'auto correct', 'typing', 'type', 'predictive', 'question mark', 'mark box', 'letter i', 'capital i', 'capital "i"', 'capital “i”', 'emoji', 'emojis', 'spacebar']
  },
  software_update: {
    id: 'software_update',
    name: 'OS Update & Installation Issues',
    keywords: ['update', 'updated', 'updating', 'ios11', 'ios 11', 'high sierra', 'upgrade', 'install', 'installing', 'firmware', 'restore', 'restoring', 'downgrade', 'unable to verify', 'an error occurred']
  },
  display_hardware: {
    id: 'display_hardware',
    name: 'Screen, Touch & Physical Freeze',
    keywords: ['screen', 'touch', 'display', 'freeze', 'freezes', 'freezing', 'frozen', 'unresponsive', 'black screen', 'glitch', 'glitching', 'cracked', 'shattered', 'home button', 'face id']
  },
  audio_media: {
    id: 'audio_media',
    name: 'Apple Music, Audio & Media Playback',
    keywords: ['music', 'itunes', 'song', 'songs', 'playlist', 'playlists', 'album', 'sound', 'speaker', 'speakers', 'volume', 'headphone', 'headphones', 'earpod', 'earpods', 'airpod', 'airpods']
  },
  connectivity_network: {
    id: 'connectivity_network',
    name: 'Connectivity, Wi-Fi & Bluetooth',
    keywords: ['wifi', 'wi fi', 'bluetooth', 'connect', 'connecting', 'connection', 'cellular', 'signal', 'service', 'airdrop', 'hotspot', 'lte', 'network', 'sim', 'pairing', 'pair']
  },
  account_icloud: {
    id: 'account_icloud',
    name: 'Apple ID, iCloud & Account Security',
    keywords: ['icloud', 'apple id', 'appleid', 'account', 'password', 'passcode', 'locked', 'unlock', 'verification', 'verify', 'backup', 'back up', 'storage', 'two factor', '2fa', 'security question']
  },
  billing_subscriptions: {
    id: 'billing_subscriptions',
    name: 'Billing, App Store Purchases & Refunds',
    keywords: ['charge', 'charged', 'charges', 'billing', 'bill', 'subscription', 'subscribe', 'refund', 'purchase', 'purchased', 'receipt', 'card', 'payment', 'paid', 'declined']
  },
  apps_appstore: {
    id: 'apps_appstore',
    name: 'App Store Downloads & App Performance',
    keywords: ['app store', 'apps', 'app', 'download', 'downloading', 'installing app', 'crashing', 'crashes', 'youtube', 'whatsapp', 'instagram', 'twitter app', 'spotify']
  }
};

// Priority ordering when multiple keywords match:
// If customer mentions "battery drain after update", battery_power is the functional symptom, update is context!
const PRIORITY_ORDER = [
  'keyboard_typing',     // Autocorrect / typing bug is highly specific
  'battery_power',       // Specific power symptom
  'billing_subscriptions', // Financial/purchase issue
  'account_icloud',      // Account/security access
  'connectivity_network',// Wireless/network symptom
  'audio_media',         // Audio/music symptom
  'display_hardware',    // Screen/touch freeze symptom
  'apps_appstore',       // App crash / download
  'software_update'      // OS installation / update failure (fallback if no specific symptom)
];

async function runAnalysis() {
  const rl = readline.createInterface({
    input: fs.createReadStream(pairsPath),
    crlfDelay: Infinity
  });

  const intentCounts = {};
  const intentSamples = {};
  for (const k of Object.keys(TAXONOMY)) {
    intentCounts[k] = 0;
    intentSamples[k] = [];
  }

  let totalInquiries = 0;
  let classifiedCount = 0;
  let unclassifiedCount = 0;
  const unclassifiedSamples = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    const pair = JSON.parse(line);
    if (!pair.isInitialInquiry) continue;

    totalInquiries++;
    const text = (pair.customerTextClean || '').toLowerCase();

    // Check matches
    const matched = [];
    for (const [id, def] of Object.entries(TAXONOMY)) {
      const hits = def.keywords.some(kw => {
        const reg = new RegExp(`\\b${kw.replace(/ /g, '\\s+')}\\b`, 'i');
        return reg.test(text);
      });
      if (hits) matched.push(id);
    }

    // Special regex check for the iOS 11.1 capital I bug where users literally type "why does my I..."
    if (/\bwhy\s+(?:does|is)\s+my\s+i\s+(?:keep|not)\b/i.test(text) || /\bi['’]s?\s+changing\b/i.test(text)) {
      if (!matched.includes('keyboard_typing')) matched.push('keyboard_typing');
    }

    let assignedIntent = null;
    if (matched.length === 1) {
      assignedIntent = matched[0];
    } else if (matched.length > 1) {
      // Use explicit priority rule
      for (const p of PRIORITY_ORDER) {
        if (matched.includes(p)) {
          assignedIntent = p;
          break;
        }
      }
    }

    if (assignedIntent) {
      classifiedCount++;
      intentCounts[assignedIntent]++;
      if (intentSamples[assignedIntent].length < 5) {
        intentSamples[assignedIntent].push({
          tweetId: pair.customerTweetId,
          customerText: pair.customerTextClean,
          supportText: pair.supportTextClean
        });
      }
    } else {
      unclassifiedCount++;
      if (unclassifiedSamples.length < 10) {
        unclassifiedSamples.push({
          tweetId: pair.customerTweetId,
          text: pair.customerTextClean
        });
      }
    }
  }

  console.log(`Total Initial Inquiries: ${totalInquiries.toLocaleString()}`);
  console.log(`Classified into 9 Intents: ${classifiedCount.toLocaleString()} (${((classifiedCount / totalInquiries) * 100).toFixed(1)}%)`);
  console.log(`Unclassified / General Noise: ${unclassifiedCount.toLocaleString()} (${((unclassifiedCount / totalInquiries) * 100).toFixed(1)}%)\n`);

  console.log('--- Intent Distribution & Representation ---');
  console.log('---------------------------------------------------------------------------------------------');
  console.log(
    '#'.padStart(2) + ' ' +
    'Intent ID'.padEnd(24) +
    'Count'.padStart(12) +
    'Share %'.padStart(10) +
    'Intent Display Name'.padEnd(42)
  );
  console.log('---------------------------------------------------------------------------------------------');

  const sorted = Object.keys(TAXONOMY).sort((a, b) => intentCounts[b] - intentCounts[a]);
  sorted.forEach((id, idx) => {
    const count = intentCounts[id];
    const pct = ((count / totalInquiries) * 100).toFixed(1) + '%';
    console.log(
      String(idx + 1).padStart(2) + ' ' +
      id.padEnd(24) +
      count.toLocaleString().padStart(12) +
      pct.padStart(10) + '  ' +
      TAXONOMY[id].name.padEnd(40)
    );
  });
  console.log('---------------------------------------------------------------------------------------------');

  console.log('\n--- Representative Real Customer Examples per Intent ---');
  sorted.forEach(id => {
    console.log(`\n[${id.toUpperCase()} — ${TAXONOMY[id].name}] (${intentCounts[id].toLocaleString()} cases)`);
    intentSamples[id].forEach((s, i) => {
      console.log(`  Ex ${i + 1} (Tweet ${s.tweetId}): "${s.customerText}"`);
    });
  });

  console.log('\n--- Sample Unclassified Queries (Inspecting the 30% remainder) ---');
  unclassifiedSamples.slice(0, 6).forEach((u, i) => {
    console.log(`  ${i + 1}. (Tweet ${u.tweetId}): "${u.text}"`);
  });

  // Save intent taxonomy data
  const taxonomyOutput = {
    totalInquiries,
    classifiedCount,
    classifiedPercent: Number(((classifiedCount / totalInquiries) * 100).toFixed(2)),
    unclassifiedCount,
    unclassifiedPercent: Number(((unclassifiedCount / totalInquiries) * 100).toFixed(2)),
    intents: sorted.map((id, idx) => ({
      rank: idx + 1,
      id,
      name: TAXONOMY[id].name,
      count: intentCounts[id],
      percentage: Number(((intentCounts[id] / totalInquiries) * 100).toFixed(2)),
      keywords: TAXONOMY[id].keywords,
      examples: intentSamples[id]
    }))
  };

  fs.writeFileSync(
    path.join(config.processedDataDir, 'intent-taxonomy.json'),
    JSON.stringify(taxonomyOutput, null, 2)
  );
  console.log(`\nSaved machine-readable taxonomy to data/processed/intent-taxonomy.json`);
}

runAnalysis().catch(console.error);
