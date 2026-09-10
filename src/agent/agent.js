/**
 * Central SupportAgent Class for AppleSupport AI Customer Support.
 * 
 * Orchestrates the end-to-end pipeline:
 * 1. Deterministic Intent Classification (Phase 4 TF-IDF + Naive Bayes)
 * 2. Historical BM25 Retrieval (Phase 5 Inverted Index)
 * 3. Evidence Filtering & Substance Verification
 * 4. Pre-Generation Guardrails (Vagueness, Account Mutations, Confidence)
 * 5. Grounded LLM Response Drafting (Gemini / OpenAI / Mock)
 * 6. Post-Generation Safety & Grounding Validation
 * 7. Final Guardrail Harmonization (Deterministic Auto-handle vs Escalate)
 * 8. Strict Schema Validation & Structured Output Assembly
 * 
 * Zero external Python/vector database dependencies.
 */

import fs from 'fs';
import path from 'path';
import { MultinomialNaiveBayesClassifier } from '../baselines/naive-bayes.js';
import { loadIndex, search } from '../retrieval/index.js';
import { createLLMProvider } from './llm.js';
import { filterEvidence } from './filter.js';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompt.js';
import { validateModelDraftSchema, validateAgentOutputSchema } from './schema.js';
import { validateAgentDraft } from './validation.js';
import { evaluatePreGuardrails, applyFinalGuardrails } from './guardrails.js';
import { AgentLogger } from './logger.js';

export class SupportAgent {
  constructor(options = {}) {
    this.classifierModelPath = options.classifierModelPath || path.join(process.cwd(), 'data', 'models', 'tfidf-nb-baseline.json');
    this.retrievalIndexPath = options.retrievalIndexPath || path.join(process.cwd(), 'data', 'models', 'applesupport-retrieval-index.json');
    
    this.minConfidence = options.minConfidence ?? parseFloat(process.env.AGENT_MIN_CONFIDENCE || '0.40');
    this.minBm25Score = options.minBm25Score ?? parseFloat(process.env.AGENT_MIN_BM25_SCORE || '5.0');
    this.topK = options.topK ?? parseInt(process.env.AGENT_TOP_K || '5', 10);
    
    this.providerName = options.provider || process.env.LLM_PROVIDER || 'gemini';
    this.llmProvider = options.llmProvider || null;
    this.llmOptions = {
      provider: this.providerName,
      model: options.model,
      apiKey: options.apiKey,
      timeoutMs: options.timeoutMs
    };

    this.logger = options.logger || new AgentLogger(options.loggerOptions);
    this.classifier = null;
    this.retrievalIndex = null;
    this.isInitialized = false;
  }

  /**
   * Initializes the support agent by loading the Phase 4 classifier and Phase 5 retrieval index.
   */
  async initialize() {
    if (this.isInitialized) return this;

    // 1. Load trained Phase 4 classifier
    if (!fs.existsSync(this.classifierModelPath)) {
      throw new Error(`Classifier baseline model not found at: ${this.classifierModelPath}. Run 'npm run train:baselines' first.`);
    }
    const classifierRaw = fs.readFileSync(this.classifierModelPath, 'utf8');
    this.classifier = MultinomialNaiveBayesClassifier.fromJSON(classifierRaw);

    // 2. Load Phase 5 BM25 retrieval index
    if (!fs.existsSync(this.retrievalIndexPath)) {
      throw new Error(`Retrieval index not found at: ${this.retrievalIndexPath}. Run 'npm run build:retrieval' first.`);
    }
    this.retrievalIndex = loadIndex(this.retrievalIndexPath);

    // 3. Initialize LLM provider adapter if not explicitly supplied
    if (!this.llmProvider) {
      this.llmProvider = createLLMProvider(this.llmOptions);
    }

    this.isInitialized = true;
    return this;
  }

