# Final Project Report: Grounded AI Customer Support Agent for AppleSupport

**Author:** Varshith | **Role:** Hiver SDE Intern Assignment | **Domain:** `@AppleSupport` Twitter Automation  
**Quarantined Evaluation Benchmark:** $N=200$ customer interactions (4 author-reviewed, 196 automatic proposals)  
**Historical Corpus:** 105,542 quarantined AppleSupport pairs | **Final Repository Commit:** `1680a57`  

---

## Executive Summary & Authoritative Headline

> **Authoritative Benchmark Headline:**  
> *"On the 200-item quarantined benchmark (4 author-reviewed, 196 automatic proposals), the agent achieves 69.50% intent classification agreement (matching the trained TF-IDF + Naive Bayes baseline and outperforming the 24.50% majority baseline), 88.50% raw BM25 intent Recall@5 across 105,542 historical interactions, and 94.50% strict task correctness, with a 100% deterministic safety/policy gate pass rate, operating deterministically offline at ~53 ms latency."*

**Essential Provenance & Interpretation Context:**  
The evaluation benchmark contains **4 author-reviewed labels** and **196 automatic taxonomy proposals**. Classification metrics measure concordance with the project's automated labeling rules, not certified human consensus. **Strict Task Correctness ($94.50\%$, $189/200$)** strictly penalizes all 11 misclassified auto-handled interactions (including `GOLD-172`) as failures ($0$); it reflects technical policy compliance, NOT independently human-validated customer satisfaction. The **100% Safety / Policy Gate Pass Rate** verifies non-crashing execution and safe escalation of account mutations, not customer problem resolution. The **4.339/5** score is an offline `DeterministicMockJudge` test-harness sanity check; real frontier LLM-as-judge benchmarking was **not** executed.

---

## 1. Problem Framing & Definition of "Good"

Automating tier-1 customer support on Twitter (`@AppleSupport`) presents distinct operational constraints:
1. **High Brevity & Noise:** Customers submit terse, emotionally charged messages lacking diagnostic specifics (*"my battery is dying"* or *"fix your shit"*).
2. **Asymmetric Risk on False Actions:** Hallucinating account actions (*"I have refunded your card"* or *"I reset your password"*) creates severe security liabilities, compliance breaches, and customer distress.
3. **Repetitive Technical Triage:** Most queries involve known troubleshooting procedures (forced restarts, battery health audits, Wi-Fi profile resets) with established historical resolutions.

### Definition of "Good" Support Automation
A production-grade tier-1 support agent must satisfy five strict criteria:
- **Accurate Intent Triage:** Correctly maps noisy customer text into a crisp 10-intent technical taxonomy.
- **Verifiable Historical Grounding:** Grounds troubleshooting replies strictly in authentic past AppleSupport resolutions, citing verified procedures rather than inventing steps.
- **Strict Non-Destructive Escalation:** Identifies account mutations (passwords, refunds, repairs) or severe ambiguity and routes them to official human agents or authenticated portals (`reportaproblem.apple.com`, `iforgot.apple.com`).
- **Clean Public Persona:** Conforms to Twitter length constraints ($\le 280$ chars), never leaks internal reasoning or scores, and maintains an empathetic, professional tone.
- **Zero-Crash Deterministic Safety:** Executes reliably offline with sub-100 ms latency, failing safely to human escalation whenever inputs or models are uncertain.

---

## 2. What Was Deliberately Not Built and Why

| Feature / Architecture | Why It Was NOT Built | Better Alternative Implemented |
| :--- | :--- | :--- |
| **Dense Vector DB (Pinecone / Chroma)** | Tech support queries (*"error 3194"*, *"DFU mode"*, *"letter I bug"*) depend on exact lexical tokens. Neural embeddings introduce semantic drift, opaque scoring, heavy runtime dependencies, and high latency. | Native BM25 inverted index ($k_1=1.2, b=0.75$). Self-contained in Node.js, 18.9 MB compressed footprint, ~53 ms mean processing latency per inquiry in the offline local benchmark, and 100% deterministic ranking. |
| **Unconstrained LLM Decision-Making** | Generative models exhibit overconfidence on account actions, generating false promises (*"I have issued a refund"*). | Deterministic business guardrails strictly override LLM decisions for password resets, billing disputes, and hardware repair bookings. |
| **Autonomous Account Action Execution** | Executing live mutations from unauthenticated public tweets is an unacceptable security vulnerability. | Strict routing to authenticated official Apple portals or human tier-2 agents. |
| **Multi-Agent Conversational Swarms** | Tier-1 social support is a single-turn triage channel. Multi-agent swarms introduce non-deterministic latency and token costs without grounding data. | Single-turn high-precision pipeline with structured diagnostic escalation when context is missing. |
| **Fabricated Annotator Agreement** | Only 4 of the 200 evaluation items were verified by a human author. Fabricating secondary annotators or publishing a synthetic Cohen's kappa violates scientific integrity. | Transparent provenance disclosure: 4 author-reviewed items, 196 automated proposals, reported distinctly across subsets. |

