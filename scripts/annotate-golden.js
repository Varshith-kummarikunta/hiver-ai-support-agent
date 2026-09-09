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
  const annotatorName = process.argv[2] || 'Varshith';
  const items = loadGoldenSet();

  const total = items.length;
  let labelledCount = items.filter(it => it.humanLabel !== null).length;

  console.log('===============================================================');
  console.log('APPLE SUPPORT GOLDEN SET — HUMAN ANNOTATION & REVIEW CLI');
  console.log('===============================================================');
  console.log(`Reviewing Annotator: ${annotatorName}`);
  console.log(`Current Progress: ${labelledCount} / ${total} human-labelled (${((labelledCount / total) * 100).toFixed(1)}%)\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (query) => new Promise(resolve => rl.question(query, resolve));

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.humanLabel !== null) continue; // Skip already verified/labelled records

    console.log('---------------------------------------------------------------');
    console.log(`[Item ${i + 1} of ${total}] — Golden ID: ${item.goldenId} (Tweet: ${item.tweetId})`);
    console.log('---------------------------------------------------------------');
    console.log(`Customer Message:\n"${item.customerTextClean}"\n`);

    const proposedIndex = INTENTS.findIndex(it => it.key === item.automaticProposedLabel) + 1;
    console.log(`AI Proposed: [${proposedIndex}] ${item.automaticProposedLabel} (Conf: ${item.automaticConfidence})`);
    console.log(`Rationale:   ${item.automaticReason}\n`);

    console.log('Choose Option:');
    console.log(`  [Enter] Accept AI proposal (${item.automaticProposedLabel})`);
    INTENTS.forEach((intent, idx) => {
      console.log(`  [${idx + 1}]     Override: ${intent.key.padEnd(24)} (${intent.name})`);
    });
    console.log(`  [s]     Skip this item`);
    console.log(`  [r]     View raw tweet text`);
    console.log(`  [q]     Save & Quit`);

    let doneWithItem = false;
    while (!doneWithItem) {
      const ans = (await question('\nSelection (Enter, 1-10, s, r, q): ')).trim().toLowerCase();

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

      if (ans === '') {
        // Accept proposal
        item.humanLabel = item.automaticProposedLabel;
        item.labelReason = item.automaticReason;
        item.annotator = annotatorName;
        item.annotatedAt = new Date().toISOString();

        saveGoldenSet(items);
        labelledCount++;
        console.log(`-> Approved: ${item.humanLabel} (Saved!)`);
        console.log(`Progress: ${labelledCount} / ${total} (${((labelledCount / total) * 100).toFixed(1)}%)\n`);
        doneWithItem = true;
        continue;
      }

      const num = parseInt(ans, 10);
      if (num >= 1 && num <= 10) {
        const chosenIntent = INTENTS[num - 1].key;
        item.humanLabel = chosenIntent;
        item.labelReason = `Manual human assignment overriding proposal`;
        item.annotator = annotatorName;
        item.annotatedAt = new Date().toISOString();

        saveGoldenSet(items);
        labelledCount++;
        console.log(`-> Overridden with: ${chosenIntent} (Saved!)`);
        console.log(`Progress: ${labelledCount} / ${total} (${((labelledCount / total) * 100).toFixed(1)}%)\n`);
        doneWithItem = true;
      } else {
        console.log('Invalid option. Press Enter to accept proposal, 1-10 to override, s to skip, or q to quit.');
      }
    }
  }

  console.log('\n🎉 All 200 golden evaluation items have been human-reviewed and labelled!');
  rl.close();
}

startAnnotation().catch(console.error);
