# AppleSupport Intelligent Customer Support Assistant & Retrieval Engine

An end-to-end AI support engineering system built on real Twitter customer service interactions (`@AppleSupport`), featuring a data-driven intent taxonomy, non-leaking evaluation benchmarks, classical baseline models, a deterministic BM25 historical retrieval engine, and a safety-guarded AI support agent.

---

## 🎯 Authoritative Benchmark Headline

> *"On the 200-item quarantined benchmark (4 author-reviewed, 196 automatic proposals), the agent achieves 69.50% intent classification agreement, 88.50% raw BM25 intent Recall@5 across 105,542 historical interactions, and 94.50% strict task correctness, with a 100% deterministic safety/policy gate pass rate."*

> [!IMPORTANT]
> **Essential Provenance & Metric Disclosure**:
> - **Evaluation Set Provenance**: The 200-item evaluation set (`data/golden/golden-set.jsonl`) contains **4 independently author-reviewed labels** (verified by Varshith) and **196 automatic taxonomy proposals**. Therefore, classification metrics primarily measure agreement with the project's automatic labeling pipeline rather than certified independent human ground truth.
> - **Strict Task Correctness ($94.50\%$, $189/200$)**: Requires correct intent classification on all auto-handled queries. All 11 misclassified auto-handled queries (including `GOLD-172`) are strictly scored as **FAILURES (0)**. This measures technical policy compliance, NOT independently human-validated customer satisfaction.
> - **Safety / Policy Gate Pass Rate ($100.00\%$, $200/200$)**: Measures pipeline safety constraints (non-crashing execution, length $\le 280$, no internal leaks, safe escalation of account mutations), NOT customer problem resolution.
> - **Offline Judge Sanity Check ($4.339 / 5.0$)**: Generated 100% by local `DeterministicMockJudge`. Real frontier LLM-as-judge benchmarking was **NOT** executed because API keys were unavailable.

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
| **Majority Class Baseline** | 24.50% | 2.45% | 10.00% | 3.94% | 9.64% | Trivial baseline; always predicts empirical majority class `other_unclear` (74.50% training share; 49/200 = 24.50% eval share) |
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
| **Raw Corpus BM25 Recall@5** | 75.00% (3/4) | 88.78% (174/196) | **88.50%** (177/200) | Identical to Phase 5 raw retrieval across 105,542 docs |
| **Post-Filter Prompt Alignment** | 75.00% (3/4) | 79.08% (155/196) | **79.00%** (158/200) | Filtered prompt candidates (max 3, intent prioritized) |
| **Routing Decision (Auto / Escalate)** | — | — | **54.50% / 45.50%** | 109 Auto-handled / 91 Escalated |
| **Strict Task Correctness Rate** | **75.00%** (3/4) | **94.90%** (186/196) | **94.50%** (189/200) | Penalizes 11 misclassified auto-handled queries as FAIL (0) |
| **Safety / Policy Gate Pass Rate** | **100.00%** (4/4) | **100.00%** (196/196) | **100.00%** (200/200) | $C_{\text{valid}} \land R_{\text{pass}} \land D_{\text{appropriate}} \land Q_{\text{pass}}$ |
| **Offline Harness Score (1–5)** | 4.330 / 5.0 | 4.340 / 5.0 | **4.339 / 5.0** | Offline rule engine sanity check (real LLM not executed) |

