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
    - TF-IDF + Naive Bayes (Acc: 69.50%)                         - Recall@5: 88.5%
                                                                - Recall@10: 94.5%
```

---

## 📊 Core Empirical Results Across Phases

### Phase 4: Baseline Classifiers (200-Query Golden Set)
| Model | Accuracy | Macro Precision | Macro Recall | Macro F1 | Weighted F1 | Operational Description |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Majority Class Baseline** | 24.50% | 2.45% | 10.00% | 3.94% | 9.64% | Always predicts empirical majority class `other_unclear` (74.50% training share; 49/200 = 24.50% eval share) |
| **TF-IDF + Naive Bayes Baseline** | **69.50%** | **74.16%** | **74.07%** | **68.27%** | **65.05%** | Audited statistical baseline (10,373 feature vocabulary) |

### Phase 5: BM25 Historical Retrieval Engine (200-Query Golden Set)
| Retrieval Metric | Top-1 ($k=1$) | Top-3 ($k=3$) | Top-5 ($k=5$) [Default] | Top-10 ($k=10$) |
| :--- | :---: | :---: | :---: | :---: |
| **Raw Corpus BM25 Recall@K** | **60.0%** (120/200) | **83.5%** (167/200) | **88.5%** (177/200) | **94.5%** (189/200) |
| **Avg Same-Intent Hits / Query** | 0.60 / 1 | 1.77 / 3 | **2.85 / 5** | 5.51 / 10 |
| **Intent Precision@K** | 60.0% | 59.3% | 57.1% | 55.4% |
| **Author Subset Recall ($N=4$)** | 75.0% | 75.0% | 75.0% | 100.0% |
| **AI Proposals Recall ($N=196$)** | 59.7% | 83.7% | 88.8% | 94.4% |

### Phase 7: End-to-End Support Agent Benchmark (200-Query Golden Set)
| Evaluation Metric | Author Subset ($N=4$) | AI Proposals ($N=196$) | Overall Population ($N=200$) | Benchmark Notes |
| :--- | :---: | :---: | :---: | :--- |
| **Intent Classification Agreement** | 50.00% (2/4) | 69.90% (137/196) | **69.50%** (139/200) | Macro F1: 68.27% \| Weighted F1: 65.05% |
| **Raw Corpus BM25 Recall@5** | 75.00% (3/4) | 88.78% (174/196) | **88.50%** (177/200) | Identical to Phase 5 raw retrieval |
| **Post-Filter Prompt Alignment** | 75.00% (3/4) | 79.08% (155/196) | **79.00%** (158/200) | Filtered prompt candidate (max 3, intent prioritized) |
| **Routing Decision (Auto / Escalate)** | — | — | **54.50% / 45.50%** | 109 Auto-handled / 91 Escalated |
| **Strict Task Correctness Rate** | **75.00%** (3/4) | **94.90%** (186/196) | **94.50%** (189/200) | Requires correct intent on auto-handled queries |
| **Safety / Policy Gate Pass Rate** | **100.00%** (4/4) | **100.00%** (196/196) | **100.00%** (200/200) | $C_{\text{valid}} \land R_{\text{pass}} \land D_{\text{appropriate}} \land Q_{\text{pass}}$ |
| **Offline Harness Score (1–5)** | 4.330 / 5.0 | 4.340 / 5.0 | **4.339 / 5.0** | Offline rule engine sanity check (real LLM not executed) |

- **Mean Processing Latency**: `~53 ms` per inquiry on CPU in native Node.js.
- **Authoritative Report**: [`docs/agent-evaluation-report.md`](file:///c:/Users/varsh/OneDrive/Desktop/Hiver%20assignment/docs/agent-evaluation-report.md).
- **Frozen Judge Rubric**: [`docs/judge-rubric.md`](file:///c:/Users/varsh/OneDrive/Desktop/Hiver%20assignment/docs/judge-rubric.md).

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
│   ├── verify-retrieval-determinism.js # Dual-run ranking & scoring check
│   ├── run-agent.js           # CLI runner for AppleSupport AI Agent
│   └── test-agent.js          # 22 automated agent unit tests (zero-key offline mock)
├── src/
│   ├── agent/                 # Agent orchestrator, LLM adapters, schema, prompt, guardrails
│   ├── baselines/             # TF-IDF, Naive Bayes, Majority classifier, metrics
│   └── retrieval/             # BM25 engine & search index manager
├── decision_log.md            # Comprehensive chronological engineering log
├── package.json               # Node.js dependencies & run scripts
└── README.md
```

---

## 🤖 Phase 6: AI Support Agent Architecture

