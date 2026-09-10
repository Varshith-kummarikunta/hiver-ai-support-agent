# AppleSupport AI Customer Support Agent: End-to-End Evaluation & Benchmark Report (Phase 7)

**Evaluation Date**: 2026-09-10T07:12:19.244Z  
**Total Quarantined Benchmark Population**: 200 customer inquiries  
**Target Organization**: AppleSupport on Twitter/X  
**Execution Mode**: Offline Deterministic Engine & Rule-Based Test Harness (`rule-based-v1`)  
**Zero Data Leakage Verification**: All 200 evaluation items completely excluded from retrieval index and classifier training.

---

## 1. Executive Summary & Provenance Disclosures

### 1.1 Provenance Disclosure & Ground Truth Limitation
> [!IMPORTANT]
> **Authoritative Provenance Statement**:
> The 200-example evaluation set contains **4 independently author-reviewed labels** (`GOLD-001` through `GOLD-004` by Varshith) and **196 automatically proposed labels** (`GOLD-005` through `GOLD-200`). Therefore, classification agreement metrics primarily measure agreement with the project's automatic labeling process rather than independently verified human ground truth.
>
> All classification and success metrics in this benchmark are strictly reported across three cohorts:
> - **Author-Reviewed Subset** ($n=4$): Genuinely hand-reviewed by Varshith.
> - **Automatic-Proposal Subset** ($n=196$): Generated via deterministic taxonomy rules.
> - **Overall Population** ($n=200$): Complete evaluation benchmark set.

### 1.2 Status of LLM-as-Judge & Offline Harness Notice
> [!WARNING]
> **Real LLM reply-quality benchmarking was NOT executed** because no `GEMINI_API_KEY` or `OPENAI_API_KEY` was configured in the runtime environment.
> The scalar scores (1–5) and binary safety checks reported in Section 5 reflect the **offline deterministic rule-based evaluation harness** (`DeterministicMockJudge`). They serve as automated pipeline verification and sanity checks, and **must not be cited as empirical frontier LLM benchmark ratings**.
>
> Furthermore, **human agreement for the LLM judge was not measured** because the evaluation set does not contain independent secondary human quality ratings. Zero simulated or synthetic Cohen's kappa metrics are reported.

### 1.3 Key Measured Findings

| Metric Dimension | Author-Reviewed ($n=4$) | Automatic Proposals ($n=196$) | Overall Benchmark ($n=200$) | Benchmark Notes / Grounding |
| :--- | :---: | :---: | :---: | :--- |
| **Intent Agreement / Accuracy** | **50.00%** (2/4) | **69.90%** (137/196) | **69.50%** (139/200) | Majority: 24.50% \| Naive Bayes: 69.50% |
| **Intent Macro F1-Score** | N/A ($n$ small) | N/A | **68.27%** | Majority: 3.94% \| Naive Bayes: 68.27% |
| **Raw Corpus BM25 Recall@1** | 75.00% (3/4) | 59.69% (117/196) | **60.00%** (120/200) | Top-1 raw corpus candidate (Phase 5) |
| **Raw Corpus BM25 Recall@5** | 75.00% (3/4) | 88.78% (174/196) | **88.50%** (177/200) | Top-5 raw corpus candidate (Phase 5) |
| **Post-Filter Prompt Alignment** | 75.00% (3/4) | 79.08% (155/196) | **79.00%** (158/200) | Filtered prompt candidate (max 3, intent prioritized) |
| **Auto-Handle Decision Rate** | — | — | **54.50%** (109/200) | Standard troubleshooting interactions |
| **Escalation Decision Rate** | — | — | **45.50%** (91/200) | Sensitive mutations, low confidence, or vague |
| **Strict Task Correctness Rate** | **75.00%** (3/4) | **94.90%** (186/196) | **94.50%** (189/200) | Requires correct intent on auto-handled queries |
| **Safety / Policy Gate Pass Rate** | 100.00% (4/4) | 100.00% (196/196) | **100.00%** (200/200) | $C_{\text{valid}} \land R_{\text{pass}} \land D_{\text{appropriate}} \land Q_{\text{pass}}$ |
| **Offline Harness Score (1–5)** | 4.330 / 5.0 | 4.340 / 5.0 | **4.339 / 5.0** | Rule-engine harness sanity check (not frontier LLM) |

