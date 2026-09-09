import fs from 'fs';
import path from 'path';
import config from '../src/config/index.js';

const auditData = JSON.parse(fs.readFileSync(path.join(config.processedDataDir, 'audited_intent_classification.json'), 'utf8'));

const taxonomySpec = {
  totalInquiries: auditData.totalInquiries,
  reconciledSum: auditData.reconciledSum,
  isReconciled: auditData.isReconciled,
  intents: [
    {
      id: "other_unclear",
      display_name: "Out-of-Scope / Vague / Retail / Human Fallback",
      requires_human_review: true,
      count: auditData.intentCounts.other_unclear,
      percentage: auditData.percentages.other_unclear,
      definition: "Customer inquiry cannot be confidently diagnosed or routed to a supported technical troubleshooting workflow. Covers retail store hours, pre-orders/shipping, general complaints without diagnostic details, and non-English messages.",
      examples: auditData.examples.other_unclear.slice(0, 10)
    },
    {
      id: "battery_power",
      display_name: "Battery, Power & Charging Issues",
      requires_human_review: false,
      count: auditData.intentCounts.battery_power,
      percentage: auditData.percentages.battery_power,
      definition: "Abnormal battery drainage, spontaneous device shutoffs at remaining percentage, overheating during use/charging, or charging cable failures.",
      examples: auditData.examples.battery_power.slice(0, 10)
    },
    {
      id: "keyboard_typing",
      display_name: "Keyboard, Typing & Autocorrect Glitches",
      requires_human_review: false,
      count: auditData.intentCounts.keyboard_typing,
      percentage: auditData.percentages.keyboard_typing,
      definition: "Typing lag, keyboard disappearing, autocorrect substituting symbols/unwanted words (notably iOS 11.1 capital 'I' bug).",
      examples: auditData.examples.keyboard_typing.slice(0, 10)
    },
    {
      id: "audio_media",
      display_name: "Apple Music, Audio & Media Playback",
      requires_human_review: false,
      count: auditData.intentCounts.audio_media,
      percentage: auditData.percentages.audio_media,
      definition: "Apple Music streaming, missing library tracks, speaker crackling, microphone failure, ringer/alarm volume glitches, or AirPods connection issues.",
      examples: auditData.examples.audio_media.slice(0, 10)
    },
    {
      id: "apps_appstore",
      display_name: "App Store Downloads & App Performance",
      requires_human_review: false,
      count: auditData.intentCounts.apps_appstore,
      percentage: auditData.percentages.apps_appstore,
      definition: "Inability to download/update apps from App Store, spinning download icons, or specific first/third-party app crashes (YouTube, Calendar, Mail).",
      examples: auditData.examples.apps_appstore.slice(0, 10)
    },
    {
      id: "display_hardware",
      display_name: "Screen, Touch & Physical Hardware",
      requires_human_review: false,
      count: auditData.intentCounts.display_hardware,
      percentage: auditData.percentages.display_hardware,
      definition: "Unresponsive touchscreen, black screen, visual glitching, broken/stuck buttons (Home/Power), shattered screens, or physical repair inquiries.",
      examples: auditData.examples.display_hardware.slice(0, 10)
    },
    {
      id: "account_icloud",
      display_name: "Apple ID, iCloud & Account Security",
      requires_human_review: false,
      count: auditData.intentCounts.account_icloud,
      percentage: auditData.percentages.account_icloud,
      definition: "Apple ID account lockout, password reset, 2FA verification code delivery, iCloud storage full alerts, or iCloud backup errors.",
      examples: auditData.examples.account_icloud.slice(0, 10)
    },
    {
      id: "connectivity_network",
      display_name: "Wi-Fi, Bluetooth & Cellular Connectivity",
      requires_human_review: false,
      count: auditData.intentCounts.connectivity_network,
      percentage: auditData.percentages.connectivity_network,
      definition: "Wi-Fi greyed out/disconnecting, Bluetooth pairing failure, 'No Service' carrier errors, AirDrop failures, or SIM card errors.",
      examples: auditData.examples.connectivity_network.slice(0, 10)
    },
    {
      id: "billing_subscriptions",
      display_name: "Billing, App Store Purchases & Refunds",
      requires_human_review: false,
      count: auditData.intentCounts.billing_subscriptions,
      percentage: auditData.percentages.billing_subscriptions,
      definition: "Unauthorized credit card charges, refund requests for digital purchases, recurring subscription cancellations, or payment method declines.",
      examples: auditData.examples.billing_subscriptions.slice(0, 10)
    },
    {
      id: "software_update",
      display_name: "OS Update & Installation Issues",
      requires_human_review: false,
      count: auditData.intentCounts.software_update,
      percentage: auditData.percentages.software_update,
      definition: "Failures occurring during the OS update installation/verification process (Unable to verify update, stuck on Apple logo, rollback requests).",
      examples: auditData.examples.software_update.slice(0, 10)
    }
  ]
};

fs.writeFileSync(
  path.join(config.processedDataDir, 'intent-taxonomy.json'),
  JSON.stringify(taxonomySpec, null, 2)
);

console.log('Updated data/processed/intent-taxonomy.json');
