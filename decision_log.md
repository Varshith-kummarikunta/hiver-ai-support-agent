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

### Decision 5: Data-Driven 9-Intent Taxonomy Grounded in Empirical Support Cases
- **Context**: Generic benchmark taxonomies (like Banking77 or e-commerce categories) fail on consumer tech support. We required a compact, mutually distinct 6–10 intent taxonomy.
- **Decision**: Derived 9 core intents directly from empirical n-gram document frequencies across 74,426 initial customer inquiries: `software_update`, `battery_power`, `display_hardware`, `keyboard_typing`, `apps_appstore`, `audio_media`, `account_icloud`, `connectivity_network`, and `billing_subscriptions`.
- **Alternatives Considered**:
  - 4 broad categories (Hardware, Software, Account, Other): Too broad to provide meaningful historical grounding or specific troubleshooting advice.
  - 20+ granular intents (separating Wi-Fi from Bluetooth, AirPods from EarPods, battery charging from battery drain): Caused high confusion, sparse sample counts, and erratic evaluation boundaries.
- **Why Rejected**: The 9-intent taxonomy covers 66.6% of all initial inquiries with clear, distinguishable troubleshooting workflows and crisp escalation boundaries.