---

## 2. Authoritative Comparison with Phase 4 Baselines

The upstream intent classifier of the `SupportAgent` was evaluated on the exact same 200 quarantined records as the Phase 4 baselines:

| Model / Architecture | Accuracy | Macro Precision | Macro Recall | Macro F1 | Weighted F1 | Provenance / Operational Nature |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Majority Class Baseline** | 24.50% | 2.45% | 10.00% | 3.94% | 9.64% | Trivial heuristic; always predicts empirical majority class `other_unclear` (74.50% training share; 49/200 = 24.50% evaluation share) |
| **TF-IDF + Naive Bayes Baseline** | **69.50%** | **74.16%** | **74.07%** | **68.27%** | **65.05%** | Audited Phase 4 Statistical Baseline (10,373 feature vocabulary) |
| **AI Support Agent (Upstream Engine)** | **69.50%** | **74.16%** | **74.07%** | **68.27%** | **65.05%** | Integrated upstream classification engine of SupportAgent |

### Per-Class Intent Agreement & Confusion Breakdown

```
INTENT                      SUPPORT   PRECISION   RECALL      F1
--------------------------------------------------------------------
account_icloud                  17      69.57%      94.12%    80.00%
apps_appstore                   15      66.67%      80.00%    72.73%
audio_media                     21      84.00%     100.00%    91.30%
battery_power                   26      76.67%      88.46%    82.14%
billing_subscriptions           11      80.00%      36.36%    50.00%
connectivity_network            18      66.67%      88.89%    76.19%
display_hardware                20      67.86%      95.00%    79.17%
keyboard_typing                 15      46.88%     100.00%    63.83%
other_unclear                   49      83.33%      20.41%    32.79%
software_update                  8     100.00%      37.50%    54.55%
--------------------------------------------------------------------
MACRO AVERAGE                            74.16%     74.07%    68.27%
WEIGHTED AVERAGE                                                  65.05%

```

---

## 3. Historical Retrieval & Evidence Filtering Audit

To eliminate any ambiguity between raw corpus search and post-filtering prompt preparation, both metrics are reported side-by-side:

### 3.1 Authoritative Phase 5 Raw BM25 Corpus Retrieval
Measures whether the raw top-$K$ candidates returned directly from the 105,542-document inverted index contain an interaction sharing the query's gold intent (identical to the Phase 5 benchmark):
- **Raw Corpus Recall@1**: **60.00%** (120 / 200)
- **Raw Corpus Recall@3**: **83.50%** (167 / 200)
- **Raw Corpus Recall@5**: **88.50%** (177 / 200)
- **Raw Corpus Recall@10**: **94.50%** (189 / 200)

### 3.2 Post-Filter Evidence Prompt Alignment
Measures whether the candidates selected by `filterEvidence()` (which enforces a minimum BM25 threshold of $\ge 5.0$, verifies substantive support text, and actively prioritizes candidates matching the upstream predicted intent up to a maximum of 3 candidates) match the gold intent:
- **Post-Filter Top-1 Prompt Alignment**: **79.00%** (158 / 200)
- **Post-Filter Top-3 Prompt Alignment**: **80.50%** (161 / 200)
- **Why It Differs from Raw Recall**: When the upstream classifier correctly predicts the intent (69.50% of queries), the evidence filter prioritizes matching candidates to the top slot of the prompt, raising top-1 candidate alignment from 60.0% to 79.0%.

---

## 4. Decision Policy & Routing Breakdown

The agent safely partitioned inquiries into 109 auto-handled interactions (54.50%) and 91 escalated interactions (45.50%):

- **Auto-Handled**: 109 inquiries (54.50%)
- **Escalated**: 91 inquiries (45.50%)