---

## 3. Results vs. Baselines

Two baselines were trained on the non-golden corpus ($N=74,226$ interactions) and evaluated on the quarantined 200-item evaluation set:

### Benchmark Comparison Across Models ($N=200$)

| System / Model | Overall Accuracy / Agreement | Macro Precision | Macro Recall | Macro F1 | Weighted F1 | Operational Description |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Majority Class Baseline** | 24.50% | 2.45% | 10.00% | 3.94% | 9.64% | Predicts empirical majority class `other_unclear` (74.50% training share; 49/200 eval share). Fails completely on all 9 technical intents ($F_1 = 0\%$). |
| **TF-IDF + Naive Bayes Baseline** | **69.50%** | **74.16%** | **74.07%** | **68.27%** | **65.05%** | Native Node.js unigram+bigram model (10,373 features, sublinear TF, smoothed IDF, Laplace $\alpha=0.5$). Balanced training sample (8,557 items). |
| **AppleSupport AI Agent (Intent Stage)** | **69.50%** | **74.16%** | **74.07%** | **68.27%** | **65.05%** | Uses the trained TF-IDF + Naive Bayes classifier deterministically for upstream intent routing. |

### End-to-End System Performance Breakdown ($N=200$)

| Metric Dimension | Author Subset ($n=4$) | Automatic Proposals ($n=196$) | Full Benchmark ($N=200$) | Operational Role |
| :--- | :---: | :---: | :---: | :--- |
| **Intent Agreement / Accuracy** | 50.00% (2 / 4) | 69.90% (137 / 196) | **69.50%** (139 / 200) | Macro F1: 68.27% \| Weighted F1: 65.05% |
| **Raw BM25 Corpus Recall@1** | 75.00% (3 / 4) | 59.69% (117 / 196) | **60.00%** (120 / 200) | Top candidate shares intent |
| **Raw BM25 Corpus Recall@3** | 75.00% (3 / 4) | 83.67% (164 / 196) | **83.50%** (167 / 200) | Top-3 candidates contain intent |
| **Raw BM25 Corpus Recall@5** | 75.00% (3 / 4) | 88.78% (174 / 196) | **88.50%** (177 / 200) | Standard retrieval pool (105,542 docs) |
| **Raw BM25 Corpus Recall@10** | 100.00% (4 / 4) | 94.39% (185 / 196) | **94.50%** (189 / 200) | Diagnostic retrieval depth |
| **Post-Filter Prompt Alignment** | Top-1: 75.00% (3/4) | Top-1: 79.08% (155/196) | Top-1: **79.00%** \| Top-3: **80.50%** | Filtered prompt candidates (max 3) |
| **Routing Decisions** | — | — | **109 Auto (54.5%) / 91 Escalate (45.5%)** | Safe balance of triage vs. routing |
| **Strict Task Correctness Rate** | **75.00%** (3 / 4) | **94.90%** (186 / 196) | **94.50%** (189 / 200) | Penalizes 11 misclassified auto-handles as FAIL (0) |
| **Safety / Policy Gate Pass Rate** | **100.00%** (4 / 4) | **100.00%** (196 / 196) | **100.00%** (200 / 200) | Non-crashing, bounded safety execution |

---

## 4. Failure Mode Analysis (5 Real Evaluation Cases)

All five cases are audited directly from `data/evaluation/agent-evaluation-results.json`:

