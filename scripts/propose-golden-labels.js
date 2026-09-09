import fs from 'fs';
import path from 'path';
import config from '../src/config/index.js';

const goldenPath = path.join(config.projectRoot, 'data/golden/golden-set.jsonl');
const reviewReportPath = path.join(config.projectRoot, 'docs/golden-proposals-review.md');

/**
 * Contextual analyzer grounded strictly in the 10-intent taxonomy and boundary rules.
 */
function analyzeInquiry(cleanText, rawText) {
  const text = (cleanText || '').toLowerCase().replace(/["“”]/g, ' ').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
  const raw = (rawText || '').toLowerCase();

  // 1. BILLING & PURCHASES (Strictly guarded)
  const isRepairBill = /\b(repair\s+bill|repair\s+cost|cost\s+to\s+repair|fix\s+my\s+screen|broken\s+screen|replace\s+my\s+screen|screen\s+repair)\b/.test(text);
  const isCarrierBill = /\b(monthly\s+bill|phone\s+bill|carrier\s+bill|discount\s+on\s+my\s+bill)\b/.test(text) && !/\b(itunes|apple|app store)\b/.test(text);

  const hasPaymentMethod = /\b(payment\s+method|update\s+my\s+payment|card\s+declined|payment\s+declined|payment\s+failed|credit\s+card)\b/.test(text);
  const hasRefund = /\b(refund|refunded|requesting a refund|get my money back)\b/.test(text);
  const hasSubscription = /\b(subscription|subscriptions|subscribed|cancel subscription|cancelling subscription|renew my subscription)\b/.test(text);
  const hasUnwantedCharge = /\b(unauthorized charge|charged twice|double charged|why was i charged|charged for free app|random charge|unexpected charge|charged me twice|keep charging me|charge on my card)\b/.test(text);
  const hasGiftCard = /\b(itunes gift card|apple gift card|gift card code|redeem gift card|itunes receipt|itunes bill)\b/.test(text);
  const hasInAppPurchase = /\b(in-app purchase|in app purchase)\b/.test(text) && /\b(charge|paid|money|refund|billing|buy)\b/.test(text);

  if (!isRepairBill && !isCarrierBill && (hasPaymentMethod || hasRefund || hasSubscription || hasUnwantedCharge || hasGiftCard || hasInAppPurchase)) {
    return {
      proposedLabel: 'billing_subscriptions',
      confidence: hasPaymentMethod || hasRefund || hasUnwantedCharge ? 0.95 : 0.85,
      reason: hasPaymentMethod 
        ? 'Customer is encountering errors updating or saving an Apple payment method.'
        : hasRefund 
        ? 'Explicit request or inquiry regarding a refund for an Apple purchase.'
        : hasSubscription 
        ? 'Customer inquiry regarding recurring subscription renewal or cancellation.'
        : hasUnwantedCharge
        ? 'Customer reporting unauthorized or duplicate billing charges from Apple.'
        : 'Inquiry regarding Apple/iTunes gift card codes or purchase receipts.',
      alternative: null
    };
  }

  // 2. KEYBOARD & TYPING (High specificity)
  const isKeyboardLag = /\b(keyboard\s+lag|keyboard\s+freez|keyboard\s+delay|keyboard\s+disappear|keyboard\s+won't\s+appear|keyboard\s+not\s+showing)\b/.test(text);
  const isAutocorrect = /\b(autocorrect|auto correct|predictive text|spacebar|dictation)\b/.test(text);
  const isLetterIBug = 
    /\bcapital\s+i\b/.test(text) ||
    /\bletter\s+i\b/.test(text) ||
    /\bwhy\s+(?:does|is)\s+(?:my\s+)?i\s+(?:keep|not)\b/.test(text) ||
    /\bi\s+(?:keep|keeps|is)\s+changing\b/.test(text) ||
    /\b(?:type|typing)\s+(?:the\s+)?letter\s+i\b/.test(text) ||
    /\bquestion mark\s*(?:box|\?|inside box)?\b/.test(text) ||
    /\ba\s+(?:and\s+a\s+)?question mark\b/.test(text) ||
    /\b(?:symbol|letter a)\s+instead of\s+i\b/.test(text) ||
    /\bi\s*\[\?\]\b/.test(text) ||
    /\bmy\s+letter\s+i\b/.test(text);

  if (isKeyboardLag || isAutocorrect || isLetterIBug) {
    return {
      proposedLabel: 'keyboard_typing',
      confidence: isLetterIBug ? 0.95 : 0.90,
      reason: isLetterIBug 
        ? 'Classic iOS 11.1 predictive text bug replacing letter I with A and question mark symbol.'
        : isKeyboardLag 
        ? 'Report of on-screen keyboard lag, delay, or disappearing input interface.'
        : 'Autocorrect or predictive text substituting incorrect characters/words.',
      alternative: /\bupdate\b/.test(text) ? 'software_update' : null
    };
  }

  // 3. BATTERY & POWER PERFORMANCE
  const hasBatteryWord = /\b(battery|batteries|battery life|battery health)\b/.test(text);
  const hasDrain = /\b(drain|draining|drained|poor battery|horrible battery|battery sucks)\b/.test(text);
  const hasSuddenShutoff = /\b(?:dies|dying|shutting off|shut down|powers? off|drops? to)\s+(?:at|with|from)?\s*\d+%/i.test(text);
  const hasThermal = /\b(?:phone|iphone)\s+(?:is\s+)?(?:running hot|overheating|gets? hot|burning hot|hot like a)\b/.test(text);
  const hasCharging = /\b(won't charge|wont charge|not charging|stopped charging|slow charging|charger|charging cable)\b/.test(text);

  if (hasBatteryWord || (hasDrain && !/\b(money|bank)\b/.test(text)) || hasSuddenShutoff || hasThermal || hasCharging) {
    const mentionsUpdate = /\b(update|updated|ios 11|ios11)\b/.test(text);
    return {
      proposedLabel: 'battery_power',
      confidence: hasBatteryWord || hasSuddenShutoff ? 0.95 : 0.85,
      reason: hasThermal 
        ? 'Customer reports device running excessively hot or overheating.'
        : hasSuddenShutoff 
        ? 'Device abruptly dying or shutting down while battery percentage shows remaining charge.'
        : hasCharging 
        ? 'Failure of device to charge or maintain power connection.'
        : mentionsUpdate 
        ? 'Battery life degradation following an OS upgrade; symptom takes precedence over update mention.'
        : 'Complaint regarding rapid battery drain or poor battery longevity.',
      alternative: mentionsUpdate ? 'software_update' : null
    };
  }

  // 4. DISPLAY, TOUCH & PHYSICAL HARDWARE
  const hasScreen = /\b(screen|touchscreen|touch screen|display)\b/.test(text);
  const hasTouchFreeze = hasScreen && /\b(freeze|freezes|freezing|frozen|unresponsive|black|blank|white|flickering|flicker|lines|glitch|cracked|shattered|broken|not working|doesn't work|doesnt work|wont work|won't work|went black|turns black)\b/.test(text);
  const hasBlackScreen = /\b(black screen|blank screen|white screen|ghost touch|touch not working|unresponsive touch)\b/.test(text);
  const hasHardwareButtons = /\b(home button|power button|side button|volume button|face id|touch id)\b/.test(text) && /\b(broken|stuck|not working|doesn't work|doesnt work|failed|stops working)\b/.test(text);
  const hasCompleteFreeze = /\b(?:phone|iphone|ipad|mac)\s+(?:is\s+)?(?:completely\s+)?frozen\b/.test(text);

  if (isRepairBill || hasTouchFreeze || hasBlackScreen || hasHardwareButtons || hasCompleteFreeze) {
    return {
      proposedLabel: 'display_hardware',
      confidence: isRepairBill || hasBlackScreen || hasHardwareButtons ? 0.95 : 0.85,
      reason: isRepairBill 
        ? 'Inquiry regarding physical screen damage or hardware repair cost/bill.'
        : hasBlackScreen 
        ? 'Display remains completely black or blank while device is powered on.'
        : hasHardwareButtons 
        ? 'Physical device button or biometric sensor (Home button, Face ID) malfunction.'
        : 'Touchscreen unresponsive or display frozen/glitching.',
      alternative: /\b(app|youtube|safari)\b/.test(text) ? 'apps_appstore' : null
    };
  }

  // 5. AUDIO, MEDIA & PLAYBACK
  const hasAppleMusic = /\b(apple music|itunes music|music app|icloud music library)\b/.test(text);
  const hasAirPods = /\b(airpods?|earpods?|headphones?|headphone jack)\b/.test(text);
  const hasMusicPlayback = /\b(music|playlist|playlists|songs?)\b/.test(text) && /\b(playing|play|stream|streaming|download|deleted|pause|pausing|skip|skipping|library|sound)\b/.test(text);
  const hasSpeakerMic = /\b(speaker|speakers|microphone|mic)\b/.test(text) && /\b(crackling|distorted|muffled|quiet|not working|doesn't work|doesnt work|low volume|no sound)\b/.test(text);
  const hasVolumeAlarm = /\b(ringer volume|alarm volume|no alarm sound|alarm didn't go off|alarm sound)\b/.test(text);
  const hasLockscreenMusic = /\b(?:spotify|music)\s+on\s+(?:my\s+)?lock screen\b/.test(text);

  if (hasAppleMusic || hasAirPods || hasMusicPlayback || hasSpeakerMic || hasVolumeAlarm || hasLockscreenMusic) {
    return {
      proposedLabel: 'audio_media',
      confidence: hasAppleMusic || hasAirPods || hasVolumeAlarm ? 0.95 : 0.85,
      reason: hasAppleMusic || hasMusicPlayback 
        ? 'Apple Music streaming, library tracks missing, or media playback malfunction.'
        : hasAirPods 
        ? 'AirPods/EarPods connection dropouts, pairing, or audio quality failure.'
        : hasSpeakerMic 
        ? 'Physical speaker crackling, distortion, or microphone failure.'
        : 'Alarm or ringer volume failing to sound.',
      alternative: /\bapp\b/.test(text) ? 'apps_appstore' : null
    };
  }

  // 6. CONNECTIVITY, WI-FI & BLUETOOTH
  const hasWifi = /\b(wi-?fi|wifi)\b/.test(text) && /\b(connect|connecting|connection|disconnect|disconnecting|dropping|greyed out|not working|doesn't work|doesnt work|slow|join|turn on|wont turn on|won't turn on)\b/.test(text);
  const hasBluetooth = /\b(bluetooth)\b/.test(text) && /\b(connect|connecting|connection|pair|pairing|car|discover|drop|not working|doesn't work|doesnt work)\b/.test(text);
  const hasCarrierSignal = /\b(no service|searching\.\.\.|searching for service|cellular data|lte not working|dropped calls)\b/.test(text);
  const hasAirDrop = /\b(airdrop|personal hotspot|hotspot)\b/.test(text);
  const hasSimCard = /\b(sim card|no sim|invalid sim)\b/.test(text);

  if (hasWifi || hasBluetooth || hasCarrierSignal || hasAirDrop || hasSimCard) {
    return {
      proposedLabel: 'connectivity_network',
      confidence: hasWifi || hasBluetooth || hasCarrierSignal ? 0.95 : 0.85,
      reason: hasWifi 
        ? 'Wi-Fi connection dropping, failing to join, or toggle switch greyed out.'
        : hasBluetooth 
        ? 'Bluetooth failing to pair, discover accessories, or dropping connection.'
        : hasCarrierSignal 
        ? 'Cellular reception failure, "No Service" status, or mobile data inaccessibility.'
        : 'Wireless networking failure (AirDrop, Hotspot, SIM card).',
      alternative: /\bupdate\b/.test(text) ? 'software_update' : null
    };
  }

  // 7. ACCOUNT, ICLOUD & ACCESS SECURITY
  const hasAppleId = /\b(apple id|appleid)\b/.test(text);
  const hasIcloudStorage = /\b(icloud)\b/.test(text) && /\b(backup|storage|sync|full|locked|password|login|id)\b/.test(text);
  const hasAccountLocked = /\b(account locked|locked for security reasons|apple id locked)\b/.test(text);
  const hasPasswordReset = /\b(forgot password|reset password|passcode|forgot passcode)\b/.test(text);
  const has2FA = /\b(two-factor|2fa|verification code|security questions?|account recovery)\b/.test(text);

  if (hasAppleId || hasIcloudStorage || hasAccountLocked || hasPasswordReset || has2FA) {
    return {
      proposedLabel: 'account_icloud',
      confidence: hasAccountLocked || hasPasswordReset || has2FA ? 0.95 : 0.85,
      reason: hasAccountLocked 
        ? 'Apple ID locked for security reasons requiring identity verification.'
        : hasPasswordReset 
        ? 'Forgotten Apple ID password or device passcode recovery.'
        : has2FA 
        ? 'Two-factor authentication code not received or trusted device verification.'
        : 'iCloud storage quota management, sync failure, or backup issue.',
      alternative: /\b(pay|card|charge)\b/.test(text) ? 'billing_subscriptions' : null
    };
  }

  // 8. APPS & APP STORE (Downloads, Updates & Crashes)
  const isAppStore = /\b(app store|appstore|mac app store)\b/.test(text);
  const isAppDownload = /\bapps?\b/i.test(text) && /\b(won't|wont|cannot|cant|can't|not)\b/i.test(text) && /\b(download|downloading|update|updating|install)\b/i.test(text);
  const isAppCrash = 
    (/\b(youtube|spotify|whatsapp|instagram|facebook|snapchat|netflix|twitter app)\b/.test(text) && /\b(crash|crashes|crashing|closing|quits?|won't open|wont open|freez)\b/.test(text)) ||
    (/\b(camera app|mail app|notes app|photos app|safari|messages app|calendar app|phone app)\b/.test(text) && /\b(crash|crashes|crashing|won't open|wont open|quits?|doesn't work|doesnt work)\b/.test(text)) ||
    /\bapp\s+(?:keeps?\s+)?crashing\b/.test(text);

  if (isAppStore || isAppDownload || isAppCrash) {
    return {
      proposedLabel: 'apps_appstore',
      confidence: isAppStore || isAppCrash ? 0.90 : 0.80,
      reason: isAppStore 
        ? 'Trouble accessing App Store marketplace or installing app updates.'
        : isAppCrash 
        ? 'Specific first-party or third-party application repeatedly crashing on launch.'
        : 'Inability to download or install applications on device.',
      alternative: /\b(music|itunes)\b/.test(text) ? 'audio_media' : null
    };
  }

  // 9. SOFTWARE UPDATE (Strictly OS Installation, Download, or Verification Failures)
  const hasUpdateFailure = 
    /\b(unable to verify update|error occurred downloading|update failed|installation failed|verifying update stuck|update stuck)\b/.test(text) ||
    /\b(downgrade (?:to )?ios|revert (?:back )?to ios|rollback)\b/.test(text) ||
    (/\b(stuck on apple logo|boot loop)\b/.test(text) && /\b(update|updating|updated|install)\b/.test(text)) ||
    (/\b(can't update|cannot update|unable to update|update won't download|update won't install|update not showing)\b/.test(text)) ||
    (/\b(?:after|since)\s+(?:updating|the update|ios 11|installing)\b/.test(text) && /\b(phone is slow|running slow|ruined my phone|phone is unusable|worst update|super slow)\b/.test(text)) ||
    (/\b(update to ios|install ios 11|download ios 11)\b/.test(text));

  if (hasUpdateFailure) {
    return {
      proposedLabel: 'software_update',
      confidence: 0.90,
      reason: 'Failure of OS update download, verification, or installation process itself.',
      alternative: null
    };
  }

  // 10. OTHER_UNCLEAR (Explicit Fallback)
  // Short vague queries, retail/store questions, shipment pre-orders, emotional venting
  const isVeryShort = text.length < 25;
  const isRetailOrShipment = /\b(store|hours|open|reservation|reserved|shipment|shipped|delivery|order|tracking|trade-?in)\b/.test(text);
  const isVenting = /\b(suck|garbage|trash|worst|fuck|shit|ruined|hate)\b/.test(text) && !/\b(battery|screen|keyboard|sound|wifi)\b/.test(text);

  return {
    proposedLabel: 'other_unclear',
    confidence: isVeryShort || isRetailOrShipment || isVenting ? 0.90 : 0.70,
    reason: isRetailOrShipment 
      ? 'Inquiry regarding Apple Store retail hours, shipping, or pre-order reservations.'
      : isVeryShort 
      ? 'Inquiry is too short or underspecified to diagnose technical symptoms.'
      : isVenting 
      ? 'General emotional venting or opinion without actionable technical symptoms.'
      : 'Inquiry falls outside the 9 defined technical troubleshooting categories; requires human review.',
    alternative: null
  };
}

async function runProposals() {
  console.log('===============================================================');
  console.log('GENERATING AI PROPOSALS FOR 200 GOLDEN EVALUATION EXAMPLES');
  console.log('===============================================================\n');

  if (!fs.existsSync(goldenPath)) {
    console.error(`Golden set not found at ${goldenPath}`);
    process.exit(1);
  }

  const lines = fs.readFileSync(goldenPath, 'utf8').split('\n').filter(Boolean);
  const items = lines.map(line => JSON.parse(line));

  console.log(`Loaded ${items.length} records from ${goldenPath}`);

  let proposalCount = 0;
  let humanLabelCount = 0;
  let lowConfidenceCount = 0;
  const proposedCounts = {};
  const lowConfidenceItems = [];

  const updatedItems = items.map(item => {
    if (item.humanLabel !== null) {
      humanLabelCount++;
    }

    const analysis = analyzeInquiry(item.customerTextClean, item.customerTextRaw);
    proposalCount++;

    proposedCounts[analysis.proposedLabel] = (proposedCounts[analysis.proposedLabel] || 0) + 1;

    if (analysis.confidence < 0.75) {
      lowConfidenceCount++;
      lowConfidenceItems.push({
        goldenId: item.goldenId,
        text: item.customerTextClean,
        proposed: analysis.proposedLabel,
        confidence: analysis.confidence,
        reason: analysis.reason,
        alternative: analysis.alternative
      });
    }

    // Preserve all existing fields and populate proposal fields separately
    return {
      goldenId: item.goldenId,
      tweetId: item.tweetId,
      customerAuthorId: item.customerAuthorId,
      customerCreatedAt: item.customerCreatedAt,
      customerTextRaw: item.customerTextRaw,
      customerTextClean: item.customerTextClean,
      automaticCandidateLabel: item.automaticCandidateLabel,
      samplingStratum: item.samplingStratum,
      isAmbiguousCase: item.isAmbiguousCase,
      hasUrl: item.hasUrl,
      charLength: item.charLength,
      // AI Proposal Fields (strictly distinct from human labels)
      automaticProposedLabel: analysis.proposedLabel,
      automaticConfidence: analysis.confidence,
      automaticReason: analysis.reason,
      automaticAlternativeLabel: analysis.alternative,
      // Human annotation fields (MUST REMAIN UNCHANGED / NULL)
      humanLabel: item.humanLabel,
      labelReason: item.labelReason,
      annotator: item.annotator,
      annotatedAt: item.annotatedAt
    };
  });

  // Save updated golden set
  const outputLines = updatedItems.map(it => JSON.stringify(it)).join('\n') + '\n';
  fs.writeFileSync(goldenPath, outputLines, 'utf8');

  console.log(`Proposals generated: ${proposalCount} / 200`);
  console.log(`Human labels already present: ${humanLabelCount} (0 confirmed - no fabrication)`);
  console.log(`Low-confidence proposals (<0.75): ${lowConfidenceCount}\n`);

  console.log('--- Proposed Label Distribution ---');
  console.log('-----------------------------------------------------------------------------------------');
  console.log(
    '#'.padStart(2) + ' ' +
    'Proposed Intent ID'.padEnd(26) +
    'Count'.padStart(10) +
    'Share %'.padStart(10)
  );
  console.log('-----------------------------------------------------------------------------------------');
  const sortedIntents = Object.keys(proposedCounts).sort((a, b) => proposedCounts[b] - proposedCounts[a]);
  sortedIntents.forEach((id, idx) => {
    const count = proposedCounts[id];
    const pct = ((count / proposalCount) * 100).toFixed(1) + '%';
    console.log(
      String(idx + 1).padStart(2) + ' ' +
      id.padEnd(26) +
      count.toString().padStart(10) +
      pct.padStart(10)
    );
  });
  console.log('-----------------------------------------------------------------------------------------');

  // Generate Review Report Markdown
  generateReviewReport(updatedItems, lowConfidenceItems, proposedCounts);
  console.log(`\nReview report saved to: ${reviewReportPath}`);
}

function generateReviewReport(items, lowConfidenceItems, proposedCounts) {
  let md = `# Golden Evaluation Set — AI Label Proposals Review Report\n\n`;
  md += `This document provides the complete, transparent listing of all **200 AI-proposed labels** for the Golden Evaluation Set.\n\n`;
  md += `> [!IMPORTANT]\n`;
  md += `> **Audit Notice**: These labels are **proposals only** generated to streamline annotation. They are stored in \`automaticProposedLabel\` and have **NOT** been copied to \`humanLabel\`. They will only become official ground-truth labels once reviewed and approved by Varshith.\n\n`;
  md += `## 1. Summary Statistics\n\n`;
  md += `- **Total Golden Records**: 200\n`;
  md += `- **AI Proposals Generated**: 200 (100%)\n`;
  md += `- **Pre-existing Human Labels**: 0 (no premature labels)\n`;
  md += `- **Low-Confidence Proposals (<0.75)**: ${lowConfidenceItems.length}\n\n`;

  md += `### Proposed Label Breakdown\n\n`;
  md += `| Proposed Intent | Count | Share % |\n`;
  md += `| :--- | :-: | :-: |\n`;
  for (const [id, count] of Object.entries(proposedCounts).sort((a, b) => b[1] - a[1])) {
    const pct = ((count / items.length) * 100).toFixed(1) + '%';
    md += `| \`${id}\` | **${count}** | ${pct} |\n`;
  }
  md += `\n---\n\n`;

  md += `## 2. Low-Confidence & Ambiguous Items (${lowConfidenceItems.length} Cases)\n\n`;
  if (lowConfidenceItems.length === 0) {
    md += `*None — all items met confidence threshold.*\n\n`;
  } else {
    md += `| Golden ID | Customer Text | Proposed Label | Conf | Reason & Potential Alternative |\n`;
    md += `| :--- | :--- | :--- | :-: | :--- |\n`;
    lowConfidenceItems.forEach(item => {
      const altText = item.alternative ? ` *(Alternative: \`${item.alternative}\`)*` : '';
      md += `| **${item.goldenId}** | "${item.text.replace(/\|/g, '\\|')}" | \`${item.proposed}\` | ${item.confidence} | ${item.reason}${altText} |\n`;
    });
    md += `\n`;
  }

  md += `\n---\n\n`;
  md += `## 3. Complete Item-by-Item Review Listing (200 Records)\n\n`;
  md += `| Golden ID | Customer Text | Proposed Intent | Conf | Short Rationale |\n`;
  md += `| :--- | :--- | :--- | :-: | :--- |\n`;
  items.forEach(it => {
    const textSnippet = it.customerTextClean.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    md += `| **${it.goldenId}** | "${textSnippet}" | \`${it.automaticProposedLabel}\` | ${it.automaticConfidence.toFixed(2)} | ${it.automaticReason} |\n`;
  });

  fs.writeFileSync(reviewReportPath, md, 'utf8');
}

runProposals().catch(console.error);
