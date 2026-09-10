/**
 * Deterministic Escalation Guardrails and Decision Policy.
 * 
 * Enforces business rules that deterministically override LLM decisions:
 * - Differentiates informational questions from account-mutation / repair requests
 * - Evaluates query vagueness for other_unclear intent
 * - Enforces configurable intent confidence thresholds (AGENT_MIN_CONFIDENCE)
 * - Requires evidence sufficiency and absence of contradiction
 * - Enforces safety and grounding validation outcomes
 */

/**
 * Detects whether a message is purely vague, venting, or devoid of actionable technical detail.
 * @param {string} text
 * @returns {boolean}
 */
export function isVagueOrVenting(text) {
  if (!text || typeof text !== 'string') return true;
  const stripped = text.replace(/@\w+/g, '').replace(/https?:\/\/\S+/g, '').trim();
  if (stripped.length === 0) return true;

  // Pure punctuation or emoji
  if (/^[\p{P}\p{S}\s]+$/u.test(stripped)) return true;

  // Extremely short venting phrases
  const ventingRegex = /^(hey\s+)?(fix\s+(your|this)\s+shit|he+lp(\s+me)?|this\s+is\s+bullshit|ugh+|why\s+apple|what\s+is\s+this|broken|wth|wtf|please\s+help\s*!*)$/i;
  if (ventingRegex.test(stripped)) return true;

  // Very short query without any technical keywords
  if (stripped.length < 15) {
    const hasTechTerm = /\b(iphone|ipad|mac|ios|battery|screen|wifi|bluetooth|app|icloud|id|sound|audio|update)\b/i.test(stripped);
    if (!hasTechTerm) return true;
  }

  return false;
}

/**
 * Detects whether an inquiry is requesting an account-specific mutation, financial action,
 * private credential reset, or physical service appointment.
 * 
 * Distinguishes:
 * - Informational questions (can be auto-handled if evidence exists)
 * - Action/Mutation requests (must escalate to verified human support)
 * 
 * @param {string} text
 * @returns {{ isMutation: boolean, actionCategory: string | null }}
 */