  /**
   * Process an incoming customer inquiry through the full agent pipeline.
   * 
   * @param {string} customerText - Raw customer inquiry
   * @param {Object} [runtimeOptions] - Per-query overrides
   * @returns {Promise<Object>} Structured agent output
   */
  async processInquiry(customerText, runtimeOptions = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = performance.now();
    const query = typeof customerText === 'string' ? customerText : '';

    // =========================================================================
    // STEP 1: DETERMINISTIC INTENT CLASSIFICATION (Phase 4 TF-IDF + Naive Bayes)
    // =========================================================================
    const classification = this.classifier.predict(query);
    const predictedIntent = classification.intent;
    const intentConfidence = classification.confidence;

    // =========================================================================
    // STEP 2: HISTORICAL BM25 RETRIEVAL (Phase 5 Inverted Index)
    // =========================================================================
    const topK = runtimeOptions.topK ?? this.topK;
    const rawMatches = search(this.retrievalIndex, query, topK);

    // =========================================================================
    // STEP 3: EVIDENCE FILTERING & QUALITY ASSESSMENT
    // =========================================================================
    const filterOpts = {
      minBm25Score: runtimeOptions.minBm25Score ?? this.minBm25Score,
      maxEvidenceCount: runtimeOptions.maxEvidenceCount ?? 3
    };
    const filterResult = filterEvidence(rawMatches, predictedIntent, filterOpts);
    const evidenceForPrompt = filterResult.filteredEvidence;

    // =========================================================================
    // STEP 4: PRE-GENERATION DETERMINISTIC GUARDRAILS
    // =========================================================================
    const preGuardrails = evaluatePreGuardrails({
      customerText: query,
      predictedIntent,
      intentConfidence,
      filteredEvidence: filterResult,
      options: {
        minConfidence: runtimeOptions.minConfidence ?? this.minConfidence
      }
    });

    // =========================================================================
    // STEP 5: LLM RESPONSE GENERATION VIA PROVIDER ADAPTER
    // =========================================================================
    const userPrompt = buildUserPrompt({
      customerText: query,
      predictedIntent,
      intentConfidence,
      evidence: evidenceForPrompt,
      isEvidenceSufficient: filterResult.isSufficient,
      filterRationale: filterResult.rationale
    });

    let rawModelDraft = null;
    let apiError = null;
    let draftParseError = null;

    const llmResult = await this.llmProvider.generate({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt
    });

    if (!llmResult.success) {
      apiError = llmResult.error;
    } else {
      try {
        // Strip markdown backticks if accidentally returned
        const cleanedText = llmResult.text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        rawModelDraft = JSON.parse(cleanedText);

        // Validate draft schema
        const draftSchemaCheck = validateModelDraftSchema(rawModelDraft);
        if (!draftSchemaCheck.isValid) {
          draftParseError = `Model draft schema invalid: ${draftSchemaCheck.errors.join('; ')}`;
        }
      } catch (err) {
        draftParseError = `JSON parse failure on model output: ${err.message}`;
      }
    }

    // =========================================================================
    // STEP 6: POST-GENERATION SAFETY & GROUNDING VALIDATION
    // =========================================================================
    let validation = { isValid: true, violations: [] };

    if (rawModelDraft && !draftParseError) {
      validation = validateAgentDraft(rawModelDraft, evidenceForPrompt);
    } else if (draftParseError) {
      validation = { isValid: false, violations: [draftParseError] };
    }

    // =========================================================================
    // STEP 7: FINAL GUARDRAIL HARMONIZATION & DECISION POLICY
    // =========================================================================
    const guardrailOutcome = applyFinalGuardrails({
      preGuardrails,
      rawModelDraft,
      validation,
      apiError
    });

    // =========================================================================
    // STEP 8: ASSEMBLE CLEAN PUBLIC OUTPUT & INTERNAL AUDIT METADATA
    // =========================================================================
    let finalReply = '';

    if (rawModelDraft && validation.isValid && !preGuardrails.mustEscalate) {
      // Clean valid response directly from model
      finalReply = rawModelDraft.reply.trim();
    } else if (guardrailOutcome.finalDecision === 'escalate') {
      // Craft polite, authentic AppleSupport public escalation reply
      if (preGuardrails.guardrailTriggered?.startsWith('ACCOUNT_MUTATION_BILLING')) {
        finalReply = "For your account security and to assist with billing or refund requests, please visit https://reportaproblem.apple.com or reach out to Apple Support directly.";
      } else if (preGuardrails.guardrailTriggered?.startsWith('ACCOUNT_MUTATION_ACCOUNT')) {
        finalReply = "For security reasons, account and password recovery must be completed through official verification steps. Please visit https://iforgot.apple.com to reset your credentials.";
      } else if (preGuardrails.guardrailTriggered?.startsWith('ACCOUNT_MUTATION_HARDWARE')) {
        finalReply = "Hardware repairs and service evaluations require an in-person diagnostic at an Apple Store or Authorized Service Provider. You can schedule service at https://getsupport.apple.com.";
      } else if (preGuardrails.guardrailTriggered === 'VAGUE_OR_VENTING' || preGuardrails.guardrailTriggered === 'EMPTY_OR_NON_INFORMATIVE') {
        finalReply = "We're here to help! Could you share what specific device and iOS/macOS version you're using, along with what symptoms you're experiencing?";
      } else if (rawModelDraft && rawModelDraft.reply && !validation.violations.some(v => v.includes('leaks') || v.includes('performed a backend mutation'))) {
        // If model drafted a courteous reply that didn't violate critical safety, keep its phrasing
        finalReply = rawModelDraft.reply.trim();
      } else {
        finalReply = "We'd like to take a closer look at this with you to help get it resolved. Please reach out to Apple Support via direct message or visit https://getsupport.apple.com with your device details.";
      }
    } else {
      finalReply = "We'd like to look into this with you. Please restart your device and let us know if the issue persists.";
    }

    // Format evidence objects according to schema
    const formattedEvidence = evidenceForPrompt.map((ev, idx) => ({
      rank: ev.rank || idx + 1,
      customerTweetId: String(ev.customerTweetId || ''),
      supportTweetId: String(ev.supportTweetId || ''),
      score: typeof ev.score === 'number' ? Number(ev.score.toFixed(4)) : 0.0,
      intent: ev.intent || null,
      supportResponseUsed: Boolean(rawModelDraft?.evidence?.[idx]?.supportResponseUsed ?? (idx === 0))
    }));

    // Construct grounding object
    const grounding = {
      supportedByHistoricalEvidence: Boolean(
        guardrailOutcome.finalDecision === 'auto_handle' &&
        filterResult.isSufficient &&
        (rawModelDraft?.grounding?.supportedByHistoricalEvidence ?? true)
      ),
      evidenceSummary: (
        rawModelDraft?.grounding?.evidenceSummary ||
        (guardrailOutcome.finalDecision === 'auto_handle'
          ? `Grounded in ${filterResult.evidenceCount} historical AppleSupport interaction(s) sharing intent '${predictedIntent}'.`
          : `Escalated: ${guardrailOutcome.finalEscalationReason}`)
      )
    };

    const latencyMs = Number((performance.now() - startTime).toFixed(2));

    const finalOutput = {
      intent: predictedIntent,
      intentConfidence: Number(intentConfidence.toFixed(4)),
      reply: finalReply,
      decision: guardrailOutcome.finalDecision,
      escalationReason: guardrailOutcome.finalEscalationReason,
      evidence: formattedEvidence,
      grounding
    };

    // Internal diagnostic metadata (preserved for Phase 7 analysis, never in customer reply)
    finalOutput._internal = {
      rawModelDraft,
      validation,
      preGuardrails,
      guardrailOverride: guardrailOutcome.guardrailOverride,
      apiError,
      draftParseError,
      latencyMs,
      filterSummary: {
        isSufficient: filterResult.isSufficient,
        conflictDetected: filterResult.conflictDetected,
        rationale: filterResult.rationale
      }
    };

    // =========================================================================
    // STEP 9: FINAL AGENT SCHEMA VALIDATION
    // =========================================================================
    const finalSchemaCheck = validateAgentOutputSchema(finalOutput);
    if (!finalSchemaCheck.isValid) {
      // Extreme fallback if final schema failed
      finalOutput.decision = 'escalate';
      finalOutput.escalationReason = `Internal agent schema check failed: ${finalSchemaCheck.errors.join('; ')}`;
    }

    // =========================================================================
    // STEP 10: TELEMETRY LOGGING
    // =========================================================================
    this.logger.log({
      customerText: query,
      intent: predictedIntent,
      intentConfidence,
      retrievedEvidence: rawMatches,
      filterSummary: filterResult,
      rawModelDraft,
      validation,
      finalDecision: finalOutput.decision,
      escalationReason: finalOutput.escalationReason,
      guardrailOverride: guardrailOutcome.guardrailOverride,
      latencyMs
    });

    return finalOutput;
  }
}
