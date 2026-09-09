import fs from 'fs';
import readline from 'readline';
import path from 'path';
import config from '../src/config/index.js';

const pairsPath = path.join(config.processedDataDir, 'applesupport_pairs.jsonl');

async function checkAppSubtopics() {
  const rl = readline.createInterface({
    input: fs.createReadStream(pairsPath),
    crlfDelay: Infinity
  });

  let appStoreCount = 0;
  let thirdPartyCrashCount = 0;
  let firstPartyAppCount = 0;
  const appStoreExamples = [];
  const thirdPartyExamples = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    const pair = JSON.parse(line);
    if (!pair.isInitialInquiry) continue;

    const text = (pair.customerTextClean || '').toLowerCase();

    const isAppStore = /\b(app store|appstore|downloading apps?|download apps?|update apps?|updating apps?|waiting\.\.\.|circle spinning)\b/i.test(text);
    const isThirdParty = /\b(youtube|spotify|whatsapp|instagram|facebook|twitter app|snapchat|netflix)\b/i.test(text);
    const isFirstParty = /\b(camera app|photos app|mail app|notes app|messages app|safari app|maps app)\b/i.test(text);

    if (isAppStore) {
      appStoreCount++;
      if (appStoreExamples.length < 5) appStoreExamples.push({ id: pair.customerTweetId, text: pair.customerTextClean });
    }
    if (isThirdParty) {
      thirdPartyCrashCount++;
      if (thirdPartyExamples.length < 5) thirdPartyExamples.push({ id: pair.customerTweetId, text: pair.customerTextClean });
    }
    if (isFirstParty) firstPartyAppCount++;
  }

  console.log(`App Store Platform / Download inquiries: ${appStoreCount.toLocaleString()}`);
  console.log(`Third-party app-specific inquiries: ${thirdPartyCrashCount.toLocaleString()}`);
  console.log(`First-party iOS app inquiries (Camera, Mail, Safari, Photos): ${firstPartyAppCount.toLocaleString()}`);
  
  console.log('\nApp Store Samples:');
  appStoreExamples.forEach(e => console.log(`  - [${e.id}]: "${e.text}"`));
  console.log('\nThird-Party App Samples:');
  thirdPartyExamples.forEach(e => console.log(`  - [${e.id}]: "${e.text}"`));
}

checkAppSubtopics().catch(console.error);
