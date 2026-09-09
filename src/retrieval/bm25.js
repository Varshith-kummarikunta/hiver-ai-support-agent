/**
 * Deterministic BM25 Lexical Retrieval Engine in Pure JavaScript.
 * 
 * Implements Robertson-Spärck Jones IDF and BM25 scoring with:
 * - Domain-aware tokenization
 * - Inverted index with sparse scoring
 * - Configurable k1 and b parameters
 * - Pure Node.js, zero external dependencies
 */

const DEFAULT_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'from', 'as', 'into', 'like', 'through', 'after', 'over', 'between', 'out',
  'against', 'during', 'without', 'before', 'under', 'around', 'among'
]);

export class BM25Engine {
  constructor(options = {}) {
    this.k1 = options.k1 ?? 1.2;
    this.b = options.b ?? 0.75;
    this.minDocFreq = options.minDocFreq ?? 2;
    this.stopwords = options.stopwords ?? DEFAULT_STOPWORDS;

    this.vocabulary = new Map(); // term -> index
    this.featureNames = [];      // index -> term
    this.idf = [];               // index -> IDF
    this.postings = [];          // index -> Array<[docId, tf]>
    this.docLengths = [];        // docId -> token count
    this.docCount = 0;
    this.avgDocLen = 0;
    this.isFitted = false;
  }

