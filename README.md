# AppleSupport Intelligent Customer Support Assistant & Retrieval Engine

An end-to-end AI support engineering system built on real Twitter customer service interactions (`@AppleSupport`), featuring data-driven intent taxonomy, non-leaking evaluation benchmarks, baseline classification models, and a deterministic BM25 historical retrieval engine.

---

## 📌 Architecture & System Overview

```
                           Raw TWCS Dataset (~700MB, 2.8M Tweets)
                                             │
                                             ▼
                                  [Stream Processing Pipeline]
                                             │
                                             ▼
                             105,742 AppleSupport Customer Pairs
                                             │
               ┌─────────────────────────────┴─────────────────────────────┐
               ▼                                                           ▼
    [Golden Evaluation Set]                                     [Historical Retrieval Index]
    - 200 Initial Inquiries                                     - 105,542 Pairs (Strict Quarantine)
    - 4 Author Verified + 196 AI Proposals                      - Pure BM25 Lexical Ranking
    - 10 Data-Driven Taxonomy Intents                           - Zero Leakage (0 Golden Hits)
               │                                                           │
               ▼                                                           ▼
    [Baseline Classifiers]                                      [Diagnostic Retrieval Eval]
    - Majority Class (Acc: 24.50%)                              - Recall@1: 60.0%
    - TF-IDF + Naive Bayes (Acc: 70.00%)                         - Recall@5: 88.5%
                                                                - Recall@10: 94.5%
```

---

## 📊 Core Empirical Results Across Phases

### Phase 4: Baseline Classifiers (200-Query Golden Set)
| Model | Accuracy | Macro Precision | Macro Recall | Macro F1 | Latency |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Majority Class Baseline** | 24.50% | 2.45% | 10.00% | 3.94% | 0.001 ms |
| **TF-IDF + Naive Bayes Baseline** | **70.00%** | **68.64%** | **66.19%** | **66.97%** | 0.021 ms |

### Phase 5: BM25 Historical Retrieval Engine (200-Query Golden Set)
| Retrieval Metric | Top-1 ($k=1$) | Top-3 ($k=3$) | Top-5 ($k=5$) [Default] | Top-10 ($k=10$) |
| :--- | :---: | :---: | :---: | :---: |
| **Intent-Level Recall@K** | **60.0%** | **83.5%** | **88.5%** | **94.5%** |
| **Avg Same-Intent Hits / Query** | 0.60 / 1 | 1.77 / 3 | **2.85 / 5** | 5.51 / 10 |
| **Intent Precision@K** | 60.0% | 59.3% | 57.1% | 55.4% |
| **Author Subset Recall ($N=4$)** | 75.0% | 75.0% | 75.0% | 100.0% |
| **AI Proposals Recall ($N=196$)** | 59.7% | 83.7% | 88.8% | 94.4% |

- **Zero-Result Rate**: `0.00%` across all 200 evaluation queries.
- **Exact Text Duplicate Rate**: `1.00%` (2 queries with verbatim customer matches in historical corpus).
- **Inference Latency**: `< 5 ms` per query on CPU in native Node.js.

---

## 🔒 Evaluation Benchmark & Data Provenance

> [!IMPORTANT]
> **Strict Provenance Disclosure**:
> The 200-item evaluation set (`data/golden/golden-set.jsonl`) contains:
> - **4 genuine author-reviewed labels** (verified by Varshith)
> - **196 high-confidence AI-proposed labels** generated via structured taxonomy guidance.
>
> In Phase 5, retrieval evaluation is diagnostic and intent-level: relevance is defined as whether the retrieved historical interaction shares the same Phase 2 taxonomy intent as the query's `evaluationLabel`.

### Zero-Leakage Quarantine
- The 200 golden customer inquiries and their associated pairs are completely excluded from the retrieval index.
- Total source pairs: **105,742**
- Golden tweet IDs loaded: **200**
- Excluded matching pairs: **200**
- Final eligible index population: **105,542**
- Leakage verification (`npm run verify:leakage`): **0 golden IDs** in the index, **0 golden hits** returned in top-20 candidate searches across all 200 queries.

