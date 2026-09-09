/**
 * TF-IDF Feature Vectorizer in Pure JavaScript.
 * Extracts unigrams and bigrams, computes smoothed IDF, and produces L2-normalized sparse vectors.
 */

// Light stopwords to filter out low-information noise without stripping domain words like "no", "not", "i", "app"
const DEFAULT_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'from', 'as', 'into', 'like', 'through', 'after', 'over', 'between', 'out',
  'against', 'during', 'without', 'before', 'under', 'around', 'among'
]);

export class TfidfVectorizer {
  constructor(options = {}) {
    this.minDocFreq = options.minDocFreq ?? 3;
    this.maxDocFreqRatio = options.maxDocFreqRatio ?? 0.85;
    this.useBigrams = options.useBigrams ?? true;
    this.sublinearTf = options.sublinearTf ?? true;
    this.stopwords = options.stopwords ?? DEFAULT_STOPWORDS;

    this.vocabulary = new Map(); // term -> index
    this.featureNames = [];      // index -> term
    this.idf = [];               // index -> smoothed IDF weight
    this.docCount = 0;
    this.isFitted = false;
  }

  /**
   * Preprocess and tokenize text into unigrams and bigrams.
   * @param {string} rawText
   * @returns {string[]} tokens
   */
  tokenize(rawText) {
    if (!rawText || typeof rawText !== 'string') return [];

    // Normalization
    let text = rawText
      .toLowerCase()
      .replace(/&amp;/g, '&')
      .replace(/https?:\/\/t\.co\/[A-Za-z0-9]+/g, ' ') // Strip URLs
      .replace(/@\w+/g, ' ')                          // Strip mentions
      .replace(/["“”]/g, ' ')                         // Isolate quoted words
      .replace(/[‘’]/g, "'")                          // Normalize apostrophes
      .replace(/[\uFE0F\u200D\uFFFD]/g, ' ')          // Strip unicode artifact markers
      .replace(/wi-fi/g, 'wifi')
      .replace(/apple\s+id/g, 'appleid')
      .replace(/app\s+store/g, 'appstore');

    // Extract word tokens: words with optional internal apostrophe (e.g., "won't", "don't") or single letters
    const rawTokens = text.match(/[a-z0-9]+(?:'[a-z]+)?/g) || [];

    const unigrams = [];
    for (const tok of rawTokens) {
      if (tok.length === 1 && tok !== 'i') continue; // keep "i" because of the iOS 11.1 "I" bug
      if (this.stopwords.has(tok)) continue;
      unigrams.push(tok);
    }

    if (!this.useBigrams || unigrams.length < 2) {
      return unigrams;
    }

    const tokens = [...unigrams];
    for (let i = 0; i < unigrams.length - 1; i++) {
      tokens.push(`${unigrams[i]}_${unigrams[i + 1]}`);
    }

    return tokens;
  }

  /**
   * Learn vocabulary and IDF from a training corpus.
   * @param {string[]} documents
   */
  fit(documents) {
    if (!Array.isArray(documents) || documents.length === 0) {
      throw new Error('TfidfVectorizer.fit requires a non-empty array of document strings.');
    }

    this.docCount = documents.length;
    const docFrequencies = new Map(); // term -> count of docs containing term

    for (const doc of documents) {
      const tokens = this.tokenize(doc);
      const uniqueTerms = new Set(tokens);
      for (const term of uniqueTerms) {
        docFrequencies.set(term, (docFrequencies.get(term) || 0) + 1);
      }
    }

    // Filter by minDocFreq and maxDocFreqRatio
    const effectiveMinDf = this.docCount <= 10 ? 1 : this.minDocFreq;
    const maxDocFreq = Math.floor(this.docCount * this.maxDocFreqRatio);
    this.vocabulary.clear();
    this.featureNames = [];
    this.idf = [];

    let nextIndex = 0;
    // Sort terms for determinism
    const sortedTerms = Array.from(docFrequencies.keys()).sort();

    for (const term of sortedTerms) {
      const df = docFrequencies.get(term);
      if (df >= effectiveMinDf && df <= maxDocFreq) {
        this.vocabulary.set(term, nextIndex);
        this.featureNames.push(term);
        // Smoothed IDF: ln((1 + N) / (1 + df)) + 1
        const idfVal = Math.log((1 + this.docCount) / (1 + df)) + 1.0;
        this.idf.push(idfVal);
        nextIndex++;
      }
    }

    this.isFitted = true;
    return this;
  }

  /**
   * Transform a single document into a sparse TF-IDF vector: Map<featureIndex, weight>
   * @param {string} document
   * @returns {Map<number, number>} Sparse vector
   */
  transform(document) {
    if (!this.isFitted) {
      throw new Error('TfidfVectorizer must be fitted before transform()');
    }

    const tokens = this.tokenize(document);
    const termCounts = new Map();

    for (const tok of tokens) {
      const idx = this.vocabulary.get(tok);
      if (idx !== undefined) {
        termCounts.set(idx, (termCounts.get(idx) || 0) + 1);
      }
    }

    if (termCounts.size === 0) {
      return new Map();
    }

    // Calculate TF * IDF
    const sparseVec = new Map();
    let normSq = 0;

    for (const [idx, count] of termCounts.entries()) {
      const tf = this.sublinearTf ? 1 + Math.log(count) : count;
      const weight = tf * this.idf[idx];
      sparseVec.set(idx, weight);
      normSq += weight * weight;
    }

    // L2 Normalization
    const norm = Math.sqrt(normSq);
    if (norm > 0) {
      for (const [idx, weight] of sparseVec.entries()) {
        sparseVec.set(idx, weight / norm);
      }
    }

    return sparseVec;
  }

  /**
   * Serialize vectorizer state to JSON.
   */
  toJSON() {
    return {
      minDocFreq: this.minDocFreq,
      maxDocFreqRatio: this.maxDocFreqRatio,
      useBigrams: this.useBigrams,
      sublinearTf: this.sublinearTf,
      docCount: this.docCount,
      featureNames: this.featureNames,
      idf: this.idf,
      vocabulary: Array.from(this.vocabulary.entries()),
      isFitted: this.isFitted
    };
  }

  /**
   * Rehydrate vectorizer from JSON object or string.
   */
  static fromJSON(data) {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    const vec = new TfidfVectorizer({
      minDocFreq: parsed.minDocFreq,
      maxDocFreqRatio: parsed.maxDocFreqRatio,
      useBigrams: parsed.useBigrams,
      sublinearTf: parsed.sublinearTf
    });
    vec.docCount = parsed.docCount;
    vec.featureNames = parsed.featureNames || [];
    vec.idf = parsed.idf || [];
    vec.vocabulary = new Map(parsed.vocabulary || []);
    vec.isFitted = Boolean(parsed.isFitted);
    return vec;
  }
}
