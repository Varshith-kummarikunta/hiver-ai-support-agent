/**
 * Strict JSON Schema Definitions and Validation for AppleSupport AI Support Agent.
 * 
 * Validates:
 * - 10 Phase 2 taxonomy intents
 * - Decision types: 'auto_handle' | 'escalate'
 * - Confidence bounds [0.0, 1.0]
 * - Evidence structure
 * - Grounding summary
 */

export const VALID_INTENTS = [
  'account_icloud',
  'apps_appstore',
  'audio_media',
  'battery_power',
  'billing_subscriptions',
  'connectivity_network',
  'display_hardware',
  'keyboard_typing',
  'other_unclear',
  'software_update'
];

export const VALID_DECISIONS = ['auto_handle', 'escalate'];

/**
 * Validates the raw parsed JSON response from the LLM.
 * @param {any} draft - Parsed object from LLM
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validateModelDraftSchema(draft) {
  const errors = [];

  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return { isValid: false, errors: ['Model draft must be a non-null JSON object'] };
  }

  // 1. Reply
  if (typeof draft.reply !== 'string' || draft.reply.trim().length === 0) {
    errors.push("Field 'reply' must be a non-empty string");
  }

  // 2. Decision
  if (!VALID_DECISIONS.includes(draft.decision)) {
    errors.push(`Field 'decision' must be either 'auto_handle' or 'escalate', received: '${draft.decision}'`);
  }

  // 3. Escalation Reason
  if (draft.decision === 'escalate') {
    if (typeof draft.escalationReason !== 'string' || draft.escalationReason.trim().length === 0) {
      errors.push("Field 'escalationReason' must be a non-empty string when decision is 'escalate'");
    }
  }

  // 4. Grounding
  if (!draft.grounding || typeof draft.grounding !== 'object') {
    errors.push("Field 'grounding' must be an object");
  } else {
    if (typeof draft.grounding.supportedByHistoricalEvidence !== 'boolean') {
      errors.push("Field 'grounding.supportedByHistoricalEvidence' must be a boolean");
    }
    if (typeof draft.grounding.evidenceSummary !== 'string' || draft.grounding.evidenceSummary.trim().length === 0) {
      errors.push("Field 'grounding.evidenceSummary' must be a non-empty string");
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates the final structured agent output.
 * @param {any} output - Final agent output object
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validateAgentOutputSchema(output) {
  const errors = [];

  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    return { isValid: false, errors: ['Agent output must be a non-null JSON object'] };
  }

  // 1. Intent
  if (!VALID_INTENTS.includes(output.intent)) {
    errors.push(`Invalid intent '${output.intent}'. Must be one of: ${VALID_INTENTS.join(', ')}`);
  }

  // 2. Intent Confidence
  if (typeof output.intentConfidence !== 'number' || isNaN(output.intentConfidence) || output.intentConfidence < 0 || output.intentConfidence > 1) {
    errors.push(`Field 'intentConfidence' must be a number between 0.0 and 1.0, received: ${output.intentConfidence}`);
  }

  // 3. Reply
  if (typeof output.reply !== 'string' || output.reply.trim().length === 0) {
    errors.push("Field 'reply' must be a non-empty string");
  }

  // 4. Decision
  if (!VALID_DECISIONS.includes(output.decision)) {
    errors.push(`Field 'decision' must be 'auto_handle' or 'escalate', received: '${output.decision}'`);
  }

  // 5. Escalation Reason
  if (output.decision === 'escalate') {
    if (typeof output.escalationReason !== 'string' || output.escalationReason.trim().length === 0) {
      errors.push("Field 'escalationReason' must be a non-empty string when decision is 'escalate'");
    }
  } else {
    if (output.escalationReason !== null && output.escalationReason !== undefined) {
      errors.push("Field 'escalationReason' must be null or undefined when decision is 'auto_handle'");
    }
  }

  // 6. Evidence array
  if (!Array.isArray(output.evidence)) {
    errors.push("Field 'evidence' must be an array");
  } else {
    for (let i = 0; i < output.evidence.length; i++) {
      const ev = output.evidence[i];
      if (!ev || typeof ev !== 'object') {
        errors.push(`Evidence item at index ${i} must be an object`);
        continue;
      }
      if (typeof ev.rank !== 'number' || ev.rank < 1) {
        errors.push(`Evidence item ${i}: 'rank' must be a positive number`);
      }
      if (typeof ev.customerTweetId !== 'string' || ev.customerTweetId.length === 0) {
        errors.push(`Evidence item ${i}: 'customerTweetId' must be a non-empty string`);
      }
      if (typeof ev.supportTweetId !== 'string' || ev.supportTweetId.length === 0) {
        errors.push(`Evidence item ${i}: 'supportTweetId' must be a non-empty string`);
      }
      if (typeof ev.score !== 'number' || isNaN(ev.score)) {
        errors.push(`Evidence item ${i}: 'score' must be a valid number`);
      }
      if (!VALID_INTENTS.includes(ev.intent) && ev.intent !== null) {
        errors.push(`Evidence item ${i}: 'intent' must be a valid taxonomy intent or null`);
      }
      if (typeof ev.supportResponseUsed !== 'boolean') {
        errors.push(`Evidence item ${i}: 'supportResponseUsed' must be a boolean`);
      }
    }
  }

  // 7. Grounding
  if (!output.grounding || typeof output.grounding !== 'object') {
    errors.push("Field 'grounding' must be an object");
  } else {
    if (typeof output.grounding.supportedByHistoricalEvidence !== 'boolean') {
      errors.push("Field 'grounding.supportedByHistoricalEvidence' must be a boolean");
    }
    if (typeof output.grounding.evidenceSummary !== 'string' || output.grounding.evidenceSummary.trim().length === 0) {
      errors.push("Field 'grounding.evidenceSummary' must be a non-empty string");
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