---

## 📁 Repository Structure

```
├── data/
│   ├── raw/                   # Raw Kaggle TWCS CSV (gitignored)
│   ├── processed/             # Cleaned 105,742 AppleSupport pairs (gitignored)
│   ├── golden/                # 200-item benchmark with provenance & agreement
│   ├── models/                # Trained baselines & retrieval metadata
│   └── evaluation/            # JSON results for baselines & retrieval
├── docs/
│   ├── intent-taxonomy.md     # 10 data-driven intents with audit & rules
│   ├── golden-set-methodology.md
│   ├── baseline-results.md    # Confusion matrix & per-intent metrics
│   └── retrieval-results.md   # BM25 architecture & diagnostic benchmark
├── scripts/
│   ├── prepare-data.js        # Streaming CSV parser & pair extractor
│   ├── sample-golden-set.js   # Stratified deterministic sampling
│   ├── train-baselines.js     # Majority & TF-IDF Naive Bayes training
│   ├── evaluate-baselines.js  # Baseline evaluation & metrics calculation
│   ├── build-retrieval-index.js # BM25 inverted index builder with quarantine
│   ├── evaluate-retrieval.js  # Intent-level Recall@K evaluation
│   ├── inspect-retrieval.js   # CLI inspector for interactive queries
│   ├── test-retrieval.js      # 12 automated unit & quality tests
│   ├── verify-retrieval-leakage.js # Authority leakage verification
│   └── verify-retrieval-determinism.js # Dual-run ranking & scoring check
├── src/
│   ├── classification/        # Tokenizer, TF-IDF, Naive Bayes, Evaluator
│   └── retrieval/             # BM25 engine & search index manager
├── decision_log.md            # Comprehensive chronological engineering log
├── package.json               # Node.js dependencies & run scripts
└── README.md
```

---

## 🚀 Quickstart & Reproduction

### Prerequisites
- Node.js `v20.x` or higher
- Windows / macOS / Linux

### Installation
```bash
git clone <repository-url>
cd "Hiver assignment"
npm install
```

### Reproducing Retrieval Engine (Phase 5)
```bash
# 1. Build BM25 Index (takes ~15s, quarantines 200 golden examples)
npm run build:retrieval

# 2. Run Quality & Integrity Unit Tests (12 checks)
npm test

# 3. Verify Zero-Leakage Authoritatively
npm run verify:leakage

# 4. Verify Dual-Run Ranking & Scoring Determinism
npm run verify:determinism

# 5. Run Intent-Level Diagnostic Evaluation
npm run evaluate:retrieval
```

### Interactive Query Inspection
Query the historical retrieval engine directly from the command line:
```bash
node scripts/inspect-retrieval.js "my iphone battery is draining very fast"
node scripts/inspect-retrieval.js "forgot my icloud password and locked out"
node scripts/inspect-retrieval.js "airpods sound only coming out of one ear"
```

---

## ⚙️ Tech Stack & Engineering Decisions

- **Runtime**: Pure Node.js (v20.20.0), CommonJS modules.
- **Dependencies**: Native Node.js `fs`, `readline`, `crypto` for high performance.
- **Algorithms**:
  - BM25 with Robertson-Spärck Jones IDF: $\text{IDF}(q) = \ln\left(\frac{N - df + 0.5}{df + 0.5} + 1\right)$
  - Parameters: $k_1 = 1.2$, $b = 0.75$, $\text{minDocFreq} = 2$.
  - Domain-aware Apple tokenization preserving hardware version numbers (`ios11.1.2`, `iphone7plus`, etc.).
- **Auditability**: Every decision, threshold, and parameter choice is recorded in [`decision_log.md`](file:///c:/Users/varsh/OneDrive/Desktop/Hiver%20assignment/decision_log.md).
