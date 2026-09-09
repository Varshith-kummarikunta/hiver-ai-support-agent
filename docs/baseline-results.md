# Phase 4: Baseline Models Evaluation Report

This report documents the design, implementation, and empirical evaluation of **two baseline intent classifiers** for the AppleSupport customer support inquiries.

> [!WARNING]
> **Scientific Integrity & Benchmark Provenance Disclosure**:
> These baseline metrics measure agreement with the constructed evaluation labels, not independently verified human ground truth.
> 
> The 200-example evaluation set consists of **4 authentic author-reviewed labels** (Varshith) and **196 AI-proposed labels** generated from the project's calibrated taxonomy rules. Results must NOT be interpreted as multi-annotator human ground truth.

## 1. Executive Summary & Comparative Results

| Evaluation Metric | Baseline 1: Majority Class | Baseline 2: Lexical TF-IDF + Naive Bayes | Delta (Abs.) | Relative Improvement |
| :--- | :-: | :-: | :-: | :-: |
| **Overall Accuracy** | **24.50%** | **69.50%** | **+45.00%** | **183.7%** |
| **Macro Precision** | 2.45% | 74.16% | +71.71% | — |
| **Macro Recall** | 10.00% | 74.07% | +64.07% | — |
| **Macro F1-Score** | **3.94%** | **68.27%** | **+64.33%** | **+0.6433** |
| **Weighted F1-Score** | 9.64% | 65.05% | +55.41% | — |
| **Author Subset Acc (N=4)** | 75.0% | 50.0% | +-25.0% | — |
| **AI Proposals Acc (N=196)** | 23.47% | 69.90% | +46.43% | — |

### Key Findings:
1. **Baseline 1 (Majority Class)** achieves **24.50% accuracy** by unconditionally predicting `other_unclear`. However, its **Macro F1 is only 3.94%** because it has 0% recall and 0% precision across all 9 technical support intents. This clearly illustrates why Macro F1 is essential for customer support triage.
2. **Baseline 2 (TF-IDF + Naive Bayes)** achieves **69.50% accuracy** and **68.27% Macro F1**, demonstrating strong lexical signal across technical categories while running deterministically in pure Node.js (measured mean latency 0.072 ms per query).

---

## 2. Dataset Split & Anti-Leakage Protocol

- **Corpus Population**: 74,426 initial inquiries from `applesupport_pairs.jsonl`.
- **Golden Evaluation Set**: Exactly **200 tweets** quarantined in `data/golden/golden-set.jsonl`.
- **Eligible Training Pool**: **74,226 tweets** (100% strictly non-golden; 0% leakage verified).
- **Training Data Labels**: Generated via Phase 2 taxonomy decision rules (disclosed as rule-assigned, not human-labelled).
- **Baseline 1 Training**: Full eligible population (74,226 items) to empirically derive majority class distribution.
- **Baseline 2 Training**: Deterministic stratified sample capped at 1,000 items per class (Mulberry32 PRNG seed `20260909`), yielding a balanced training set to prevent majority-class collapse.

---

## 3. Detailed Per-Intent Breakdown (Baseline 2: TF-IDF + Naive Bayes)

| Intent ID | Support | Precision | Recall | F1-Score | Status |
| :--- | :-: | :-: | :-: | :-: | :--- |
| `other_unclear` | **49** | 83.3% | 20.4% | **32.8%** | Challenging (Ambiguity / Low Support) |
| `battery_power` | **26** | 76.7% | 88.5% | **82.1%** | Strong |
| `keyboard_typing` | **15** | 46.9% | 100.0% | **63.8%** | Moderate |
| `audio_media` | **21** | 84.0% | 100.0% | **91.3%** | Strong |
| `display_hardware` | **20** | 67.9% | 95.0% | **79.2%** | Strong |
| `account_icloud` | **17** | 69.6% | 94.1% | **80.0%** | Strong |
| `connectivity_network` | **18** | 66.7% | 88.9% | **76.2%** | Strong |
| `apps_appstore` | **15** | 66.7% | 80.0% | **72.7%** | Strong |
| `billing_subscriptions` | **11** | 80.0% | 36.4% | **50.0%** | Moderate |
| `software_update` | **8** | 100.0% | 37.5% | **54.5%** | Moderate |

---

## 4. Confusion Matrices

### Baseline 2 (TF-IDF + Naive Bayes) Confusion Matrix

