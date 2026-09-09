# AppleSupport Human Annotation Guide

This guide is for human annotators labelling the **200-example Golden Evaluation Set** for the `@AppleSupport` AI agent.

---

## 1. Ground Rules for Annotation

1. **Blind Labeling**: Label based **ONLY** on the customer's text. Do not look up historical support responses.
2. **Customer Intent Over Cause**: Label what the customer is trying to **fix or resolve**, not the backstory.
3. **No Forced Classification**: If an inquiry is vague, lacks diagnostic information, or asks about retail/orders, assign **`other_unclear`**.
4. **Mutually Exclusive**: Assign exactly **one** primary intent per inquiry.

---

## 2. The 10 Available Labels

| # | Intent Key | Category Name | Primary Troubleshooting Action |
| :-: | :--- | :--- | :--- |
| 1 | `software_update` | OS Update & Installation Issues | Fixing update verification, downloading, or boot loops |
| 2 | `battery_power` | Battery, Power & Charging Issues | Diagnosing battery drain, sudden shutoffs, or charging cables |
| 3 | `display_hardware` | Screen, Touch & Physical Hardware | Resolving touch latency, black screens, or broken buttons |
| 4 | `keyboard_typing` | Keyboard, Typing & Autocorrect Glitches | Fixing iOS 11.1 letter 'I' bug, typing lag, or predictive text |
| 5 | `apps_appstore` | App Store Downloads & App Performance | Fixing App Store download circle or specific app crashes |
| 6 | `audio_media` | Apple Music, Audio & Media Playback | Fixing sound volume, Apple Music library, or AirPods |
| 7 | `account_icloud` | Apple ID, iCloud & Account Security | Resetting Apple ID password, 2FA codes, or iCloud storage |
| 8 | `connectivity_network` | Wi-Fi, Bluetooth & Cellular Connectivity | Fixing greyed out Wi-Fi, Bluetooth pairing, or "No Service" |
| 9 | `billing_subscriptions` | Billing, App Store Purchases & Refunds | Processing refunds, subscription cancellations, or card charges |
| 10 | `other_unclear` | Out-of-Scope / Vague / Retail Fallback | Routing to human, asking clarification, or retail inquiries |

---

## 3. Disambiguation & Boundary Rules

### A. `software_update` vs. Functional Symptoms
- **Rule**: If a customer says *"Since updating to iOS 11 my battery dies in two hours"*, label as **`battery_power`**.
- **Rule**: If a customer says *"After the update my screen is completely black and frozen"*, label as **`display_hardware`**.
- **Rule**: If a customer says *"After updating, when I type 'I' it puts an 'A [?]'"*, label as **`keyboard_typing`**.
- **Rule**: Label as **`software_update`** **ONLY** if the problem is the update process itself (e.g., *"Unable to verify update"*, *"Update stuck downloading"*, *"How do I downgrade back to iOS 10"*).

### B. `display_hardware` vs. `billing_subscriptions`
- **Rule**: If a customer writes *"My iPad screen is broken, will it be a £400 repair bill?"*, label as **`display_hardware`**.
- **Rule**: `billing_subscriptions` is strictly reserved for digital Apple purchases, subscriptions, card overcharges, and refund claims. Hardware repair costs belong to hardware service.

### C. `apps_appstore` vs. `software_update`
- **Rule**: If an app (e.g. YouTube, Calendar, Mail) crashes after an update, label as **`apps_appstore`**.

### D. `audio_media` vs. `apps_appstore`
- **Rule**: If music playback stops, AirPods cut out, or sound is muffled, label as **`audio_media`**. If the Spotify app crashes on launch, label as **`apps_appstore`**.

### E. `account_icloud` vs. `billing_subscriptions`
- **Rule**: If an inquiry is about recovering a password, 2FA code, or iCloud storage quota, label as **`account_icloud`**. If it is about an unauthorized charge or canceling Apple Music subscription, label as **`billing_subscriptions`**.

### F. `other_unclear` vs. Technical Intents
- **Rule**: If the customer says *"Apple sucks, fix your phones"*, *"Help me please"*, or asks about shipping/retail store hours, label as **`other_unclear`**.

---

## 4. Benchmark Attribution & Integrity Policy

1. **AI Proposals vs. Human Judgments**:
   - `automaticProposedLabel` records the rule engine's recommendation.
   - `humanLabel` is only populated when an actual human explicitly verifies the tweet via `scripts/annotate-golden.js`.
2. **Benchmark Field (`evaluationLabel`)**:
   - Downstream benchmark tests compare predictions against `evaluationLabel`.
   - Records annotated by human reviewers have `evaluationLabelSource: "human_author"`.
   - Records with AI-generated proposals have `evaluationLabelSource: "automatic_proposal"`.
   - This prevents conflation between human ground truth and machine-generated labels.

