# Phase 5: Historical Retrieval System Report

This report documents the architecture, index construction, zero-leakage quarantine, and empirical evaluation of the **BM25 Historical Retrieval System** grounded in 105,542 real AppleSupport interaction pairs.

> [!WARNING]
> **Diagnostic Evaluation Disclosure**:
> This is a diagnostic intent-level retrieval evaluation measuring whether retrieved interactions share the query's Phase 2 taxonomy intent. It is not an independent human-labelled document relevance evaluation.
> 
> Relevance is defined strictly as: *the retrieved historical interaction has the same Phase 2 taxonomy intent as the query's `evaluationLabel`*. Out of 200 queries, 4 evaluation labels originate from author review and 196 from automatic proposals.

## 1. Executive Summary & Retrieval Metrics

| Retrieval Metric | Top-1 (k=1) | Top-3 (k=3) | Top-5 (k=5) [Default] | Top-10 (k=10) |
| :--- | :-: | :-: | :-: | :-: |
| **Intent-Level Recall@K** | **60.0%** | **83.5%** | **88.5%** | **94.5%** |
| **Avg Same-Intent Hits / Query** | 0.60 / 1 | 1.77 / 3 | **2.85 / 5** | 5.51 / 10 |
| **Intent Precision@K** | 60.0% | 59.3% | 57.1% | 55.4% |
| **Author Subset Recall ($N=4$)** | 75.0% | 75.0% | 75.0% | 100.0% |
| **AI Proposals Recall ($N=196$)** | 59.7% | 83.7% | 88.8% | 94.4% |

- **Zero-Result Rate**: **0.00%** across all 200 evaluation queries.
- **Exact Text Duplicate Rate**: **1.00%** (queries finding verbatim customer text in historical corpus).

---

## 2. Source Population & Quarantine Breakdown

- **Source Pairs**: **105,742 interactions** from `data/processed/applesupport_pairs.jsonl`.
- **Golden Evaluation IDs**: Exactly **200 tweet IDs** quarantined.
- **Matching Pairs Excluded**: Exactly **200 pairs** removed ($105,742 - 200 = 105,542$).
- **Final Retrieval Index Population**: Exactly **105,542 interactions**.
- **Multi-Response Conversations**: **23 interactions** contain multiple chronological support replies; preserved in `supportResponses` array.

---

## 3. Intent-Level Recall@5 Breakdown by Category

| Category | Intent Key | Query Support | Queries with Hit in Top-5 | Intent-Level Recall@5 |
| :--- | :--- | :-: | :-: | :-: |
| OTHER UNCLEAR | `other_unclear` | **49** | 49 | **100.0%** |
| BATTERY POWER | `battery_power` | **26** | 23 | **88.5%** |
| AUDIO MEDIA | `audio_media` | **21** | 21 | **100.0%** |
| DISPLAY HARDWARE | `display_hardware` | **20** | 17 | **85.0%** |
| CONNECTIVITY NETWORK | `connectivity_network` | **18** | 15 | **83.3%** |
| ACCOUNT ICLOUD | `account_icloud` | **17** | 17 | **100.0%** |
| APPS APPSTORE | `apps_appstore` | **15** | 8 | **53.3%** |
| KEYBOARD TYPING | `keyboard_typing` | **15** | 14 | **93.3%** |
| BILLING SUBSCRIPTIONS | `billing_subscriptions` | **11** | 8 | **72.7%** |
| SOFTWARE UPDATE | `software_update` | **8** | 5 | **62.5%** |

---

## 4. Technical Architecture & Parameters

- **Algorithm**: BM25 with Robertson-Spärck Jones IDF: $\text{IDF}(q) = \ln\left(\frac{N - df + 0.5}{df + 0.5} + 1\right)$.
- **Parameters**: $k_1 = 1.2$, $b = 0.75$, $\text{minDocFreq} = 2$.
- **Vocabulary Size**: 14,546 terms.
- **Artifact File**: `data/models/applesupport-retrieval-index.json` (128.12 MB).
- **Implementation**: Native Node.js (v20.20.0), zero Python, zero vector databases, zero LLMs.

---

## 5. Failure Cases & Limitations

1. **Short/Vague Queries in `other_unclear`**: Inquiries like *"fix this shit"* or *"heeeelp"* share low lexical overlap with resolution tweets, resulting in lower retrieval precision on out-of-scope banter.
2. **Hardware Diagnosis via Direct Message**: In historical tweets, AppleSupport frequently instructed customers to *"DM us to explore repair options"*. The retrieval engine accurately retrieves these historical interaction patterns, providing authentic historical context for future agent response drafting.
