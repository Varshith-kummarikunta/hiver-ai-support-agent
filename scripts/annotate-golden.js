import fs from 'fs';
import path from 'path';
import readline from 'readline';
import config from '../src/config/index.js';

const goldenPath = path.join(config.projectRoot, 'data/golden/golden-set.jsonl');

const INTENTS = [
  { key: 'software_update', name: 'OS Update & Installation Issues' },
  { key: 'battery_power', name: 'Battery, Power & Charging Issues' },
  { key: 'display_hardware', name: 'Screen, Touch & Physical Hardware' },
  { key: 'keyboard_typing', name: 'Keyboard, Typing & Autocorrect Glitches' },
  { key: 'apps_appstore', name: 'App Store Downloads & App Performance' },
  { key: 'audio_media', name: 'Apple Music, Audio & Media Playback' },
  { key: 'account_icloud', name: 'Apple ID, iCloud & Account Security' },
  { key: 'connectivity_network', name: 'Wi-Fi, Bluetooth & Cellular Connectivity' },
  { key: 'billing_subscriptions', name: 'Billing, App Store Purchases & Refunds' },
  { key: 'other_unclear', name: 'Out-of-Scope / Vague / Retail Fallback' }
];

function loadGoldenSet() {
  if (!fs.existsSync(goldenPath)) {
    console.error(`Golden set not found at ${goldenPath}`);
    process.exit(1);
  }
  const lines = fs.readFileSync(goldenPath, 'utf8').split('\n').filter(Boolean);
  return lines.map(line => JSON.parse(line));
}

function saveGoldenSet(items) {
  const content = items.map(it => JSON.stringify(it)).join('\n') + '\n';
  fs.writeFileSync(goldenPath, content, 'utf8');
}

async function startAnnotation() {
  const annotatorName = process.argv[2] || 'human_annotator';
  const items = loadGoldenSet();

  const total = items.length;
  let labelledCount = items.filter(it => it.humanLabel !== null).length;

  console.log('===============================================================');
  console.log('APPLE SUPPORT GOLDEN SET — HUMAN ANNOTATION CLI');
  console.log('===============================================================');
  console.log(`Annotator: ${annotatorName}`);
  console.log(`Progress: ${labelledCount} / ${total} labelled (${((labelledCount / total) * 100).toFixed(1)}%)\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise(resolve => rl.question(query, resolve));

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.humanLabel !== null) continue; // skip already labelled

    console.log('---------------------------------------------------------------');
    console.log(`[Item ${i + 1} of ${total}] — Golden ID: ${item.goldenId} (Tweet: ${item.tweetId})`);
    console.log('---------------------------------------------------------------');
    console.log(`Customer Message:\n"${item.customerTextClean}"\n`);

    console.log('Select Intent:');
    INTENTS.forEach((intent, idx) => {
      console.log(`  [${idx + 1}] ${intent.key.padEnd(24)} (${intent.name})`);
    });
    console.log(`  [s] Skip this item`);
    console.log(`  [r] View raw tweet text`);
    console.log(`  [q] Save & Quit`);

    let doneWithItem = false;
    while (!doneWithItem) {
      const ans = (await question('\nEnter selection (1-10, s, r, q): ')).trim().toLowerCase();

      if (ans === 'q') {
        console.log('\nProgress saved. Exiting...');
        rl.close();
        return;
      }

      if (ans === 's') {
        console.log('Skipped.');
        doneWithItem = true;
        continue;
      }

      if (ans === 'r') {
        console.log(`\nRaw Text: "${item.customerTextRaw}"\n`);
        continue;
      }

      const num = parseInt(ans, 10);
      if (num >= 1 && num <= 10) {
        const chosenIntent = INTENTS[num - 1].key;
        item.humanLabel = chosenIntent;
        item.annotator = annotatorName;
        item.annotatedAt = new Date().toISOString();

        saveGoldenSet(items);
        labelledCount++;
        console.log(`-> Assigned: ${chosenIntent} (Saved!)`);
        console.log(`Progress: ${labelledCount} / ${total} (${((labelledCount / total) * 100).toFixed(1)}%)\n`);
        doneWithItem = true;
      } else {
        console.log('Invalid option. Please enter 1-10, s, r, or q.');
      }
    }
  }

  console.log('\n🎉 All 200 items have been labelled!');
  rl.close();
}

startAnnotation().catch(console.error);