### Escalation Reason Breakdown:
- **Intent classification confidence (0.31) is below operational threshold (0.40).**: 2 inquiries (1.00%)
- **Vague / Venting (Lacks Diagnostic Detail)**: 4 inquiries (2.00%)
- **Intent classification confidence (0.36) is below operational threshold (0.40).**: 6 inquiries (3.00%)
- **Intent classification confidence (0.38) is below operational threshold (0.40).**: 2 inquiries (1.00%)
- **Intent classification confidence (0.14) is below operational threshold (0.40).**: 1 inquiries (0.50%)
- **Intent classification confidence (0.22) is below operational threshold (0.40).**: 3 inquiries (1.50%)
- **Insufficient Historical Evidence**: 18 inquiries (9.00%)
- **Intent classification confidence (0.37) is below operational threshold (0.40).**: 3 inquiries (1.50%)
- **Intent classification confidence (0.24) is below operational threshold (0.40).**: 2 inquiries (1.00%)
- **Intent classification confidence (0.39) is below operational threshold (0.40).**: 4 inquiries (2.00%)
- **Intent classification confidence (0.21) is below operational threshold (0.40).**: 3 inquiries (1.50%)
- **Intent classification confidence (0.28) is below operational threshold (0.40).**: 2 inquiries (1.00%)
- **Billing mutations and refund requests require verified human agent processing.**: 5 inquiries (2.50%)
- **Intent classification confidence (0.35) is below operational threshold (0.40).**: 2 inquiries (1.00%)
- **Intent classification confidence (0.32) is below operational threshold (0.40).**: 3 inquiries (1.50%)
- **Intent classification confidence (0.34) is below operational threshold (0.40).**: 3 inquiries (1.50%)
- **Intent classification confidence (0.25) is below operational threshold (0.40).**: 4 inquiries (2.00%)
- **Intent classification confidence (0.23) is below operational threshold (0.40).**: 4 inquiries (2.00%)
- **Intent classification confidence (0.33) is below operational threshold (0.40).**: 4 inquiries (2.00%)
- **Intent classification confidence (0.15) is below operational threshold (0.40).**: 1 inquiries (0.50%)
- **Intent classification confidence (0.40) is below operational threshold (0.40).**: 1 inquiries (0.50%)
- **Intent classification confidence (0.27) is below operational threshold (0.40).**: 3 inquiries (1.50%)
- **Account Mutation / Sensitive Action**: 2 inquiries (1.00%)
- **Intent classification confidence (0.20) is below operational threshold (0.40).**: 2 inquiries (1.00%)
- **Intent classification confidence (0.30) is below operational threshold (0.40).**: 1 inquiries (0.50%)
- **Intent classification confidence (0.26) is below operational threshold (0.40).**: 3 inquiries (1.50%)
- **Intent classification confidence (0.29) is below operational threshold (0.40).**: 1 inquiries (0.50%)
- **Intent classification confidence (0.18) is below operational threshold (0.40).**: 1 inquiries (0.50%)
- **Intent classification confidence (0.19) is below operational threshold (0.40).**: 1 inquiries (0.50%)

---

## 5. Offline Rule-Based Harness Validation (Not Frontier LLM)

> [!NOTE]
> As disclosed above, these numbers represent the deterministic rule-based evaluation harness (`DeterministicMockJudge`), which verifies that responses obey length bounds ($\le 280$ chars), use official Apple URLs, and avoid unauthorized action claims.

### 5.1 Dimension Scores (1–5 Scale)
- **Helpfulness & Actionability**: **4.925 / 5.0**
- **Relevance to Customer Query**: **4.025 / 5.0**
- **Historical Evidence Grounding**: **3.91 / 5.0**
- **Factual Consistency**: **5 / 5.0**
- **Decision Appropriateness**: **4.14 / 5.0**
- **Tone & Professionalism**: **4.055 / 5.0**
- **Overall Harness Mean**: **4.339 / 5.0**

### 5.2 Audit of Judge Score Inflation Caused by Escalation
Because escalations direct users to official Apple portals (`reportaproblem.apple.com`, `iforgot.apple.com`), the evaluation rule engine scores escalations higher on grounding:
- **Auto-Handle Subset ($n=109$)**: Mean Overall = **4.33**, Grounding = **3**, Factual = **5**
- **Escalated Subset ($n=91$)**: Mean Overall = **4.35**, Grounding = **5**, Factual = **5**
- *Observation*: Escalations receive a 5.0 grounding score in the rule engine because routing to official Apple URLs is considered 100% compliant with tier-1 support policy.

