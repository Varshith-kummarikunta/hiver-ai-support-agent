# Golden Evaluation Set Methodology

This document defines the methodology, sampling architecture, and contamination-prevention safeguards used to create the **200-example Golden Evaluation Set** for the AppleSupport AI agent.

---

## 1. Objective & Core Evaluation Principles

The purpose of the Golden Evaluation Set is to provide an **independent, uncompromised, hand-labelled benchmark** against which all intent classifiers, retrieval systems, and escalation policies are evaluated.

### Core Principles:
1. **No Circularity**: Automatic candidate labels or keyword heuristics are strictly forbidden from serving as ground truth.
2. **Blind Annotation**: Human annotators evaluate the customer message in isolation. Historical support replies are hidden during initial annotation to prevent hindsight bias.
3. **Realistic Stratification**: The sample reflects the full spectrum of customer communication—including noisy slang, typos, ambiguous boundary cases, and out-of-scope banter—rather than an idealized, artificial toy dataset.
4. **Anti-Leakage Guarantee**: Golden set examples are permanently quarantined from retrieval indexes, training sets, or classifier tuning pipelines.

---

## 2. Sampling Frame & Source Population

- **Source Dataset**: `thoughtvector/customer-support-on-twitter` (`twcs.csv`).
- **Target Brand**: `AppleSupport`.
- **Source Population**: **74,426 initial customer inquiries** (`isInitialInquiry: true` in `data/processed/applesupport_pairs.jsonl`).
- **Exclusions**: Follow-up customer tweets (replies within an existing conversation thread) were excluded to evaluate solely first-contact inquiry classification.
- **Deduplication**: 536 duplicate customer texts were pruned before sampling, leaving a clean population of **73,890 unique initial inquiries**.

---

## 3. Sampling Strategy & Stratification Breakdown

- **Random Seed**: `20260909` (Mulberry32 PRNG in `src/utils/prng.js` for 100% deterministic cross-platform reproduction).
- **Sample Size**: Exactly **200 examples**.
- **Sampling Method**: Stratified sampling across candidate intent pools to ensure every technical intent has sufficient sample support ($N \ge 8$ to $25$) for precision and recall calculation, while maintaining `other_unclear` as the largest single stratum (20%).

### Stratification Allocation:

| Stratum / Candidate Intent Pool | Available Pool | Sampled Count | Golden Share % | Targeted Edge Cases Included |
| :--- | :-: | :-: | :-: | :--- |
| `other_unclear` | 54,831 | **40** | 20.0% | General venting, retail store hours, shipping/pre-orders, foreign languages |
| `battery_power` | 7,324 | **25** | 12.5% | Sudden shutdown at 30%, charging failure, battery drain after OS update |
| `keyboard_typing` | 4,658 | **25** | 12.5% | iOS 11.1 capital 'I' bug, keyboard lag, autocorrect substitutions |
| `audio_media` | 2,191 | **20** | 10.0% | Apple Music streaming, AirPods cutting out, silent alarm volume |
| `display_hardware` | 1,085 | **20** | 10.0% | Frozen touchscreen, black screen of death, £400 screen repair bills |
| `account_icloud` | 1,056 | **18** | 9.0% | Apple ID security lockout, 2FA SMS delay, iCloud storage full |
| `connectivity_network` | 912 | **18** | 9.0% | Wi-Fi dropping/greyed out, Bluetooth car pairing, No Service carrier bug |
| `apps_appstore` | 1,153 | **16** | 8.0% | App Store download circle spinning, YouTube/Calendar app crashes |
| `billing_subscriptions` | 436 | **10** | 5.0% | Unauthorized iTunes charge, refund requests, subscription cancellations |
| `software_update` | 244 | **8** | 4.0% | "Unable to verify update", stuck on Apple logo, OS downgrade requests |
| **Total** | **73,890** | **200** | **100.0%** | **71 Ambiguous/Boundary Cases (35.5%)** |

---

## 4. Stratum Inclusions & Ambiguity Injection

To prevent an overly clean, synthetic evaluation set, the sampling algorithm enforced:
- **35.5% Ambiguous / Boundary Cases (71 / 200)**: Specific co-occurrences of update + symptom, bill + hardware repair, card + Wi-Fi, and short ambiguous queries.
- **18 Short Inquiries (<30 characters)**: e.g., *"Tf is wrong with my keyboard"*, *"Hey fix your shit"*.
- **30 Inquiries with URLs/Attachments**: Capturing real-world screenshot links and image references.

---

## 5. Annotation Process & Guidelines

1. **Blind Label Assignment**: Annotators use `scripts/annotate-golden.js`. The tool presents `customerTextClean` and available labels without showing the support response.
2. **Standard Taxonomy Version**: Annotators reference `docs/annotation-guide.md` (Version 2.0, 10 intents).
3. **Double Annotation**: A designated subset of **50 examples** (`data/golden/golden-agreement.jsonl`) is independently labelled by a second annotator to measure inter-annotator agreement (Cohen’s Kappa).
4. **Adjudication**: Any disagreement between Annotator A and Annotator B is reviewed by a third adjudicator with a documented rationale.

---

## 6. Leakage Prevention Safeguards

- **Zero Contamination**: The 200 golden tweet IDs are recorded in `data/golden/golden-set.jsonl`.
- **Pre-Execution Check**: `scripts/check-golden-leakage.js` verifies:
  1. No duplicate tweet IDs within the golden set.
  2. No duplicate customer texts.
  3. Golden set tweet IDs are excluded from the retrieval corpus (`src/retrieval/`).
  4. Golden labels are not derived from automated taxonomy candidates.