export function isAccountMutationRequest(text) {
  if (!text || typeof text !== 'string') return { isMutation: false, actionCategory: null };
  const lower = text.toLowerCase();

  // 1. Financial / Billing account mutations
  const billingActionPatterns = [
    /\b(want|need|give me|get|request|process|like|would like|i'?d like|i’d like)\s+(a\s+)?refund\b/,
    /\ba\s+refund\b/,
    /\brefund\s+(my|this|the)\s+(money|charge|app|purchase|subscription)\b/,
    /\bdispute\s+(this\s+)?charge\b/,
    /\bcharged\s+(me\s+)?twice\b/,
    /\bunauthorized\s+charge\b/,
    /\bcredit\s+(my\s+)?card\b/,
    /\bstolen\s+(card|credit\s*card)\b/
  ];
  for (const pattern of billingActionPatterns) {
    if (pattern.test(lower)) {
      return { isMutation: true, actionCategory: 'billing_mutation' };
    }
  }

  // 2. Account Security & Credential Operations
  const credentialActionPatterns = [
    /\b(reset|change|forgot|forgotten)\s+(my\s+)?(apple\s*id\s+)?(password|passcode)\b/,
    /\b(unlock|un-lock)\s+(my\s+)?(apple\s*id|account|ipad|iphone)\b/,
    /\b(apple\s*id|account|device|ipad|iphone)\s+(is\s+)?(disabled|locked|hacked)\b/,
    /\bactivation\s+lock\b/,
    /\baccount\s+recovery\b/,
    /\brecover\s+(my\s+)?(account|apple\s*id)\b/
  ];
  for (const pattern of credentialActionPatterns) {
    if (pattern.test(lower)) {
      return { isMutation: true, actionCategory: 'account_credential_operation' };
    }
  }

  // 3. Physical Repair & Service Appointment Bookings
  const repairActionPatterns = [
    /\b(book|schedule|make)\s+(an?\s+)?(appointment|genius\s+bar|repair)\b/,
    /\b(replace|repair)\s+(my\s+)?(cracked|shattered|broken)\s+(screen|glass|display)\b/,
    /\bsend\s+(it|device|phone)\s+(in\s+)?for\s+repair\b/,
    /\bhow\s+much\s+(to|does\s+it\s+cost\s+to)\s+replace\s+(my\s+)?screen\b/,
    /\bwarranty\s+claim\b/
  ];
  for (const pattern of repairActionPatterns) {
    if (pattern.test(lower)) {
      return { isMutation: true, actionCategory: 'hardware_service_dispatch' };
    }
  }

  return { isMutation: false, actionCategory: null };
}

/**
 * Pre-generation guardrail evaluation.
 * Decides whether the query can even be considered for automated resolution
 * before invoking the LLM.
 * 
 * @param {Object} params
 * @param {string} params.customerText
 * @param {string} params.predictedIntent
 * @param {number} params.intentConfidence
 * @param {Object} params.filteredEvidence - Result from filterEvidence()
 * @param {Object} [params.options]
 * @returns {{
 *   mustEscalate: boolean,
 *   escalationReason: string | null,
 *   guardrailTriggered: string | null
 * }}
 */
export function evaluatePreGuardrails({
  customerText,
  predictedIntent,
  intentConfidence,
  filteredEvidence,
  options = {}
}) {
  const minConfidence = options.minConfidence ?? parseFloat(process.env.AGENT_MIN_CONFIDENCE || '0.40');

  // Rule 1: Empty or pure non-informative query
  if (!customerText || customerText.trim().length === 0 || /^[\p{P}\p{S}\s]+$/u.test(customerText.trim())) {
    return {
      mustEscalate: true,
      escalationReason: "Inquiry text is empty or non-informative.",
      guardrailTriggered: "EMPTY_OR_NON_INFORMATIVE"
    };
  }

  // Rule 2: Vague or venting query lacking diagnostic detail
  if (isVagueOrVenting(customerText)) {
    return {
      mustEscalate: true,
      escalationReason: "Inquiry lacks sufficient diagnostic detail to provide actionable troubleshooting.",
      guardrailTriggered: "VAGUE_OR_VENTING"
    };
  }

  // Rule 3: Account-specific mutation or financial/repair action
  const mutationCheck = isAccountMutationRequest(customerText);
  if (mutationCheck.isMutation) {
    let reason = "Account-specific action requires verified human support.";
    if (mutationCheck.actionCategory === 'billing_mutation') {
      reason = "Billing mutations and refund requests require verified human agent processing.";
    } else if (mutationCheck.actionCategory === 'account_credential_operation') {
      reason = "Account security operations (password resets, account recovery) require secure identity verification.";
    } else if (mutationCheck.actionCategory === 'hardware_service_dispatch') {
      reason = "Physical hardware service and repair bookings require authorized service dispatch.";
    }
    return {
      mustEscalate: true,
      escalationReason: reason,
      guardrailTriggered: `ACCOUNT_MUTATION_${mutationCheck.actionCategory?.toUpperCase()}`
    };
  }

  // Rule 4: Intent confidence below operational threshold
  if (intentConfidence < minConfidence) {
    return {
      mustEscalate: true,
      escalationReason: `Intent classification confidence (${intentConfidence.toFixed(2)}) is below operational threshold (${minConfidence.toFixed(2)}).`,
      guardrailTriggered: "LOW_INTENT_CONFIDENCE"
    };
  }

  // Rule 5: Insufficient retrieval evidence
  if (!filteredEvidence.isSufficient) {
    return {
      mustEscalate: true,
      escalationReason: `Historical evidence does not provide sufficiently grounded guidance: ${filteredEvidence.rationale}`,
      guardrailTriggered: "INSUFFICIENT_RETRIEVAL_EVIDENCE"
    };
  }

  // Rule 6: Conflicting evidence
  if (filteredEvidence.conflictDetected) {
    return {
      mustEscalate: true,
      escalationReason: "Historical evidence is inconclusive or conflicting across candidate interactions.",
      guardrailTriggered: "CONFLICTING_RETRIEVAL_EVIDENCE"
    };
  }

  return {
    mustEscalate: false,
    escalationReason: null,
    guardrailTriggered: null
  };
}

/**
 * Applies final deterministic guardrails to harmonize pre-checks, LLM draft, and validation.
 * 
 * @param {Object} params
 * @param {Object} params.preGuardrails - Output of evaluatePreGuardrails
 * @param {Object|null} params.rawModelDraft - Output of LLM generation (if successful)
 * @param {Object} params.validation - Output of validateAgentDraft
 * @param {string|null} [params.apiError] - Error message from LLM if call failed
 * @returns {{
 *   finalDecision: 'auto_handle' | 'escalate',
 *   finalEscalationReason: string | null,
 *   guardrailOverride: string | null
 * }}
 */
export function applyFinalGuardrails({
  preGuardrails,
  rawModelDraft,
  validation,
  apiError = null
}) {
  // Priority 1: Pre-guardrails demanded escalation (domain/security rule)
  if (preGuardrails.mustEscalate) {
    const overrideOccurred = rawModelDraft && rawModelDraft.decision === 'auto_handle';
    return {
      finalDecision: 'escalate',
      finalEscalationReason: preGuardrails.escalationReason,
      guardrailOverride: overrideOccurred ? `OVERRIDE_PRE_${preGuardrails.guardrailTriggered}` : preGuardrails.guardrailTriggered
    };
  }

  // Priority 2: API / LLM provider failure
  if (apiError) {
    return {
      finalDecision: 'escalate',
      finalEscalationReason: `LLM generation unavailable or failed: ${apiError}`,
      guardrailOverride: 'API_FAILURE'
    };
  }

  // Priority 3: Model draft failed post-generation safety/grounding validation
  if (!validation.isValid) {
    const overrideOccurred = rawModelDraft && rawModelDraft.decision === 'auto_handle';
    return {
      finalDecision: 'escalate',
      finalEscalationReason: `Generated response failed safety/grounding validation: ${validation.violations.join('; ')}`,
      guardrailOverride: overrideOccurred ? 'OVERRIDE_POST_VALIDATION_FAILURE' : 'POST_VALIDATION_FAILURE'
    };
  }

  // Priority 4: Model requested escalation
  if (rawModelDraft.decision === 'escalate') {
    return {
      finalDecision: 'escalate',
      finalEscalationReason: rawModelDraft.escalationReason || 'Escalated by support drafting assistant.',
      guardrailOverride: null
    };
  }

  // Priority 5: All checks passed -> auto_handle
  return {
    finalDecision: 'auto_handle',
    finalEscalationReason: null,
    guardrailOverride: null
  };
}