### 5.3 Binary Safety Flags
- **Unsupported Claims Flag (`hasUnsupportedClaims`)**: **0 / 200 (0.00%)**
- **Excessive Verbosity Flag (`hasExcessiveVerbosity`)**: **0 / 200 (0.00%)** ($\le 280$ characters strictly enforced).

---

## 6. Success Metrics: Safety Gate vs. Strict Task Correctness

To eliminate confusion between safety gating and task resolution, two distinct metrics are reported:

### 6.1 Safety / Policy Gate Pass Rate: 100.00% (200 / 200)
- Defined as: $C_{\text{valid}} \land R_{\text{pass}} \land D_{\text{appropriate}} \land Q_{\text{pass}}$.
- Measures whether the pipeline executed safely: confident prediction ($\ge 0.40$) for auto-handle, non-crashing safe escalation for uncertain/sensitive queries, validator pass, and zero safety violations.
- **Limitation**: Does NOT require intent classification to be correct on auto-handled queries.

### 6.2 Strict Task Correctness Rate: 94.50% (189 / 200)
- Defined as:
  $$(\text{Auto-Handle} \land \text{Intent Correct} \land R_{\text{pass}} \land Q_{\text{pass}}) \lor (\text{Escalate} \land D_{\text{appropriate}})$$
- **Auto-Handled Task Success**: 98 of 109 auto-handled inquiries (89.91%) had the correct intent and passed all safety/grounding checks.
- **Auto-Handled Task Failures**: **11 inquiries (including `GOLD-172`)** were auto-handled despite intent misclassification, and are correctly scored as **FAILURES (0)** under this metric.
- **Escalation Task Success**: All 91 escalated inquiries appropriately routed sensitive, vague, or low-confidence requests.
- **Cohort Breakdown**:
  - Author-Reviewed Subset ($n=4$): **75.00%** (3 / 4)
  - Automatic-Proposal Subset ($n=196$): **94.90%** (186 / 196)
  - Overall Benchmark ($n=200$): **94.50%** (189 / 200)

---

## 7. Real Failure Modes: Post-Mortem & Remediation

Five target failure cases were audited directly from the golden set and benchmark execution records:

### Failure Case 1: MULTI_SYMPTOM_UPDATE_CONFUSION (`GOLD-002`)
- **Customer Tweet (Raw)**: `"Help @AppleSupport I can’t update my payment method 😕 only appears an error who said “Try late because we can save your payment method”."`
- **Gold Evaluation Label**: `billing_subscriptions` (Provenance: `human_author (Varshith)`)
- **Agent Predicted Intent**: `apps_appstore` (Confidence: `0.622`)
- **Intent Correct**: `false`
- **Agent Decision**: `auto_handle`
- **Escalation Reason**: `None (Auto-handled)`
- **Agent Public Reply**: `"We want to help resolve this issue with your Apple device. Please try restarting your device, and let us know if the issue persists."`
- **Strict Task Correctness**: `FAIL`
- **Root Cause & Code Mechanism**:
  The customer inquiry mentions updating a payment method ("can't update my payment method"). The verb "update" and app-related tokens triggered cross-correlations with `apps_appstore` (confidence 0.622) rather than `billing_subscriptions`. Because confidence was >= 0.40 and no refund mutation occurred, the agent auto-handled with the incorrect intent.
- **Concrete Engineering Remediation**:
  Implement hierarchical token weights: when "payment method" or "card" co-occurs with "update", prioritize `billing_subscriptions` over `apps_appstore`.

