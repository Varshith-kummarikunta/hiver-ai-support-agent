import fs from 'fs';
import readline from 'readline';
import path from 'path';
import config from '../src/config/index.js';

const pairsPath = path.join(config.processedDataDir, 'applesupport_pairs.jsonl');

function normalizeText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/["“”]/g, ' ') // Convert double quotes to spaces so "I" becomes an isolated word
    .replace(/[‘’]/g, "'")  // Normalize curly single quotes to straight apostrophes
    .replace(/\s+/g, ' ');
}

export function classifyInquiry(cleanText, rawText) {
  const text = normalizeText(cleanText);
  const raw = normalizeText(rawText);

  // Negative guards for billing
  const isRepairBill = /\b(repair\s+bill|repair\s+cost|cost\s+to\s+repair|fix\s+my\s+screen|broken\s+screen|replace\s+my\s+screen|screen\s+repair|screen\s+replacement)\b/.test(text);
  const isCarrierBill = /\b(monthly\s+bill|phone\s+bill|carrier\s+bill|discount\s+on\s+my\s+bill)\b/.test(text) && !/\b(itunes|apple|app store)\b/.test(text);

  // 1. BILLING, PURCHASES & SUBSCRIPTIONS
  const isBilling = !isRepairBill && !isCarrierBill && (
    /\b(refund|refunded|requesting a refund|request a refund|get my money back)\b/.test(text) ||
    /\b(subscription|subscriptions|subscribed|cancel subscription|cancelling subscription)\b/.test(text) ||
    /\b(unauthorized charge|charged twice|double charged|why was i charged|charged for free app|random charge|unexpected charge|charged me twice|keep charging me)\b/.test(text) ||
    /\b(charged my (?:credit )?card|charging my (?:credit )?card)\b/.test(text) ||
    /\b(itunes (?:bill|receipt|charge|overcharged|gift card))\b/.test(text) ||
    /\b(apple gift card|redeem gift card|gift card code)\b/.test(text) ||
    /\b(payment (?:method )?declined|card (?:was )?declined|payment failed)\b/.test(text) ||
    (/\b(in-app purchase|in app purchase)\b/.test(text) && /\b(charge|paid|money|refund|billing)\b/.test(text))
  );

  // 2. KEYBOARD & TYPING BUG
  const isKeyboard = 
    /\b(keyboard|autocorrect|auto correct|predictive text|spacebar|dictation)\b/.test(text) ||
    /\bcapital\s+i\b/.test(text) ||
    /\bletter\s+i\b/.test(text) ||
    /\bwhy\s+(?:does|is)\s+(?:my\s+)?i\s+(?:keep|not)\b/.test(text) ||
    /\bi\s+(?:keep|keeps|is)\s+changing\b/.test(text) ||
    /\b(?:type|typing)\s+(?:the\s+)?letter\s+i\b/.test(text) ||
    /\bquestion mark\s*(?:box|\?|inside box)?\b/.test(text) ||
    /\ba\s+(?:and\s+a\s+)?question mark\b/.test(text) ||
    /\b(?:symbol|letter a)\s+instead of\s+i\b/.test(text) ||
    /\bi\s*\[\?\]\b/.test(text);

  // 3. BATTERY & POWER PERFORMANCE
  const isBattery = 
    /\b(battery|batteries|battery life|battery health)\b/.test(text) ||
    (/\b(drain|draining|drained)\b/.test(text) && !/\b(money|bank)\b/.test(text)) ||
    /\b(?:dies|dying|shutting off|shut down|powers? off)\s+(?:at|with)\s+\d+%/i.test(text) ||
    /\b(?:phone|iphone)\s+(?:is\s+)?(?:overheating|gets? hot|burning hot)\b/.test(text) ||
    (/\b(won't charge|wont charge|not charging|stopped charging|slow charging|charger|charging cable)\b/.test(text) && !/\b(credit|card|bill|fee|charged me)\b/.test(text));

  // 4. DISPLAY, TOUCH & PHYSICAL HARDWARE
  const isDisplayHardware = 
    isRepairBill ||
    /\b(screen|touchscreen|touch screen|display)\b/.test(text) && /\b(freeze|freezes|freezing|frozen|unresponsive|black|blank|white|flickering|flicker|lines|glitch|cracked|shattered|broken|not working|doesn't work|doesnt work|wont work|won't work|went black|turns black)\b/.test(text) ||
    /\b(black screen|blank screen|white screen|ghost touch|touch not working|unresponsive touch)\b/.test(text) ||
    /\b(home button|power button|side button|volume button|face id|touch id)\b/.test(text) && /\b(broken|stuck|not working|doesn't work|doesnt work|failed|stops working)\b/.test(text) ||
    /\b(?:phone|iphone|ipad)\s+(?:is\s+)?(?:completely\s+)?frozen\b/.test(text) ||
    /\b(screen\s+(?:is\s+)?glitching)\b/.test(text);

  // 5. AUDIO, MEDIA & PLAYBACK
  const isAudioMedia = 
    /\b(apple music|itunes music|music app|icloud music library)\b/.test(text) ||
    /\b(airpods?|earpods?|headphones?|headphone jack)\b/.test(text) ||
    (/\b(music|playlist|playlists|songs?)\b/.test(text) && /\b(playing|play|stream|streaming|download|deleted|pause|pausing|skip|skipping|library|sound)\b/.test(text)) ||
    (/\b(speaker|speakers|microphone|mic)\b/.test(text) && /\b(crackling|distorted|muffled|quiet|not working|doesn't work|doesnt work|low volume|no sound)\b/.test(text)) ||
    /\b(ringer volume|alarm volume|no alarm sound|alarm didn't go off|alarm sound)\b/.test(text) ||
    /\b(?:spotify|music)\s+on\s+(?:my\s+)?lock screen\b/.test(text);

  // 6. CONNECTIVITY, WI-FI & BLUETOOTH
  const isConnectivity = 
    (/\b(wi-?fi|wifi)\b/.test(text) && /\b(connect|connecting|connection|disconnect|disconnecting|dropping|greyed out|not working|doesn't work|doesnt work|slow|join|turn on|wont turn on|won't turn on)\b/.test(text)) ||
    (/\b(bluetooth)\b/.test(text) && /\b(connect|connecting|connection|pair|pairing|car|discover|drop|not working|doesn't work|doesnt work)\b/.test(text)) ||
    /\b(no service|searching\.\.\.|searching for service|cellular data|lte not working|dropped calls)\b/.test(text) ||
    /\b(airdrop|personal hotspot|hotspot)\b/.test(text) ||
    (/\b(sim card|no sim|invalid sim)\b/.test(text) && !isBilling);

  // 7. ACCOUNT, ICLOUD & ACCESS SECURITY
  const isAccountIcloud = 
    /\b(apple id|appleid)\b/.test(text) ||
    (/\b(icloud)\b/.test(text) && /\b(backup|storage|sync|full|locked|password|login|id)\b/.test(text)) ||
    /\b(account locked|locked for security reasons|apple id locked)\b/.test(text) ||
    /\b(forgot password|reset password|passcode|forgot passcode)\b/.test(text) ||
    /\b(two-factor|2fa|verification code|security questions?|account recovery)\b/.test(text);

  // 8. APPS & APP STORE (Downloads, Updates & Crashes)
  const isAppStoreMarketplace = 
    /\b(app store|appstore|mac app store)\b/.test(text) ||
    (/\bapps?\b/i.test(text) && /\b(won't|wont|cannot|cant|can't|not|fail|stuck|stop|error)\b/i.test(text) && /\b(download|downloading|update|updating|install)\b/i.test(text)) ||
    /\bapp\s+waiting\.\.\.\b/.test(text);

  const isAppCrash = 
    (/\b(youtube|spotify|whatsapp|instagram|facebook|snapchat|netflix|twitter app)\b/.test(text) && /\b(crash|crashes|crashing|closing|quits?|won't open|wont open|freez)\b/.test(text)) ||
    (/\b(camera app|mail app|notes app|photos app|safari|messages app|calendar app|phone app)\b/.test(text) && /\b(crash|crashes|crashing|won't open|wont open|quits?|doesn't work|doesnt work)\b/.test(text));

  const isApps = isAppStoreMarketplace || isAppCrash;

  // 9. SOFTWARE UPDATE (OS installation, download failure, verify failure, or general OS complaint with NO specific symptom)
  const isSoftwareUpdate = 
    /\b(unable to verify update|error occurred downloading|update failed|installation failed|verifying update stuck|update stuck)\b/.test(text) ||
    /\b(downgrade (?:to )?ios|revert (?:back )?to ios|rollback)\b/.test(text) ||
    (/\b(stuck on apple logo|boot loop)\b/.test(text) && /\b(update|updating|updated|install)\b/.test(text)) ||
    (/\b(can't update|cannot update|unable to update|update won't download|update won't install|update not showing)\b/.test(text) && !isApps) ||
    (/\b(?:after|since)\s+(?:updating|the update|ios 11|installing)\b/.test(text) && /\b(phone is slow|running slow|ruined my phone|phone is unusable|worst update|super slow)\b/.test(text)) ||
    (/\b(update to ios|install ios 11|download ios 11)\b/.test(text) && !isBattery && !isKeyboard && !isDisplayHardware && !isConnectivity);

  // PRIORITY ORDER:
  if (isBilling) return 'billing_subscriptions';
  if (isKeyboard) return 'keyboard_typing';
  if (isBattery) return 'battery_power';
  if (isDisplayHardware) return 'display_hardware';
  if (isAccountIcloud) return 'account_icloud';
  if (isConnectivity) return 'connectivity_network';
  if (isAudioMedia) return 'audio_media';
  if (isApps) return 'apps_appstore';
  if (isSoftwareUpdate) return 'software_update';

  return 'other_unclear';
}

async function run() {
  const rl = readline.createInterface({
    input: fs.createReadStream(pairsPath),
    crlfDelay: Infinity
  });

  const counts = {
    other_unclear: 0,
    battery_power: 0,
    keyboard_typing: 0,
    audio_media: 0,
    display_hardware: 0,
    account_icloud: 0,
    connectivity_network: 0,
    apps_appstore: 0,
    billing_subscriptions: 0,
    software_update: 0
  };

  const samples = {};
  for (const k of Object.keys(counts)) samples[k] = [];

  let total = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    const pair = JSON.parse(line);
    if (!pair.isInitialInquiry) continue;

    total++;
    const assigned = classifyInquiry(pair.customerTextClean, pair.customerTextRaw);
    counts[assigned]++;

    if (samples[assigned].length < 15) {
      samples[assigned].push({
        tweetId: pair.customerTweetId,
        customerText: pair.customerTextClean,
        assignedIntent: assigned
      });
    }
  }

  console.log(`===============================================================`);
  console.log(`AUDITED TAXONOMY RECONCILIATION SUMMARY (74,426 Inquiries)`);
  console.log(`===============================================================`);

  let sum = 0;
  console.log(
    '#'.padStart(2) + ' ' +
    'Intent ID'.padEnd(24) +
    'Count'.padStart(12) +
    'Share %'.padStart(10) +
    'Requires Human Review'
  );
  console.log('-----------------------------------------------------------------------------------------');

  const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  sorted.forEach((id, idx) => {
    sum += counts[id];
    const pct = ((counts[id] / total) * 100).toFixed(2) + '%';
    const isHuman = id === 'other_unclear' ? 'YES (Fallback Intent)' : 'No (Guarded / Auto-Handle)';
    console.log(
      String(idx + 1).padStart(2) + ' ' +
      id.padEnd(24) +
      counts[id].toLocaleString().padStart(12) +
      pct.padStart(10) + '    ' +
      isHuman
    );
  });
  console.log('-----------------------------------------------------------------------------------------');
  console.log(`RECONCILIATION: Sum = ${sum.toLocaleString()} / Total = ${total.toLocaleString()} (Discrepancy: ${total - sum})\n`);

  // Edge cases verification
  const edgeTests = [
    { text: "the screen on our iPad Pro has stopped working 😔. I've read a few articles about weak screens on some models - is there anywhere I can check the model number, or will it be a £400 repair bill? Thanks", expected: "display_hardware", desc: "Tweet 18872 (£400 repair bill for iPad screen)" },
    { text: "After updating iOS 11 my battery dies in two hours. Fix this!", expected: "battery_power", desc: "Battery drain after OS update" },
    { text: 'Hey and anyone else who upgraded to ios11.1, are y’all having issues with capital “I” in the Mail app? As it puts in “A”?', expected: "keyboard_typing", desc: "iOS 11.1 capital 'I' bug in Mail app" },
    { text: 'Why is “I” keep changing to this and how do I stop it🤦🏽♀ #anybody', expected: "keyboard_typing", desc: "iOS 11.1 letter 'I' with curly quotes" },
    { text: "why won’t my apps fuccin download or update", expected: "apps_appstore", desc: "Apps won't download with informal slang" },
    { text: "Why do you keep charging my card for FREE apps? Im not happy at all.", expected: "billing_subscriptions", desc: "Unauthorized card charge for free apps" },
    { text: "I bought an iTunes gift card worth £15 a week ago, and the email still hasn’t come into my inbox to tell me the code. Helpppp", expected: "billing_subscriptions", desc: "iTunes gift card purchase missing" },
    { text: "Why is my iPhone 7 saying no service? WiFi works fine.", expected: "connectivity_network", desc: "iPhone 7 No Service carrier bug" },
    { text: "YouTube app keeps crashing on launch since this morning", expected: "apps_appstore", desc: "YouTube app crash" },
    { text: "Unable to verify update. An error occurred installing iOS 11.0.3", expected: "software_update", desc: "Unable to verify update error" },
    { text: "I forgot my Apple ID password and my account is locked", expected: "account_icloud", desc: "Apple ID password reset & locked" },
    { text: "Hello are all the Apple retail stores open today?", expected: "other_unclear", desc: "Retail store question" },
    { text: "My iPhone X reservation email says the 18th instead of the 3rd", expected: "other_unclear", desc: "iPhone X pre-order / reservation" },
    { text: "You guys suck so bad, worst company ever", expected: "other_unclear", desc: "General vent without diagnostic details" }
  ];

  console.log('--- Edge Case Unit Tests ---');
  let passCount = 0;
  edgeTests.forEach((t, i) => {
    const res = classifyInquiry(t.text, t.text);
    const pass = res === t.expected;
    if (pass) passCount++;
    console.log(`  Test ${i + 1} [${t.desc}]: ${pass ? 'PASS ✅' : 'FAIL ❌'} (Got: ${res}, Expected: ${t.expected})`);
  });
  console.log(`Unit test summary: ${passCount} / ${edgeTests.length} passed.\n`);

  const output = {
    totalInquiries: total,
    reconciledSum: sum,
    isReconciled: sum === total,
    intentCounts: counts,
    percentages: Object.fromEntries(
      Object.entries(counts).map(([k, v]) => [k, Number(((v / total) * 100).toFixed(2))])
    ),
    examples: samples
  };

  fs.writeFileSync(
    path.join(config.processedDataDir, 'audited_intent_classification.json'),
    JSON.stringify(output, null, 2)
  );

  console.log('Saved data/processed/audited_intent_classification.json');
}

run().catch(console.error);
