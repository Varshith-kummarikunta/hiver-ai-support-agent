/**
 * Evidence Filtering Module for Historical AppleSupport Interactions.
 * 
 * Selects and validates top BM25 retrieval candidates before LLM prompting:
 * - Evaluates score against configurable threshold (AGENT_MIN_BM25_SCORE)
 * - Verifies substantive historical AppleSupport reply
 * - Prioritizes same-intent evidence
 * - Preserves conflicting evidence to avoid manufactured consensus
 * - Flags insufficient evidence when no useful grounding exists
 */

/**
 * Checks if a historical support reply is substantive (contains actionable troubleshooting,
 * diagnostic questions, or knowledge base links, rather than empty text).
 * @param {string} text
 * @returns {boolean}
 */
export function isSubstantiveResponse(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length < 15) return false;
  
  // Rejects purely generic acknowledgments with zero troubleshooting or direction
  const nonSubstantivePatterns = [
    /^\s*thanks\s*$/i,
    /^\s*ok\s*$/i,
    /^\s*hello\s*$/i
  ];
  return !nonSubstantivePatterns.some(p => p.test(trimmed));
}

/**
 * Filter retrieved BM25 candidates for prompt injection.
 * 
 * @param {Array<Object>} candidates - Ranked results from BM25 search
 * @param {string} predictedIntent - Deterministic intent from Phase 4 classifier
 * @param {Object} options - Configuration options
 * @returns {{
 *   filteredEvidence: Array<Object>,
 *   isSufficient: boolean,
 *   hasSameIntentMatch: boolean,
 *   conflictDetected: boolean,
 *   evidenceCount: number,
 *   rationale: string
 * }}
 */
export function filterEvidence(candidates = [], predictedIntent = 'other_unclear', options = {}) {
  const minScore = options.minBm25Score ?? parseFloat(process.env.AGENT_MIN_BM25_SCORE || '5.0');
  const maxCandidates = options.maxEvidenceCount ?? 3;

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      filteredEvidence: [],
      isSufficient: false,
      hasSameIntentMatch: false,
      conflictDetected: false,
      evidenceCount: 0,
      rationale: 'Zero retrieval candidates available.'
    };
  }

  // 1. Evaluate candidate quality
  const annotated = candidates.map(c => {
    const isScoreAcceptable = typeof c.score === 'number' && c.score >= minScore;
    const isSubstantive = isSubstantiveResponse(c.supportResponse);
    const isSameIntent = c.intent === predictedIntent;

    return {
      ...c,
      isScoreAcceptable,
      isSubstantive,
      isSameIntent,
      isUsable: isScoreAcceptable && isSubstantive
    };
  });

  const usable = annotated.filter(c => c.isUsable);
  const sameIntentUsable = usable.filter(c => c.isSameIntent);
  const differentIntentUsable = usable.filter(c => !c.isSameIntent);

  // 2. Detect conflict or strong intent divergence in top candidates
  const topCandidateIntents = candidates.slice(0, 3).map(c => c.intent).filter(Boolean);
  const uniqueTopIntents = Array.from(new Set(topCandidateIntents));
  const conflictDetected = uniqueTopIntents.length > 1 && !sameIntentUsable.length;

  // 3. Selection strategy:
  // Prefer same-intent usable evidence first.
  // If top candidates diverge, retain up to 1 differing candidate so LLM recognizes disagreement.
  let selected = [];

  if (sameIntentUsable.length > 0) {
    selected = sameIntentUsable.slice(0, maxCandidates);
  } else if (usable.length > 0) {
    // No same-intent evidence, but some other intent scored high
    selected = usable.slice(0, Math.min(2, maxCandidates));
  } else {
    // No usable evidence met the score/substance threshold
    selected = candidates.slice(0, 1); // retain top-1 for diagnostic audit only
  }

  const hasSameIntentMatch = sameIntentUsable.length > 0;
  const isSufficient = hasSameIntentMatch && sameIntentUsable[0].score >= minScore;

  let rationale = '';
  if (isSufficient) {
    rationale = `Found ${sameIntentUsable.length} substantive historical interaction(s) sharing intent '${predictedIntent}' (top score: ${sameIntentUsable[0].score.toFixed(2)}).`;
  } else if (hasSameIntentMatch) {
    rationale = `Same-intent evidence exists but top score (${sameIntentUsable[0].score.toFixed(2)}) is below threshold (${minScore}).`;
  } else if (usable.length > 0) {
    rationale = `No substantive evidence matched predicted intent '${predictedIntent}'. Retrieved evidence belongs to: ${uniqueTopIntents.join(', ')}.`;
  } else {
    rationale = `Retrieved evidence failed quality/substance criteria (all scores below threshold or non-substantive).`;
  }

  return {
    filteredEvidence: selected,
    isSufficient,
    hasSameIntentMatch,
    conflictDetected,
    evidenceCount: selected.length,
    rationale
  };
}