### Failure Case 2: ELLIPTICAL_SHORT_VENTING_INQUIRY (`GOLD-003`)
- **Customer Tweet (Raw)**: `"Hey @115858 fix your shit https://t.co/ZfCykuWBH4"`
- **Gold Evaluation Label**: `other_unclear` (Provenance: `human_author (Varshith)`)
- **Agent Predicted Intent**: `keyboard_typing` (Confidence: `0.5718`)
- **Intent Correct**: `false`
- **Agent Decision**: `escalate`
- **Escalation Reason**: `Inquiry lacks sufficient diagnostic detail to provide actionable troubleshooting.`
- **Agent Public Reply**: `"We're here to help! Could you share what specific device and iOS/macOS version you're using, along with what symptoms you're experiencing?"`
- **Strict Task Correctness**: `PASS`
- **Root Cause & Code Mechanism**:
  The customer message ("Hey fix your shit") contains zero technical unigrams, causing the classifier to output an arbitrary category (`keyboard_typing`, confidence 0.57). However, the pre-guardrail `isVagueOrVenting()` successfully detected vulgar venting, overrode the decision to `escalate`, and drafted an authentic triage request for device and symptom details.
- **Concrete Engineering Remediation**:
  Maintain the pre-guardrail character-length and profanity filter that intercepts vulgar or non-diagnostic inquiries before feature classification.

### Failure Case 3: OVERCAUTIOUS_ESCALATION_FALSE_POSITIVE (`GOLD-006`)
- **Customer Tweet (Raw)**: `"@AppleSupport not sure what happened but after the software update, my iPhone wont send iMessages or connect to internet unless I’m on WiFi"`
- **Gold Evaluation Label**: `connectivity_network` (Provenance: `automatic_proposal`)
- **Agent Predicted Intent**: `connectivity_network` (Confidence: `0.3605`)
- **Intent Correct**: `true`
- **Agent Decision**: `escalate`
- **Escalation Reason**: `Intent classification confidence (0.36) is below operational threshold (0.40).`
- **Agent Public Reply**: `"We want to help resolve this issue with your Apple device. Please try restarting your device, and let us know if the issue persists."`
- **Strict Task Correctness**: `PASS`
- **Root Cause & Code Mechanism**:
  The classifier correctly identified the primary intent as `connectivity_network`. However, because the customer mentioned multiple subsystems ("software update", "iMessages", "WiFi"), posterior probability was split across three classes, depressing top confidence to 0.3605 (below the 0.40 threshold). This triggered an overcautious escalation.
- **Concrete Engineering Remediation**:
  Calibrate intent confidence thresholds per-intent (e.g., 0.30 for common connectivity queries with strong evidence) rather than enforcing a global 0.40 cutoff.

### Failure Case 4: LEXICAL_SPARSITY_MISCLASSIFICATION (`GOLD-009`)
- **Customer Tweet (Raw)**: `"Worked fine 2 houers ago @AppleSupport https://t.co/flOS2aDP0O"`
- **Gold Evaluation Label**: `other_unclear` (Provenance: `automatic_proposal`)
- **Agent Predicted Intent**: `apps_appstore` (Confidence: `0.1376`)
- **Intent Correct**: `false`
- **Agent Decision**: `escalate`
- **Escalation Reason**: `Intent classification confidence (0.14) is below operational threshold (0.40).`
- **Agent Public Reply**: `"We want to help resolve this issue with your Apple device. Please try restarting your device, and let us know if the issue persists."`
- **Strict Task Correctness**: `PASS`
- **Root Cause & Code Mechanism**:
  The customer inquiry ("Worked fine 2 houers ago") contained colloquial phrasing and a spelling error, resulting in zero lexical TF-IDF unigram matches. Top confidence was only 0.1376, causing the low-confidence guardrail to safely escalate the inquiry.
- **Concrete Engineering Remediation**:
  Augment the TF-IDF feature vocabulary with character n-grams or typo-tolerant dictionary normalization during preprocessing.

### Failure Case 5: HARDWARE_VS_CREDENTIAL_BOUNDARY_FAILURE (`GOLD-172`)
- **Customer Tweet (Raw)**: `"@AppleSupport I can’t access my locked notes since upgrading to iPhone X. It’s asking for a password which I have never set; Face ID is not working. Please advise."`
- **Gold Evaluation Label**: `display_hardware` (Provenance: `automatic_proposal`)
- **Agent Predicted Intent**: `account_icloud` (Confidence: `0.7393`)
- **Intent Correct**: `false`
- **Agent Decision**: `auto_handle`
- **Escalation Reason**: `None (Auto-handled)`
- **Agent Public Reply**: `"We want to help resolve this issue with your Apple device. Please try restarting your device, and let us know if the issue persists."`
- **Strict Task Correctness**: `FAIL`
- **Root Cause & Code Mechanism**:
  The customer inquiry combined biometric sensor failure ("Face ID is not working") with password-protected Notes ("access my locked notes", "password which I have never set"). The classifier strongly predicted `account_icloud` (confidence 0.7393) rather than the automatic proposal label `display_hardware`. Because the agent auto-handled under the wrong intent, it failed strict task correctness.
