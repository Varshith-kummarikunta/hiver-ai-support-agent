/**
 * Post-Generation Safety and Grounding Validation Module.
 * 
 * Performs deterministic safety audits on the LLM draft response before
 * allowing it to proceed to final delivery.
 * 
 * Verifies:
 * - Reply length and non-emptiness
 * - Zero internal ID or retrieval score leakage
 * - Zero prompt/instruction leakage
 * - Zero invented URLs
 * - Zero unauthorized operational action claims ("I have refunded...")
 * - Decision consistency (auto_handle requires evidence; escalate requires reason)
 */

import { VALID_INTENTS, VALID_DECISIONS } from './schema.js';

/**
 * Validates the draft customer reply text against safety and anti-leakage rules.
 * @param {string} reply - Draft reply text
 * @param {Array<Object>} evidence - Filtered evidence provided to model
 * @returns {{ isValid: boolean, violations: string[] }}
 */
export function validateReplyText(reply, evidence = [], options = {}) {
  const violations = [];

  if (typeof reply !== 'string' || reply.trim().length === 0) {
    return { isValid: false, violations: ['Reply text is empty or missing'] };
  }

  const trimmed = reply.trim();

  // 1. Length bounds (configurable engineering constraint)
  const maxReplyChars = options.maxReplyChars ?? parseInt(process.env.AGENT_MAX_REPLY_CHARS || '280', 10);
  if (trimmed.length < 10) {
    violations.push(`Reply is excessively short (${trimmed.length} chars; minimum: 10)`);
  }
  if (trimmed.length > maxReplyChars) {
    violations.push(`Reply exceeds public reply character constraint (${trimmed.length} chars; maximum: ${maxReplyChars})`);
  }

  // 2. No internal ID leakage
  if (/GOLD-\d{3,}/i.test(trimmed)) {
    violations.push("Reply leaks benchmark evaluation ID ('GOLD-xxx')");
  }
  if (/\b(tweet_id|author_id|document_id|doc_id)\b/i.test(trimmed)) {
    violations.push('Reply leaks internal database field names');
  }
  // Check for raw 6-8 digit numeric tweet IDs in text
  const rawIdMatches = trimmed.match(/\b\d{6,8}\b/g);
  if (rawIdMatches) {
    // Check if any match matches an evidence tweet ID
    const knownTweetIds = new Set();
    evidence.forEach(e => {
      if (e.customerTweetId) knownTweetIds.add(String(e.customerTweetId));
      if (e.supportTweetId) knownTweetIds.add(String(e.supportTweetId));
    });
    for (const num of rawIdMatches) {
      if (knownTweetIds.has(num)) {
        violations.push(`Reply leaks historical tweet ID '${num}' directly to customer`);
        break;
      }
    }
  }

  // 3. No retrieval score or ranking leakage
  if (/\b(bm25|relevance score|retrieval score|rank\s*#?\d+)\b/i.test(trimmed)) {
    violations.push('Reply leaks internal retrieval metrics or ranking metadata');
  }

  // 4. No prompt or instruction leakage
  const promptLeakagePatterns = [
    /\bas an ai\b/i,
    /\blanguage model\b/i,
    /\bsystem prompt\b/i,
    /\bsupplied evidence\b/i,
    /\bhistorical evidence candidate\b/i,
    /\bprompt instruction\b/i
  ];
  for (const pattern of promptLeakagePatterns) {
    if (pattern.test(trimmed)) {
      violations.push(`Reply contains prompt/persona leakage matching ${pattern}`);
    }
  }

  // 5. No false action / backend mutation claims
  const actionClaimPatterns = [
    /\b(i have|i've)\s+(reset|refunded|credited|cancelled|canceled|unlocked|modified|changed)\b/i,
    /\b(i have|i've)\s+accessed your (account|device|icloud|apple id)\b/i,
    /\b(we have|we've)\s+(refunded|credited|processed your refund)\b/i,
    /\bi looked up your (account|serial|imei|order)\b/i
  ];
  for (const pattern of actionClaimPatterns) {
    if (pattern.test(trimmed)) {
      violations.push(`Reply falsely claims agent performed a backend mutation: '${trimmed.match(pattern)[0]}'`);
    }
  }

  // 6. No invented URLs
  // Extract URLs in reply
  const urlMatches = trimmed.match(/https?:\/\/[^\s]+/gi) || [];
  for (const url of urlMatches) {
    // Check if URL belongs to official Apple domains
    const isOfficialApple = /^https?:\/\/([a-z0-9-]+\.)*apple\.com(\/|$)/i.test(url);
    const inEvidence = evidence.some(e => {
      const resp = e.supportResponse || '';
      return resp.includes(url) || (e.supportResponses && e.supportResponses.some(r => (r.textRaw || '').includes(url)));
    });

    if (!isOfficialApple && !inEvidence) {
      violations.push(`Reply includes unverified non-Apple URL: '${url}'`);
    }
  }

  return {
    isValid: violations.length === 0,
    violations
  };
}

/**
 * Validates the complete draft object for decision consistency and grounding.
 * 
 * @param {Object} draft - Candidate agent output
 * @param {Array<Object>} evidence - Filtered historical evidence
 * @returns {{ isValid: boolean, violations: string[] }}
 */
export function validateAgentDraft(draft, evidence = [], options = {}) {
  const violations = [];

  if (!draft || typeof draft !== 'object') {
    return { isValid: false, violations: ['Draft must be a non-null object'] };
  }

  // 1. Validate intent and decision schema
  if (!VALID_INTENTS.includes(draft.intent)) {
    violations.push(`Invalid intent: '${draft.intent}'`);
  }
  if (!VALID_DECISIONS.includes(draft.decision)) {
    violations.push(`Invalid decision: '${draft.decision}'`);
  }

  // 2. Validate reply text
  const replyValidation = validateReplyText(draft.reply, evidence, options);
  if (!replyValidation.isValid) {
    violations.push(...replyValidation.violations);
  }

  // 3. Decision consistency
  if (draft.decision === 'auto_handle') {
    if (!Array.isArray(evidence) || evidence.length === 0) {
      violations.push("Decision 'auto_handle' is not permitted when zero historical evidence exists");
    }
    if (draft.grounding && draft.grounding.supportedByHistoricalEvidence === false) {
      violations.push("Decision 'auto_handle' conflicts with grounding flag (supportedByHistoricalEvidence is false)");
    }
  } else if (draft.decision === 'escalate') {
    if (typeof draft.escalationReason !== 'string' || draft.escalationReason.trim().length === 0) {
      violations.push("Decision 'escalate' requires a non-empty 'escalationReason'");
    }
  }

  return {
    isValid: violations.length === 0,
    violations
  };
}
