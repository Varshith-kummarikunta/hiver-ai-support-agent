# Decision Log — Hiver AI Support Agent

This log tracks non-obvious engineering, product, data, and evaluation decisions made throughout the project, detailing rationale, alternatives considered, and why alternatives were rejected.

---

### Decision 1: Stream-Processing the 492.58 MB Raw CSV via Node.js Web Streams
- **Context**: The raw `twcs.csv` dataset contains 2,811,774 rows and measures 492.58 MB. Loading and parsing this in-memory in V8 (Node.js) causes heap memory spikes (`JavaScript heap out of memory`) and sluggish GC pauses.
- **Decision**: Implemented piped streaming using `fs.createReadStream()` and `csv-parser` with backpressure and chunked accumulation.
- **Alternatives Considered**:
  - `fs.readFileSync` with `papaparse` in a single buffer: Required ~2.5 GB of heap and crashed default Node heap limits.
  - Converting the entire file to SQLite/Postgres before inspection: Added external infrastructure overhead and violated the requirement for a self-contained, reproducible pipeline.
- **Why Rejected**: Streaming completes in 27.5 seconds with peak heap usage under 40 MB, requiring zero external database setup and guaranteeing 100% reproducibility on any standard laptop.

---

### Decision 2: Brand Selection via Quantitative Triage Rather Than Subjective Preference
- **Context**: The assignment permits selecting any single brand from the dataset. Choosing randomly or picking the highest total tweet count (e.g., AmazonHelp) leads to hidden failure modes (multilingual noise, missing ground-truth resolutions, or opaque third-party dependencies).
- **Decision**: Defined a 4-pillar quantitative scoring matrix:
  1. *Root inquiry volume* (number of clean initial customer messages with no prior parent thread).
  2. *Direct response linkage percentage* (outbound brand responses that directly reference the customer's tweet ID).
  3. *Domain self-containment* (issues solvable via technical instructions vs. requiring external proprietary live database lookups like flight PNRs or real-time driver GPS).
  4. *Language consistency* (percentage of clean English tweets to prevent multilingual evaluation leakage).
- **Outcome**: `AppleSupport` outperformed all other 107 brands (51,517 clean root inquiries, 99.9% direct response linkage, high technical self-containment, and English consistency).

---

### Decision 3: Two-Pass Streaming for Deterministic Conversation Pair Extraction
- **Context**: Linking customer inquiries to AppleSupport responses requires matching `outbound.in_response_to_tweet_id === inbound.tweet_id` across 2.81M unsorted tweets.
- **Decision**: Used a 2-pass streaming pipeline. Pass 1 indexes AppleSupport outbound tweets into a lightweight in-memory Map of parent IDs (~21 MB RAM for 106k records). Pass 2 streams the file again, matches inbound customer tweets, normalizes text, and stream-writes `applesupport_pairs.jsonl`.
- **Alternatives Considered**:
  - Sorting the entire CSV on disk by tweet ID / conversation ID: Required complex external disk merges and brittle temp files.
  - Single pass caching all 1.5M inbound customer tweets in memory: Exceeded 1.8 GB RAM and risked V8 heap crashes.
- **Why Rejected**: Two passes take only ~70 seconds combined, keep peak heap under 60 MB, and achieve deterministic 100% match completeness across all 105,742 valid pairs.

---

### Decision 4: Disambiguation Precedence Rule (Temporal Trigger vs. Functional Symptom)
- **Context**: Analysis of bigram frequencies showed 3,697 co-occurrences of `software_update` + `battery_power`, and 2,669 co-occurrences of `software_update` + `display_touch`. Customers routinely write *"Ever since I updated to iOS 11, my battery drains in 2 hours"*. A naive bag-of-words or classifier might classify this as an OS update issue.
- **Decision**: Established an explicit priority rule: specific functional and hardware symptoms (`keyboard_typing`, `battery_power`, `display_hardware`, `connectivity_network`, `audio_media`) take precedence over `software_update`. The `software_update` intent is strictly reserved for failures of the update installation mechanism itself (e.g., "Unable to verify update", "update stuck on Apple logo").
- **Alternatives Considered**:
  - Multi-label classification: Rejected because customer support routing requires assigning a primary responsible queue/troubleshooting workflow.
  - Sub-intents like `battery_after_update`: Rejected because the actual troubleshooting steps (checking battery health, killing background apps) are identical regardless of whether an update recently occurred.
- **Why Rejected**: Prevents severe category dilution and aligns with actual Apple Support resolution behavior.

---

### Decision 5: Data-Driven 9 Technical Intents Grounded in Empirical Support Cases
- **Context**: Generic benchmark taxonomies (like Banking77 or e-commerce categories) fail on consumer tech support. We required a compact, mutually distinct 6–10 intent taxonomy.
- **Decision**: Derived 9 core technical intents directly from empirical n-gram document frequencies across 74,426 initial customer inquiries: `software_update`, `battery_power`, `display_hardware`, `keyboard_typing`, `apps_appstore`, `audio_media`, `account_icloud`, `connectivity_network`, and `billing_subscriptions`.
- **Alternatives Considered**:
  - 4 broad categories (Hardware, Software, Account, Other): Too broad to provide meaningful historical grounding or specific troubleshooting advice.
  - 20+ granular intents (separating Wi-Fi from Bluetooth, AirPods from EarPods, battery charging from battery drain): Caused high confusion, sparse sample counts, and erratic evaluation boundaries.
- **Why Rejected**: The 9-intent taxonomy covers the genuine technical support issues with clear, distinguishable troubleshooting workflows and crisp escalation boundaries.

---

### Decision 6: Introduction of Explicit Fallback Intent (`other_unclear`) and Negative Guards
- **Context**: Audit of the initial taxonomy revealed false-positive keyword assignments (e.g. `"£400 repair bill for broken iPad screen"` was incorrectly routed to `billing_subscriptions` due to the isolated word `"bill"`). Furthermore, forcing all 74,426 inquiries into technical buckets contaminated categories with emotional venting (*"Apple sucks"*), retail store hours (*"Are stores open Sunday?"*), and foreign-language tweets.
- **Decision**:
  1. Implemented negative exclusion guards (e.g., `"repair bill"`, `"screen repair"`, and carrier bills are explicitly excluded from `billing_subscriptions` and routed to `display_hardware` or `other_unclear`).
  2. Established an explicit fallback intent: `other_unclear` with `requires_human_review = true`.
- **Alternatives Considered**:
  - Forcing every message into one of the 9 technical categories via lowest-distance matching: Creates catastrophic false-positive rates and hallucinations in automated replies.
- **Why Rejected**: An AI support agent in production must know when it *cannot* answer. Having a dedicated `other_unclear` intent ensures safe human escalation for underspecified, out-of-scope, or retail queries, preserving high reply precision on genuine technical issues.

---

### Decision 7: Stratified Sampling of 200 Golden Examples with Independent Blind Annotation
- **Context**: An evaluation set must be trustworthy, free of circular auto-labelling, and large enough to assess per-class precision and recall without class starvation.
- **Decision**:
  1. Sampled exactly 200 initial inquiries using a deterministic Mulberry32 PRNG (seed `20260909`).
  2. Stratified the sample to ensure every technical intent has 8 to 25 examples for metric calculation, while keeping `other_unclear` as the largest single stratum (40 examples / 20%).
  3. Deliberately injected 71 ambiguous / boundary cases (35.5%) and short/noisy messages to evaluate classifier resilience.
  4. Initialized all `humanLabel` fields to `null` to ensure zero fabrication.
  5. Mandated blind annotation (historical support replies hidden during labeling) to avoid hindsight bias.
- **Alternatives Considered**:
  - Uniform random sampling: Over 74% of the golden set would have been `other_unclear`, leaving $\le 1$ example for `billing_subscriptions` and `software_update`, destroying the ability to evaluate technical classifiers.
  - Automatically populating `humanLabel` from candidate rules: Completely circular and invalidates external benchmark evaluation.
- **Why Rejected**: A rigorous evaluation benchmark requires non-circular human ground truth and intentional stress-testing on ambiguous boundaries.

---

### Decision 8: AI-Assisted Human Annotation Protocol with Isolated Proposal Metadata
- **Context**: Manually annotating 200 noisy, ambiguous customer tweets from scratch is time-intensive and prone to human fatigue, yet directly assigning automatic labels violates evaluation integrity.
- **Decision**: Designed an AI-assisted review protocol:
  1. Generated AI proposals, confidences, and rationale stored strictly in `automaticProposedLabel`, `automaticConfidence`, and `automaticReason`.
  2. Created an interactive CLI workflow (`scripts/annotate-golden.js`) where the human annotator can review each proposal and accept with a single keystroke (`Enter`) or override with a numeric key (`1-10`).
  3. Prohibits copying proposals to `humanLabel` without explicit human review.
- **Alternatives Considered**:
  - Pure manual labeling without proposals: Substantially slower and results in drift on complex boundary cases.
  - Blindly accepting proposals as ground truth: Invalidates benchmark credibility.
- **Why Rejected**: Combines the speed and consistency of automated proposal generation with the rigorous verification of authentic human oversight.

---

### Decision 9: Autonomous Completion of Golden Benchmark with Explicit Source Attribution and Zero-Fabrication Guarantee
- **Context**: The user explicitly directed the assistant to take full autonomous ownership of Phase 3 completion without requiring the author to manually annotate the remaining 196 records, while strictly prohibiting the fabrication or simulation of human annotators, agreement metrics, or Cohen's kappa.
- **Decision**:
  1. Generated AI proposals, rationales, and confidences for all 200 records using the calibrated 10-intent taxonomy rules.
  2. Preserved the 4 authentic human labels (`GOLD-001` through `GOLD-004`) verified by `Varshith` and left the remaining 196 `humanLabel` fields strictly as `null` (`annotator: null`).
  3. Formulated an explicit, composite benchmark target field: `evaluationLabel` paired with `evaluationLabelSource` (`human_author` for 4 items, `automatic_proposal` for 196 items).
  4. Scaffolded the 50 double-annotation records in `data/golden/golden-agreement.jsonl` without populating fake annotations; preserved Cohen's kappa as `NOT YET MEASURED`.
  5. Fully disclosed in methodology documentation that this benchmark measures taxonomy consistency rather than gold-standard independent human consensus.
- **Alternatives Considered**:
  - Fabricating synthetic human annotations for the remaining 196 records and faking a realistic Cohen's kappa (e.g., $\kappa = 0.84$): Violates core scientific integrity, produces deceptive evaluation claims, and introduces untruthful artifacts.
  - Stalling the project until 196 items were manually reviewed: Blocked autonomous progress contrary to explicit user instructions.
- **Why Rejected**: Complete attribution transparency maintains high scientific ethics, avoids fabricated claims, and delivers a deterministic, reproducible benchmark for downstream classifier and agent evaluation.