1. **`GOLD-002` (Author: Varshith) — Lexical Misclassification & Task Failure**  
   - *Customer:* *"Help @AppleSupport I can’t update my payment method 😕 only appears an error who said 'Try late because we can save your payment method'."*  
   - *Gold:* `billing_subscriptions` | *Predicted:* `apps_appstore` ($0.6220$) | *Decision:* `auto_handle`  
   - *Reply:* *"We want to help resolve this issue with your Apple device. Please try restarting your device, and let us know if the issue persists."*  
   - *Strict Task Correctness:* **FAIL (0)**  
   - *Root Cause:* The phrase *"can't update"* triggered heavy unigram weights for App Store updates (`apps_appstore`). Because confidence exceeded $0.40$, it auto-handled with generic restart advice rather than payment troubleshooting, failing the customer.

2. **`GOLD-003` (Author: Varshith) — Emotional Venting Safely Intercepted**  
   - *Customer:* *"Hey @115858 fix your shit https://t.co/ZfCykuWBH4"*  
   - *Gold:* `other_unclear` | *Predicted:* `keyboard_typing` ($0.5718$) | *Decision:* `escalate` (`vague_or_venting`)  
   - *Reply:* *"We're here to help! Could you share what specific device and iOS/macOS version you're using, along with what symptoms you're experiencing?"*  
   - *Strict Task Correctness:* **PASS (1)**  
   - *Root Cause:* The bag-of-words model misattributed image tokens to typing issues. However, the deterministic pre-guardrail `isVagueOrVenting` intercepted the query, recognized the lack of technical diagnostic nouns, and safely escalated with an authentic diagnostic inquiry.

3. **`GOLD-006` (Automatic Proposal) — Overcautious Escalation on Dual Symptoms**  
   - *Customer:* *"@AppleSupport not sure what happened but after the software update, my iPhone wont send iMessages or connect to internet unless I’m on WiFi"*  
   - *Gold:* `connectivity_network` | *Predicted:* `connectivity_network` ($0.3605$) | *Decision:* `escalate` (`low_confidence_intent`)  
   - *Reply:* Standard restart and triage guidance.  
   - *Strict Task Correctness:* **PASS (1)**  
   - *Root Cause:* Probability mass split across `software_update` ($0.29$) and `connectivity_network` ($0.36$). Because top confidence fell below $0.40$, the agent escalated. While safe, this represents an overcautious escalation on a solvable network configuration issue.

4. **`GOLD-009` (Automatic Proposal) — Missing Context Safely Diverted**  
   - *Customer:* *"Worked fine 2 houers ago @AppleSupport https://t.co/flOS2aDP0O"*  
   - *Gold:* `other_unclear` | *Predicted:* `apps_appstore` ($0.1376$) | *Decision:* `escalate` (`low_confidence_intent`)  
   - *Strict Task Correctness:* **PASS (1)**  
   - *Root Cause:* An elliptical follow-up with a link and typo (*"houers"*). Classifier probability collapsed ($0.1376$), properly triggering the low-confidence guardrail and preventing hallucinated advice.

5. **`GOLD-172` (Automatic Proposal) — Compound Technical Query Task Failure**  
   - *Customer:* *"@AppleSupport I can’t access my locked notes since upgrading to iPhone X. It’s asking for a password which I have never set; Face ID is not working. Please advise."*  
   - *Gold:* `display_hardware` | *Predicted:* `account_icloud` ($0.7393$) | *Decision:* `auto_handle`  
   - *Strict Task Correctness:* **FAIL (0)**  
   - *Root Cause:* An inquiry spanning biometric hardware (Face ID), security (locked notes password), and migration (iPhone X). The classifier latched onto *"password"* and *"locked"*, predicting `account_icloud` with $0.7393$ confidence. It bypassed escalation and gave generic restart advice, missing the biometric hardware fault. Under Strict Task Correctness, it is scored as a **FAILURE**.

---

## 5. What is Misleading About My Headline Number?

Scientific integrity requires examining how headline metrics can mislead if unexamined:

1. **The "100% Pass Rate" Fallacy:**  
   Our Safety / Policy Gate Pass Rate is $100.00\%$ ($200/200$). This measures pipeline execution safety (zero runtime crashes, reply length $\le 280$, no internal token leaks, safe escalation of account mutations), **NOT** customer satisfaction. Inquiries auto-handled under incorrect intents (`GOLD-002` and `GOLD-172`) passed this gate simply because they executed without runtime errors.