- **Mean Processing Latency**: `~53 ms` per inquiry on CPU in native Node.js.
- **Authoritative Report**: [`REPORT.md`](file:///c:/Users/varsh/OneDrive/Desktop/Hiver%20assignment/REPORT.md) and [`docs/agent-evaluation-report.md`](file:///c:/Users/varsh/OneDrive/Desktop/Hiver%20assignment/docs/agent-evaluation-report.md).
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
│   └── test-agent.js          # 24 automated agent unit tests (zero-key offline mock)
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

## 🚀 Quickstart & Rapid Reproduction (< 1 Minute)

The repository is completely self-contained and runnable offline. The compressed BM25 historical retrieval index (`data/models/applesupport-retrieval-index.json.gz`, 18.94 MB) is tracked directly in the repository and decompresses transparently into memory in ~230 ms.

> [!TIP]
> **No Heavy Downloads Required**: Evaluators do **NOT** need to download or stream the 492 MB raw Kaggle CSV to reproduce the benchmark or run the agent. All models, evaluation datasets, and retrieval indexes are pre-packaged.

### Prerequisites
- Node.js `v20.x` or higher
- Windows / macOS / Linux

### Installation & Verification (< 35 Seconds Total)
```bash
# 1. Clone repository and install minimal dependencies (takes ~5s)
git clone https://github.com/Varshith-kummarikunta/hiver-ai-support-agent.git
cd hiver-ai-support-agent
npm install

# 2. Run all unit and system test suites (100% offline, zero API keys required)
npm test              # BM25 Retrieval Engine Unit Tests (12/12 Checks Passed, ~3s)
npm run test:agent    # AI Support Agent & Deterministic Guardrails (24/24 Checks Passed, ~2s)
npm run test:judge    # LLM-as-Judge Isolation & Rubric Tests (22/22 Checks Passed, ~1s)

# 3. Verify zero golden-set data leakage
npm run verify:leakage # Asserts 0 golden tweet IDs in retrieval index (4/4 Checks Passed, ~2s)

# 4. Verify ranking and scoring determinism
npm run verify:determinism # Dual-run test: 0 rank/score mismatches across 1,000 queries (~4s)

# 5. Run end-to-end evaluation benchmark across 200 quarantined queries
npm run evaluate:agent # Evaluates all 200 queries, writes JSON results & markdown report (~10s)

# 6. Verify all 44 factual claims and metrics byte-for-byte
node scripts/audit-phase7-facts.js # Automated Fact-Check Audit Engine (44/44 Checks Passed, ~3s)
```

---

## 🤖 Running the Support Agent Interactively

```bash
# Single query with default mock engine (~53 ms mean processing latency per inquiry in the offline local benchmark)
node scripts/run-agent.js "my iphone battery is draining very fast after update"

# Single query with sensitive account request (triggers deterministic escalation guardrail)
node scripts/run-agent.js "please refund my last app store subscription charge"

# Interactive multi-query CLI session
node scripts/run-agent.js --interactive

# Running with live frontier models (optional; requires environment variables)
export GEMINI_API_KEY="your-gemini-key"
node scripts/run-agent.js --provider=gemini "how do I reset network settings?"
```

---

## ⚙️ Tech Stack & Engineering Principles

- **Runtime**: Pure Node.js (v20.20.0), native ES Modules (`type: "module"`).
- **Dependencies**: Zero external AI orchestration frameworks (no LangChain, no LlamaIndex). Native Node.js `fetch`, `zlib`, `fs`, `readline`, `crypto` for minimal memory footprint and low latency (~53 ms mean processing latency per inquiry in the offline local benchmark).
- **Deterministic Business Guardrails**: Security-critical operations (password resets, refund claims, hardware repair bookings) are governed by deterministic guardrails that strictly override LLM decisions.
- **Configurable Engineering Constraints**:
  - `AGENT_MIN_CONFIDENCE=0.40`: Minimum Naive Bayes intent score before forcing diagnostic escalation.
  - `AGENT_MIN_BM25_SCORE=5.0`: Minimum BM25 score required for historical candidate grounding evidence.
  - `AGENT_TOP_K=5`: Number of historical candidate interactions retrieved.
  - `AGENT_MAX_REPLY_CHARS=280`: Twitter character length limit ensuring concise, actionable public replies.
- **Auditability**: Every decision, threshold, and parameter choice is recorded chronologically in [`decision_log.md`](file:///c:/Users/varsh/OneDrive/Desktop/Hiver%20assignment/decision_log.md).

---

## 📚 Citations & Borrowed Material

1. **Primary Dataset**:
   - Customer Support on Twitter (TWCS), Kaggle Dataset by *Thought Vector* (`thoughtvector/customer-support-on-twitter`). Extracted 105,742 valid customer→support conversation pairs from `@AppleSupport`.
2. **Information Retrieval & BM25**:
   - Robertson, S. E., Walker, S., Jones, S., Hancock-Beaulieu, M. M., & Gatford, M. (1994). *Okapi at TREC-3*. NIST Special Publication 500-225. Parameters configured: $k_1 = 1.2$, $b = 0.75$, Robertson-Spärck Jones IDF.
3. **Statistical Machine Learning & Naive Bayes**:
   - Manning, C. D., Raghavan, P., & Schütze, H. (2008). *Introduction to Information Retrieval*. Cambridge University Press. Sublinear TF scaling ($1 + \ln(\text{tf})$), smoothed IDF, L2 normalization, and log-space Multinomial Naive Bayes with Laplace smoothing ($\alpha = 0.5$).
4. **Official Domain Knowledge & Escalation URLs**:
   - Apple Inc. Official Support Portals: `reportaproblem.apple.com` (billing/refunds), `iforgot.apple.com` (Apple ID/password recovery), `getsupport.apple.com` (hardware repairs and Genius Bar appointments).
5. **Open-Source Tooling**:
   - `csv-parser` (^3.2.1) for stream processing large CSV files with backpressure.
   - `dotenv` (^17.4.2) for environment configuration.

