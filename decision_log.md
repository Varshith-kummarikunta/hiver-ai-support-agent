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