2. **The 94.50% Strict Task Correctness Nuance:**  
   While Strict Task Correctness appropriately penalizes all 11 misclassified auto-handled cases, 186 of the 189 passing scores originate from the automatic proposal subset. Therefore, 94.50% reflects adherence to deterministic pipeline rules, not human-certified problem resolution. On the 4 human-reviewed items, the score is $75.00\%$ ($3/4$).
3. **Escalation Score Inflation:**  
   In offline rule-based scoring, escalated inquiries receive an average grounding score of $5.000$ (because routing to official Apple URLs like `reportaproblem.apple.com` is 100% compliant), whereas auto-handled troubleshooting replies average $3.000$. A degenerate agent that escalates 100% of queries would achieve near-perfect grounding while delivering zero automation value.
4. **Intent Recall vs. Resolution Quality:**  
   Raw BM25 Recall@5 ($88.50\%$) means that in 177 of 200 queries, at least one of the top 5 retrieved interactions shared the query's taxonomy intent. However, two tweets within `battery_power` can describe different issues (cold-weather shutdowns vs. background app drain). A same-intent hit provides helpful grounding context, but does not guarantee an identical turnkey solution.

---

## 6. What I Would Do With One More Week

1. **Multi-Annotator Human Gold Standard ($N=250$):** Conduct a formal blind labeling campaign with 3 independent human annotators across 250 stratified interactions, measuring inter-annotator agreement via Cohen's and Fleiss' Kappa ($\kappa$) with an adjudication panel.
2. **Live Frontier LLM-as-Judge Benchmarking:** Execute the implemented `LLMJudge` harness using live frontier models (`gemini-2.0-flash` and `gpt-4o-mini`), collecting 100 human evaluation ratings to compute Pearson/Spearman correlation ($r$) against judge scores.
3. **Hybrid Lexical-Dense Retrieval (BM25 + ColBERT / RRF):** Complement the BM25 inverted index with a dense embedding encoder, combining scores via Reciprocal Rank Fusion ($RRF$) to capture exact technical tokens and colloquial paraphrases simultaneously.
4. **Multi-Turn Thread Reconstruction:** Reconstruct full conversation trees from TWCS via `response_tweet_id` pointers to evaluate multi-turn context retention and conversational resolution tracking.
5. **Production Canary & Agent-Assist Shadow Queue:** Deploy the agent in a shadow configuration alongside human support agents, measuring real-world Acceptance Rate ("Send Draft" clicks) and Time-to-First-Response reduction.

---

## 7. Evaluation Limitations & Provenance Disclosures

1. **Benchmark Label Provenance:** Only **4 of the 200 evaluation items** (`GOLD-001` through `GOLD-004`) were reviewed by a human author. The remaining **196 items** are automatic taxonomy proposals. Reported classification metrics indicate concordance with these rules rather than certified human truth.
2. **Offline Mock Mode Execution:** Because external API credentials were not configured in this runtime, all replies and judge scores were computed using deterministic local engines (`MockProvider` and `DeterministicMockJudge`). The 4.339/5 score is an internal test-harness sanity check, not frontier LLM benchmark evidence.
3. **Absence of Measured Human Agreement:** No secondary human ratings were collected; therefore, Cohen's kappa and human-judge agreement are not reported.
4. **Single-Turn Horizon:** The system evaluates inbound customer queries in isolation and does not track multi-turn dialogue history across extended threads.
5. **Lexical Representation Limits:** The upstream TF-IDF + Naive Bayes classifier relies on bag-of-words and bigram statistics, struggling with complex semantic negation or compound multi-symptom inquiries.

---

## 8. Reproduction & Verification Commands (< 35 Seconds Total)

The repository is self-contained and reproducible offline without downloading external multi-hundred-megabyte datasets:

```bash
npm install              # Install minimal dependencies (~5s)
npm test                 # BM25 Retrieval Engine Tests (12/12 Passed, ~3s)
npm run test:agent       # AI Support Agent & Guardrails (24/24 Passed, ~2s)
npm run test:judge       # LLM-as-Judge & Rubric Tests (22/22 Passed, ~1s)
npm run verify:leakage   # Zero Golden Data Leakage Audit (4/4 Passed, ~2s)
npm run verify:determinism # Deterministic Ranking & Scoring (0 mismatches, ~4s)
npm run evaluate:agent   # End-to-End Evaluation on 200 queries (writes JSON & report, ~10s)
npm run audit            # Automated Fact-Check Audit Engine (44/44 Passed, ~3s)
```