```
Incoming Customer Inquiry
          │
          ▼
1. Deterministic Intent Classification (Phase 4 TF-IDF + Naive Bayes)
   Output: predictedIntent, intentConfidence
          │
          ▼
2. Historical BM25 Retrieval (Phase 5 Inverted Index, Top-5)
   Output: 5 Quarantined Historical Interactions
          │
          ▼
3. Evidence Filtering & Substance Verification
   - Filters out non-substantive or low-scoring responses (AGENT_MIN_BM25_SCORE)
   - Prioritizes same-intent grounding interactions
   - Preserves divergent candidates when ambiguity exists
          │
          ▼
4. Pre-Generation Deterministic Guardrails
   - Account mutations (password resets, refunds, repairs) → Force ESCALATE
   - Vague venting in other_unclear ("fix this shit") → Force ESCALATE
   - Low confidence (< AGENT_MIN_CONFIDENCE) → Force ESCALATE
   - Insufficient or conflicting evidence → Force ESCALATE
          │
          ▼
5. LLM Response Generation (Gemini / OpenAI / Offline Mock)
   - Uses strict AppleSupport Twitter persona
   - Grounded strictly in supplied historical evidence
   - Prohibits invented URLs, policies, or action claims
          │
          ▼
6. Post-Generation Safety & Grounding Validation
   - Audits draft reply: zero internal IDs, zero BM25 scores, zero prompt leakage
   - Audits action claims: rejects "I have refunded / reset your password"
   - Audits schema and decision consistency
          │
          ▼
7. Final Decision & Harmonization Policy
   - If validation fails or API fails → Force ESCALATE
   - If pre-guardrail triggered → Force ESCALATE
   - All checks passed → AUTO-HANDLE
          │
          ▼
Structured Agent Output (Clean public reply + Internal audit trail)
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

### Running the AI Support Agent (Phase 6)
```bash
# 1. Run all automated agent tests (100% offline, zero API keys required)
npm run test:agent

# 2. Run single query via CLI
node scripts/run-agent.js "my iphone battery is draining very fast"

# 3. Run interactive session
node scripts/run-agent.js --interactive

# 4. Run with offline mock provider
node scripts/run-agent.js --provider=mock "my screen is freezing on black display"
```

### Running the End-to-End Evaluation Benchmark (Phase 7)
```bash
# 1. Run automated judge unit tests (22 tests verifying rubric scoring, binary flags, and isolation)
npm run test:judge

# 2. Run complete end-to-end benchmark across all 200 quarantined evaluation queries
npm run evaluate:agent
# (Generates data/evaluation/agent-evaluation-results.json and docs/agent-evaluation-report.md)
```

### Reproducing Retrieval & Baselines (Phases 4-5)
```bash
# Run baseline tests and evaluation
npm run evaluate:baselines

# Build BM25 index (takes ~15s, quarantines 200 golden examples)
npm run build:retrieval

# Run retrieval unit tests (12 checks)
npm test

# Verify zero golden leakage authoritatively
npm run verify:leakage

# Verify dual-run ranking & scoring determinism
npm run verify:determinism

# Run intent-level diagnostic retrieval evaluation
npm run evaluate:retrieval
```

---

## ⚙️ Tech Stack & Engineering Principles

- **Runtime**: Pure Node.js (v20.20.0), ES Modules (`type: "module"`).
- **Dependencies**: Native Node.js `fetch`, `fs`, `readline`, `crypto` for ultra-low latency and zero heavy SDK bloat.
- **Provider Adapters**: Native REST integrations for Google Gemini (`gemini-2.0-flash`), OpenAI (`gpt-4o-mini`), and `MockProvider` for reproducible offline testing.
- **Deterministic Business Guardrails**: Business and security rules override generative models to guarantee safe handling of passwords, billing disputes, and hardware repairs.
- **Configurable Engineering Constraints**:
  - `AGENT_MIN_CONFIDENCE=0.40`: Minimum Naive Bayes intent score before forcing clarification/escalation.
  - `AGENT_MIN_BM25_SCORE=5.0`: Minimum BM25 relevance score required for candidate grounding evidence.
  - `AGENT_TOP_K=5`: Number of historical candidate interactions retrieved.
  - `AGENT_MAX_REPLY_CHARS=280`: Configurable engineering length limit ensuring concise, high-signal public replies.
- **Auditability**: Every decision, threshold, and parameter choice is recorded chronologically in [`decision_log.md`](file:///c:/Users/varsh/OneDrive/Desktop/Hiver%20assignment/decision_log.md).

