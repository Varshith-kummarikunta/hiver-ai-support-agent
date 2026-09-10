/**
 * Historical Retrieval System API for AppleSupport Customer-Support Interactions.
 * 
 * Provides:
 * - buildIndex(records, options)
 * - saveIndex(index, filePath)
 * - loadIndex(filePath)
 * - search(index, query, topK)
 * 
 * Pure Node.js, deterministic ranking, zero external dependencies.
 */

import fs from 'fs';
import zlib from 'zlib';
import { BM25Engine } from './bm25.js';

export class RetrievalIndex {
  constructor(engine, docMetadata, stats = {}) {
    this.engine = engine;
    this.docMetadata = docMetadata;
    this.stats = stats;
  }
}

/**
 * Build a BM25 retrieval index from customer-support interaction records.
 * @param {Array<Object>} records - Array of historical interaction pair records
 * @param {Object} options - Index options (k1, b, minDocFreq)
 * @returns {RetrievalIndex}
 */
export function buildIndex(records, options = {}) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('buildIndex requires a non-empty array of records.');
  }

  const engine = new BM25Engine(options);
  const documents = records.map(r => r.customerTextClean || r.customerText || '');

  // Fit BM25 engine
  engine.fit(documents);

  // Store metadata for evidence display
  const docMetadata = records.map(r => {
    // Multi-response structure: supportResponses array preserves chronological responses
    const supportResponses = r.supportResponses || [
      {
        tweetId: r.supportTweetId,
        textClean: r.supportTextClean || r.supportResponse,
        textRaw: r.supportTextRaw,
        createdAt: r.supportCreatedAt
      }
    ];

    return {
      customerTweetId: String(r.customerTweetId),
      supportTweetId: String(r.supportTweetId),
      customerCreatedAt: r.customerCreatedAt || null,
      supportCreatedAt: r.supportCreatedAt || null,
      customerText: r.customerTextClean || r.customerText || '',
      customerTextRaw: r.customerTextRaw || null,
      supportResponse: r.supportTextClean || r.supportResponse || '',
      supportTextRaw: r.supportTextRaw || null,
      supportResponses,
      allSupportRepliesCount: r.allSupportRepliesCount ?? supportResponses.length,
      intent: r.intent || null,
      isInitialInquiry: Boolean(r.isInitialInquiry)
    };
  });

  const stats = {
    docCount: records.length,
    vocabularySize: engine.featureNames.length,
    avgDocLen: Number(engine.avgDocLen.toFixed(2)),
    k1: engine.k1,
    b: engine.b,
    minDocFreq: engine.minDocFreq,
    multiResponseDocsCount: docMetadata.filter(d => d.allSupportRepliesCount > 1).length
  };

  return new RetrievalIndex(engine, docMetadata, stats);
}

/**
 * Save retrieval index to disk as JSON.
 * @param {RetrievalIndex} index
 * @param {string} filePath
 */
export function saveIndex(index, filePath) {
  const data = {
    modelType: 'RetrievalIndex',
    stats: index.stats,
    engine: index.engine.toJSON(),
    docMetadata: index.docMetadata
  };
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
}

/**
 * Load retrieval index from JSON file on disk.
 * @param {string} filePath
 * @returns {RetrievalIndex}
 */
export function loadIndex(filePath) {
  let raw;
  if (fs.existsSync(filePath)) {
    raw = fs.readFileSync(filePath, 'utf8');
  } else if (fs.existsSync(filePath + '.gz')) {
    const compressed = fs.readFileSync(filePath + '.gz');
    raw = zlib.gunzipSync(compressed).toString('utf8');
  } else {
    throw new Error(`Retrieval index not found at path: ${filePath} (or ${filePath}.gz)`);
  }

  const data = JSON.parse(raw);

  const engine = BM25Engine.fromJSON(data.engine);
  return new RetrievalIndex(engine, data.docMetadata, data.stats);
}

/**
 * Search the index for the top-K most similar historical interactions.
 * Deterministic: same index + same query = identical ranking and scores.
 * 
 * @param {RetrievalIndex} index
 * @param {string} query - Customer inquiry text
 * @param {number} topK - Number of results to return (default: 5)
 * @returns {Array<Object>} Ranked retrieval results with evidence
 */
export function search(index, query, topK = 5) {
  if (!index || !index.engine) {
    throw new Error('Invalid retrieval index provided to search().');
  }

  const matches = index.engine.search(query, topK);

  return matches.map((match, idx) => {
    const meta = index.docMetadata[match.docId];
    return {
      rank: idx + 1,
      score: match.score,
      customerTweetId: meta.customerTweetId,
      supportTweetId: meta.supportTweetId,
      customerCreatedAt: meta.customerCreatedAt,
      supportCreatedAt: meta.supportCreatedAt,
      customerText: meta.customerText,
      customerTextRaw: meta.customerTextRaw,
      supportResponse: meta.supportResponse,
      supportTextRaw: meta.supportTextRaw,
      supportResponses: meta.supportResponses,
      allSupportRepliesCount: meta.allSupportRepliesCount,
      intent: meta.intent,
      isInitialInquiry: meta.isInitialInquiry
    };
  });
}