  /**
   * Preprocess and tokenize text into domain-aware unigrams.
   * @param {string} rawText
   * @returns {string[]} tokens
   */
  tokenize(rawText) {
    if (!rawText || typeof rawText !== 'string') return [];

    const text = rawText
      .toLowerCase()
      .replace(/&amp;/g, '&')
      .replace(/https?:\/\/t\.co\/[A-Za-z0-9]+/g, ' ') // Strip URLs
      .replace(/@\w+/g, ' ')                          // Strip handles
      .replace(/["“”]/g, ' ')                         // Isolate quoted words
      .replace(/[‘’]/g, "'")                          // Normalize apostrophes
      .replace(/[\uFE0F\u200D\uFFFD]/g, ' ')          // Strip unicode glitch chars
      .replace(/wi-fi/g, 'wifi')
      .replace(/apple\s+id/g, 'appleid')
      .replace(/app\s+store/g, 'appstore')
      .replace(/face\s+id/g, 'faceid')
      .replace(/touch\s+id/g, 'touchid');

    const rawTokens = text.match(/[a-z0-9]+(?:'[a-z]+)?/g) || [];
    const tokens = [];

    for (const tok of rawTokens) {
      if (tok.length === 1 && tok !== 'i') continue; // Preserve "i" for letter I bug
      if (this.stopwords.has(tok)) continue;
      tokens.push(tok);
    }

    return tokens;
  }

  /**
   * Build the inverted index and compute corpus statistics.
   * @param {string[]} documents - Array of customer text strings
   */
  fit(documents) {
    if (!Array.isArray(documents) || documents.length === 0) {
      throw new Error('BM25Engine.fit requires a non-empty array of document strings.');
    }

    this.docCount = documents.length;
    this.docLengths = new Array(this.docCount);
    let totalLen = 0;

    const termDocFreq = new Map(); // term -> df
    const termPostingsMap = new Map(); // term -> Array<[docId, tf]>

    for (let docId = 0; docId < this.docCount; docId++) {
      const tokens = this.tokenize(documents[docId]);
      this.docLengths[docId] = tokens.length;
      totalLen += tokens.length;

      // Count term frequencies in this doc
      const tfMap = new Map();
      for (const tok of tokens) {
        tfMap.set(tok, (tfMap.get(tok) || 0) + 1);
      }

      // Update global postings
      for (const [term, tf] of tfMap.entries()) {
        if (!termPostingsMap.has(term)) {
          termPostingsMap.set(term, []);
          termDocFreq.set(term, 0);
        }
        termPostingsMap.get(term).push([docId, tf]);
        termDocFreq.set(term, termDocFreq.get(term) + 1);
      }
    }

    this.avgDocLen = this.docCount > 0 ? totalLen / this.docCount : 0;

    // Filter by minDocFreq and build final inverted index
    const sortedTerms = Array.from(termDocFreq.keys()).sort();
    this.vocabulary.clear();
    this.featureNames = [];
    this.idf = [];
    this.postings = [];

    let nextIndex = 0;
    for (const term of sortedTerms) {
      const df = termDocFreq.get(term);
      if (df >= this.minDocFreq) {
        this.vocabulary.set(term, nextIndex);
        this.featureNames.push(term);

        // Robertson-Spärck Jones IDF: ln((N - df + 0.5) / (df + 0.5) + 1)
        const idfVal = Math.log((this.docCount - df + 0.5) / (df + 0.5) + 1.0);
        this.idf.push(Math.max(0, idfVal)); // Clamp negative IDF to 0
        this.postings.push(termPostingsMap.get(term));
        nextIndex++;
      }
    }

    this.isFitted = true;
    return this;
  }

  /**
   * Search the index for the top-K most relevant documents using BM25.
   * @param {string} queryText - Inquiry query
   * @param {number} topK - Number of results to return
   * @returns {Array<{ docId: number, score: number }>}
   */
  search(queryText, topK = 5) {
    if (!this.isFitted) {
      throw new Error('BM25Engine must be fitted before search().');
    }

    const queryTokens = this.tokenize(queryText);
    if (queryTokens.length === 0) {
      return [];
    }

    // Query term frequencies (qtf)
    const qtf = new Map();
    for (const tok of queryTokens) {
      const termIdx = this.vocabulary.get(tok);
      if (termIdx !== undefined) {
        qtf.set(termIdx, (qtf.get(termIdx) || 0) + 1);
      }
    }

    if (qtf.size === 0) {
      return []; // All query terms are out of vocabulary
    }

    // Accumulate BM25 scores across matching documents
    const docScores = new Map(); // docId -> score

    for (const [termIdx] of qtf.entries()) {
      const termIdf = this.idf[termIdx];
      if (termIdf <= 0) continue;

      const postingList = this.postings[termIdx];
      for (let i = 0; i < postingList.length; i++) {
        const [docId, tf] = postingList[i];
        const docLen = this.docLengths[docId];

        // BM25 term weight
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / this.avgDocLen));
        const termScore = termIdf * (numerator / denominator);

        docScores.set(docId, (docScores.get(docId) || 0) + termScore);
      }
    }

    if (docScores.size === 0) {
      return [];
    }

    // Convert to array and sort descending by score (break ties deterministically by docId)
    const candidates = Array.from(docScores.entries()).map(([docId, score]) => ({
      docId,
      score: Number(score.toFixed(4))
    }));

    candidates.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.docId - b.docId; // Deterministic tie-breaker
    });

    return candidates.slice(0, topK);
  }

  /**
   * Serialize BM25 inverted index to JSON.
   */
  toJSON() {
    return {
      modelType: 'BM25Engine',
      k1: this.k1,
      b: this.b,
      minDocFreq: this.minDocFreq,
      docCount: this.docCount,
      avgDocLen: this.avgDocLen,
      vocabulary: Array.from(this.vocabulary.entries()),
      featureNames: this.featureNames,
      idf: this.idf,
      postings: this.postings,
      docLengths: this.docLengths,
      isFitted: this.isFitted
    };
  }

  /**
   * Rehydrate BM25Engine from JSON data.
   */
  static fromJSON(data) {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    const engine = new BM25Engine({
      k1: parsed.k1,
      b: parsed.b,
      minDocFreq: parsed.minDocFreq
    });

    engine.docCount = parsed.docCount;
    engine.avgDocLen = parsed.avgDocLen;
    engine.vocabulary = new Map(parsed.vocabulary || []);
    engine.featureNames = parsed.featureNames || [];
    engine.idf = parsed.idf || [];
    engine.postings = parsed.postings || [];
    engine.docLengths = parsed.docLengths || [];
    engine.isFitted = Boolean(parsed.isFitted);
    return engine;
  }
}