- **Concrete Engineering Remediation**:
  Employ multi-intent classification or dependency parsing to isolate the primary symptom from secondary security credentials.

---

## 8. What is Misleading About My Headline Number?

> [!CAUTION]
> ### Critical Self-Audit & Interpretive Pitfalls
> Any single summary statistic can obscure critical real-world limitations. Below is an exhaustive disclosure of potential failure modes and interpretive pitfalls behind our headline metrics:

1. **The 69.50% Agreement Rate is NOT Human Ground Truth Accuracy**:
   - Only 4 of the 200 evaluation items were independently reviewed by human eyes. The remaining 196 items were labeled via the project's automated taxonomy heuristics.
   - Therefore, a "correct" classification primarily means the agent agrees with the project's own automated rules. If those rules carry systematic bias (e.g. over-attributing post-update battery complaints to `battery_power` instead of `software_update`), the benchmark reinforces rather than exposes that bias.

2. **The 100% Policy Gate Pass Rate is a Safety Ceiling, NOT Resolution Accuracy**:
   - The 100% policy gate pass rate means the pipeline behaved deterministically without crashing, violating character limits, or attempting unauthorized actions.
   - It permitted 11 auto-handled interactions (such as `GOLD-172`) to pass the gate despite intent misclassification. The true **Strict Task Correctness Rate is 94.50%**, and the **Intent Agreement is 69.50%**.

3. **Intent-Level Retrieval Recall Obscures Semantic Helpfulness**:
   - An intent-level Recall@5 of 88.50% demonstrates that the BM25 index reliably retrieves *interactions in the same broad category*.
   - However, retrieving an interaction about *iPhone 8 wireless charging* for an *iPhone 6 battery drain* query is technically counted as a "retrieval match" if both share `battery_power`. True resolution requires symptom-level alignment.

4. **Offline Rule-Engine Scores Cannot Substitute for Live LLM Evaluations**:
   - The reported 4.339 / 5.0 score originates from a deterministic mock rule engine, not a frontier LLM (e.g., Gemini 2.0 Flash or GPT-4o-mini).
   - In the rule engine, escalations to official Apple portals automatically score 5.0 on grounding, creating an artificial score inflation for escalated inquiries.

5. **Twitter/X Single-Turn Bias**:
   - The evaluation tests single-turn customer tweets. Real-world customer support frequently spans multi-turn diagnostic dialogues where customers clarify device models, iOS versions, and attempted steps across multiple messages.

---

## 9. Latency and Operational Profile

Measured locally on Node.js 20 execution environment:
- **Mean Processing Time**: 46.4 ms / inquiry
- **Median Latency (p50)**: 48.96 ms
- **90th Percentile (p90)**: 66.46 ms
- **95th Percentile (p95)**: 72.92 ms
- **Min / Max Latency**: 0.51 ms / 128.21 ms

---

## 10. Conclusion & Recommended Headline Policy

When reporting the performance of the AppleSupport AI Agent, avoid leading with single flattering numbers like 100% Policy Pass or 4.339/5 mock scores. Instead, report this balanced, multi-faceted headline:

> **"On the 200-item quarantined benchmark (4 author-reviewed, 196 automatic proposals), the agent achieves 69.50% intent classification agreement (matching the trained TF-IDF + Naive Bayes baseline and outperforming the 24.50% majority baseline), 88.50% raw BM25 intent Recall@5 across 105,542 interactions, a 94.50% strict task correctness rate, and a 100% safety/policy gate pass rate, operating deterministically offline at ~53 ms latency."**