| True \ Pred | `other_unclear` | `battery_power` | `keyboard_typing` | `audio_media` | `display_hardware` | `account_icloud` | `connectivity_network` | `apps_appstore` | `billing_subscriptions` | `software_update` | Total |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| **`other_unclear`** | 10 | 4 | 14 | 0 | 6 | 5 | 7 | 2 | 1 | 0 | **49** |
| **`battery_power`** | 0 | 23 | 1 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | **26** |
| **`keyboard_typing`** | 0 | 0 | 15 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **15** |
| **`audio_media`** | 0 | 0 | 0 | 21 | 0 | 0 | 0 | 0 | 0 | 0 | **21** |
| **`display_hardware`** | 0 | 0 | 0 | 0 | 19 | 1 | 0 | 0 | 0 | 0 | **20** |
| **`account_icloud`** | 0 | 0 | 0 | 0 | 1 | 16 | 0 | 0 | 0 | 0 | **17** |
| **`connectivity_network`** | 1 | 0 | 1 | 0 | 0 | 0 | 16 | 0 | 0 | 0 | **18** |
| **`apps_appstore`** | 1 | 1 | 0 | 0 | 1 | 0 | 0 | 12 | 0 | 0 | **15** |
| **`billing_subscriptions`** | 0 | 2 | 0 | 3 | 0 | 1 | 0 | 1 | 4 | 0 | **11** |
| **`software_update`** | 0 | 0 | 1 | 0 | 1 | 0 | 0 | 3 | 0 | 3 | **8** |
| **Total** | **12** | **30** | **32** | **25** | **28** | **23** | **24** | **18** | **5** | **3** | **200** |


### Baseline 1 (Majority Class) Confusion Matrix

| True \ Pred | `other_unclear` | `battery_power` | `keyboard_typing` | `audio_media` | `display_hardware` | `account_icloud` | `connectivity_network` | `apps_appstore` | `billing_subscriptions` | `software_update` | Total |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| **`other_unclear`** | 49 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **49** |
| **`battery_power`** | 26 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **26** |
| **`keyboard_typing`** | 15 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **15** |
| **`audio_media`** | 21 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **21** |
| **`display_hardware`** | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **20** |
| **`account_icloud`** | 17 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **17** |
| **`connectivity_network`** | 18 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **18** |
| **`apps_appstore`** | 15 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **15** |
| **`billing_subscriptions`** | 11 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **11** |
| **`software_update`** | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **8** |
| **Total** | **200** | **0** | **0** | **0** | **0** | **0** | **0** | **0** | **0** | **0** | **200** |


---

## 5. Technical Specifications & Reproducibility

- **Environment**: Pure Node.js (v20.20.0), zero Python dependencies, zero LLMs, zero embedding APIs.
- **Tokenizer**: Custom regex-based word extractor with apostrophe preservation (`won't`, `can't`) and domain entity isolation (`wifi`, `appleid`, `appstore`).
- **Features**: Unigrams + Bigrams, Sublinear TF ($1 + \ln(\text{tf})$), Smoothed IDF ($\ln((1+N)/(1+df)) + 1$), L2 vector normalization.
- **Vocabulary Size**: 10,373 terms (min document frequency $\ge 3$, max ratio $0.85$).
- **Classifier**: Multinomial Naive Bayes with Laplace smoothing ($\alpha = 0.5$) and uniform class priors for balanced classification.
- **Execution Speed**: Empirically measured via `scripts/measure-timing.js` across 2,000 queries: mean inference latency is **0.0720 ms per query** (median 0.0545 ms, p95 0.1550 ms); model training on 8,557 documents takes **1,160.73 ms (~1.16 s)**.

---

## 6. Limitations & Context for Future Agent Design

1. **Lexical Boundary Sensitivity**: The Naive Bayes classifier relies on term co-occurrences. On multi-sentence tweets where a customer describes an update backstory (*"since updating to iOS 11..."*) before stating a battery drain symptom, bag-of-words can occasionally split probability mass between `software_update` and `battery_power`.
2. **Fallback Intent (`other_unclear`)**: Because `other_unclear` spans a diverse set of colloquial venting, retail questions, and vague one-liners, lexical models achieve lower precision on it compared to tightly keyworded hardware intents.
3. **Ground-Truth Calibration**: Because 196 evaluation labels were automatically assigned, this baseline evaluation quantifies how effectively a classical statistical model captures the taxonomy boundaries established in Phase 2.
