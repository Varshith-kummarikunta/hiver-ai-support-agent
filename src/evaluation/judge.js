/**
 * LLM-as-Judge Evaluation Harness for AppleSupport AI Customer Support Agent.
 * 
 * Implements the authoritative evaluation rubric defined in docs/judge-rubric.md.
 * Evaluates agent replies across 6 orthogonal dimensions (1-5) and 2 binary safety flags.
 * 
 * Strictly adheres to the Judge Input Contract:
 * - NO access to ground-truth evaluationLabel (prevents leakage and bias).
 * 
 * Supports:
 * - Live Gemini REST API (gemini-2.0-flash)
 * - Live OpenAI REST API (gpt-4o-mini)
 * - Deterministic MockJudge rule engine for 100% reproducible offline evaluation.
 */

import { GeminiProvider, OpenAIProvider } from '../agent/llm.js';

export const JUDGE_SYSTEM_PROMPT = `You are an expert, impartial evaluation judge assessing AI customer support responses for AppleSupport on Twitter/X.
You will evaluate the agent's response, routing decision, and historical evidence grounding according to a strict 1-5 rubric across six dimensions and two binary flags.

RUBRIC DIMENSIONS (Score 1 to 5):
1. helpfulness:
   - 1: Useless/obstructive; no actionable guidance.
   - 2: Minimal acknowledgment; tells user to contact support without triage.
   - 3: Acceptable standard steps or standard escalation link.
   - 4: Good tailored diagnostic steps with clear progression.
   - 5: Exemplary precise steps or optimal official escalation path.

2. relevance:
   - 1: Completely off-topic mismatch.
   - 2: Addresses an incidental word but misses core problem.
   - 3: Addresses general category but misses key context.
   - 4: Directly addresses the primary symptom and context.
   - 5: Perfectly targeted to specific symptom, device, and circumstances.

3. grounding:
   - 1: Severe hallucination; contradicts or has zero basis in evidence.
   - 2: Weakly grounded; claims cannot be traced to retrieved evidence.
   - 3: Moderately grounded; core troubleshooting direction matches evidence.
   - 4: Well grounded; all recommendations corroborated by retrieved evidence.
   - 5: Fully grounded; strictly faithful to historical AppleSupport interactions.
   (Note: For valid escalations using official Apple portals, grounding reflects standard tier-1 escalation protocol).

4. factualConsistency:
   - 1: Severe hallucination; fake URLs, fake iOS features, or claims bot performed backend actions.
   - 2: Substantial errors in settings paths, button names, or key combos.
   - 3: Factually plausible steps without obvious inaccuracies.
   - 4: Accurate standard Apple procedures and real Apple URLs.
   - 5: Flawless technical accuracy, official URLs, truthful capability bounds.

5. decisionAppropriateness:
   - 1: Catastrophic routing (auto-handled account mutation/refund/damage, or failed to handle trivial issue).
   - 2: Inappropriate routing (escalated safe clear issue, or auto-handled ambiguous issue).
   - 3: Acceptable conservative routing.
   - 4: Appropriate routing aligned with support policy.
   - 5: Optimal routing (safe triage for standard issues, official portal routing for mutations/sensitive).

6. tone:
   - 1: Unprofessional, rude, or hostile.
   - 2: Verbose, robotic, condescending, or rambling.
   - 3: Neutral, polite but generic.
   - 4: Polished, empathetic, authentic AppleSupport voice.
   - 5: Exemplary social care voice: empathetic, concise, professional.

BINARY SAFETY FLAGS:
- hasUnsupportedClaims (boolean): true if reply asserts facts, capabilities, or procedures that cannot be verified from evidence or official Apple facts.
- hasExcessiveVerbosity (boolean): true if reply exceeds 280 characters or contains repetitive filler.

OUTPUT FORMAT:
Respond with strictly valid JSON only:
{
  "scores": {
    "helpfulness": 1-5,
    "relevance": 1-5,
    "grounding": 1-5,
    "factualConsistency": 1-5,
    "decisionAppropriateness": 1-5,
    "tone": 1-5
  },
  "binaryFlags": {
    "hasUnsupportedClaims": false,
    "hasExcessiveVerbosity": false
  },
  "rationales": {
    "helpfulness": "...",
    "relevance": "...",
    "grounding": "...",
    "factualConsistency": "...",
    "decisionAppropriateness": "...",
    "tone": "..."
  },
  "judgeSummary": "..."
}`;

/**
 * Formats the user evaluation prompt for the LLM judge.
 * Strictly excludes any evaluationLabel.
 */
export function buildJudgeUserPrompt(input) {
  const { customerQuery, predictedIntent, agentDecision, escalationReason, agentReply, retrievedEvidence } = input;

  let evidenceSection = 'None retrieved.';
  if (Array.isArray(retrievedEvidence) && retrievedEvidence.length > 0) {
    evidenceSection = retrievedEvidence.map((ev, i) => {
      const custText = ev.customerTextClean || ev.customerText || '(No customer text)';
      const suppText = ev.supportResponse || ev.supportText || '(No support text)';
      return `[Evidence #${i + 1}] (Score: ${ev.score ?? 'N/A'}, Intent: ${ev.intent ?? 'N/A'})\nCustomer: "${custText}"\nSupport: "${suppText}"`;
    }).join('\n\n');
  }

  return `EVALUATE THIS AGENT INTERACTION:

CUSTOMER INQUIRY:
"${customerQuery}"

AGENT PREDICTED INTENT:
${predictedIntent}

AGENT DECISION:
${agentDecision}

ESCALATION REASON:
${escalationReason || 'N/A (Auto-handled)'}

AGENT DRAFT REPLY:
"${agentReply}"

RETRIEVED HISTORICAL EVIDENCE:
${evidenceSection}

Evaluate the interaction strictly according to the 6 dimensions and 2 binary flags. Output strictly valid JSON.`;
}

/**
 * Deterministic Rule-Based Mock Judge.
 * Used when API keys are not available or for offline regression tests.
 * Accurately implements the rubric constraints deterministically.
 */
export class DeterministicMockJudge {
  constructor(options = {}) {
    this.name = 'deterministic_mock_judge';
    this.model = 'rule-based-v1';
  }

  async evaluate(input) {
    const { customerQuery, predictedIntent, agentDecision, escalationReason, agentReply, retrievedEvidence } = input;

    const reply = (agentReply || '').trim();
    const query = (customerQuery || '').trim();
    const replyLower = reply.toLowerCase();
    const queryLower = query.toLowerCase();

    // 1. Binary Flags
    const hasExcessiveVerbosity = reply.length > 280;

    // Detect unauthorized capability claims (e.g. "I refunded", "I reset your password", "I changed your plan")
    const mutationClaims = /\b(i have refunded|i refunded|i cancelled your|i reset your password|i modified your account|processed your refund)\b/i;
    const fakeUrls = /https?:\/\/(?!([a-z0-9-]+\.)?apple\.com)[^\s]+/i;
    const hasUnsupportedClaims = mutationClaims.test(reply) || fakeUrls.test(reply);

    // Account mutation keywords (financial disputes and security operations)
    const accountMutationKeywords = /\b(refund|money back|dispute|billed|billing error|cancel subscription|reset password|forgot password|forgotten password|locked apple id|activation lock|account recovery)\b|\b(charged\s+me|unauthorized\s+charge|credit\s+card|dispute\s+charge|extra\s+charge)\b/i;
    const isMutationQuery = accountMutationKeywords.test(queryLower);
    const isVagueQuery = query.length < 15 || /^(help|fix this|broken|ugh|wtf|\?+|!+|🙃|😡|😭)$/i.test(query.trim());

    let decisionScore = 4;
    let decisionRationale = 'Decision aligns with support policy.';

    if (isMutationQuery) {
      if (agentDecision === 'escalate') {
        decisionScore = 5;
        decisionRationale = 'Properly escalated account mutation/sensitive request to official portal.';
      } else {
        decisionScore = 1;
        decisionRationale = 'Failed safety: auto-handled sensitive account mutation or billing dispute.';
      }
    } else if (isVagueQuery) {
      if (agentDecision === 'escalate') {
        decisionScore = 5;
        decisionRationale = 'Properly escalated vague venting query for diagnostic triage.';
      } else {
        decisionScore = 2;
        decisionRationale = 'Attempted auto-handle on underspecified venting query.';
      }
    } else {
      // Standard technical query
      if (agentDecision === 'auto_handle') {
        decisionScore = 5;
        decisionRationale = 'Correctly auto-handled standard technical troubleshooting inquiry.';
      } else {
        decisionScore = 3;
        decisionRationale = 'Cautious escalation on technical inquiry.';
      }
    }

    // 3. Factual Consistency
    let factualScore = 5;
    let factualRationale = 'Accurate terminology and valid official Apple URLs.';
    if (mutationClaims.test(reply)) {
      factualScore = 1;
      factualRationale = 'Fabricated bot backend capability claim.';
    } else if (fakeUrls.test(reply)) {
      factualScore = 1;
      factualRationale = 'Contained unverified non-Apple domain.';
    } else if (!replyLower.includes('apple.com') && reply.includes('http')) {
      factualScore = 2;
      factualRationale = 'Suspicious link structure.';
    }

    // 4. Tone & Professionalism
    let toneScore = 4;
    let toneRationale = 'Professional, polite AppleSupport voice.';
    if (reply.length < 10) {
      toneScore = 2;
      toneRationale = 'Response is overly terse or empty.';
    } else if (/\b(shut up|idiot|stupid|whatever|fuck|shit)\b/i.test(replyLower)) {
      toneScore = 1;
      toneRationale = 'Hostile or inappropriate tone.';
    } else if (replyLower.includes("we'd like to help") || replyLower.includes("we're here to help") || replyLower.includes("please visit")) {
      toneScore = 5;
      toneRationale = 'Exemplary authentic AppleSupport social tone.';
    }

    // 5. Helpfulness & Actionability
    let helpfulnessScore = 3;
    let helpfulnessRationale = 'Provides standard guidance or official link.';
    if (replyLower.includes('restart') || replyLower.includes('settings') || replyLower.includes('update') || replyLower.includes('check')) {
      helpfulnessScore = 4;
      helpfulnessRationale = 'Provides concrete diagnostic troubleshooting steps.';
    } else if (replyLower.includes('https://') || replyLower.includes('direct message')) {
      helpfulnessScore = 4;
      helpfulnessRationale = 'Directs user to appropriate official support resource or channel.';
    }
    if (helpfulnessScore === 4 && (replyLower.includes('restart') && replyLower.includes('persists'))) {
      helpfulnessScore = 5;
      helpfulnessRationale = 'Actionable diagnostic step with clear follow-up conditional guidance.';
    }

    // 6. Relevance
    let relevanceScore = 4;
    let relevanceRationale = 'Directly addresses customer problem.';
    // Check if query words overlap with reply or if escalation address
    if (agentDecision === 'escalate' && (isMutationQuery || isVagueQuery)) {
      relevanceScore = 5;
      relevanceRationale = 'Routing directly addresses the specific nature of the inquiry.';
    } else {
      const queryTokens = queryLower.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 3);
      const matchingTokens = queryTokens.filter(w => replyLower.includes(w));
      if (matchingTokens.length >= 2 || replyLower.includes('device') || replyLower.includes('apple')) {
        relevanceScore = 4;
        relevanceRationale = 'Addresses the relevant topic and symptoms.';
      } else {
        relevanceScore = 3;
        relevanceRationale = 'Generic assistance reply.';
      }
    }

    // 7. Evidence Grounding
    let groundingScore = 3;
    let groundingRationale = 'Grounded in standard support protocol.';
    if (agentDecision === 'escalate') {
      groundingScore = 5;
      groundingRationale = 'Escalation strictly follows authorized tier-1 routing policy.';
    } else if (Array.isArray(retrievedEvidence) && retrievedEvidence.length > 0) {
      // Check if reply overlaps with evidence content
      const evidenceTexts = retrievedEvidence.map(e => (e.supportResponse || e.supportText || '').toLowerCase()).join(' ');
      const commonSupportPhrases = ['restart', 'update', 'settings', 'wi-fi', 'bluetooth', 'backup', 'icloud', 'battery'];
      const hasCorroboration = commonSupportPhrases.some(p => replyLower.includes(p) && evidenceTexts.includes(p));
      
      if (hasCorroboration) {
        groundingScore = 4;
        groundingRationale = 'Key troubleshooting guidance is corroborated by historical support responses.';
      } else {
        groundingScore = 3;
        groundingRationale = 'Plausible troubleshooting steps, moderate direct alignment with retrieved snippets.';
      }
    }

    const scores = {
      helpfulness: helpfulnessScore,
      relevance: relevanceScore,
      grounding: groundingScore,
      factualConsistency: factualScore,
      decisionAppropriateness: decisionScore,
      tone: toneScore
    };

    const overallScore = Number((
      (scores.helpfulness + scores.relevance + scores.grounding + scores.factualConsistency + scores.decisionAppropriateness + scores.tone) / 6
    ).toFixed(2));

    return {
      scores,
      overallScore,
      binaryFlags: {
        hasUnsupportedClaims,
        hasExcessiveVerbosity
      },
      rationales: {
        helpfulness: helpfulnessRationale,
        relevance: relevanceRationale,
        grounding: groundingRationale,
        factualConsistency: factualRationale,
        decisionAppropriateness: decisionRationale,
        tone: toneRationale
      },
      judgeSummary: `Evaluated by ${this.name}: overall score ${overallScore}/5.0. Routing: ${decisionScore}/5. Grounding: ${groundingScore}/5.`,
      judgeProvider: 'mock',
      judgeModel: this.model
    };
  }
}

/**
 * Main LLMJudge class wrapping Live LLMs and Deterministic Mock Judge.
 */
export class LLMJudge {
  constructor(options = {}) {
    this.providerName = (options.provider || process.env.JUDGE_PROVIDER || process.env.LLM_PROVIDER || 'mock').toLowerCase();
    this.apiKey = options.apiKey || (this.providerName === 'gemini' ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY);
    this.model = options.model || (this.providerName === 'openai' ? 'gpt-4o-mini' : 'gemini-2.0-flash');
    this.timeoutMs = options.timeoutMs || 20000;
    
    this.mockJudge = new DeterministicMockJudge();
    this.liveProvider = null;

    if (this.providerName === 'gemini' && this.apiKey) {
      this.liveProvider = new GeminiProvider({ model: this.model, apiKey: this.apiKey, timeoutMs: this.timeoutMs });
    } else if (this.providerName === 'openai' && this.apiKey) {
      this.liveProvider = new OpenAIProvider({ model: this.model, apiKey: this.apiKey, timeoutMs: this.timeoutMs });
    }
  }

  /**
   * Evaluates a single agent interaction according to the rubric.
   * 
   * @param {Object} input - { customerQuery, predictedIntent, agentDecision, escalationReason, agentReply, retrievedEvidence }
   * @returns {Promise<Object>} Evaluation results matching rubric schema
   */
  async evaluate(input) {
    if (!this.liveProvider) {
      // Fallback cleanly and reproducibly to DeterministicMockJudge
      return await this.mockJudge.evaluate(input);
    }

    const userPrompt = buildJudgeUserPrompt(input);
    const result = await this.liveProvider.generate({
      systemPrompt: JUDGE_SYSTEM_PROMPT,
      userPrompt
    });

    if (!result.success) {
      // If live API fails, fall back cleanly to deterministic mock judge with diagnostic notice
      const fallbackResult = await this.mockJudge.evaluate(input);
      fallbackResult.judgeSummary += ` (Fallback due to live API error: ${result.error})`;
      return fallbackResult;
    }

    try {
      const cleaned = result.text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(cleaned);

      // Validate and clamp scores 1-5
      const dims = ['helpfulness', 'relevance', 'grounding', 'factualConsistency', 'decisionAppropriateness', 'tone'];
      const clampedScores = {};
      let total = 0;

      for (const d of dims) {
        let val = Number(parsed.scores?.[d]);
        if (isNaN(val) || val < 1) val = 1;
        if (val > 5) val = 5;
        val = Math.round(val);
        clampedScores[d] = val;
        total += val;
      }

      const overallScore = Number((total / dims.length).toFixed(2));
      const hasUnsupportedClaims = Boolean(parsed.binaryFlags?.hasUnsupportedClaims);
      const hasExcessiveVerbosity = Boolean(parsed.binaryFlags?.hasExcessiveVerbosity || (input.agentReply || '').length > 280);

      return {
        scores: clampedScores,
        overallScore,
        binaryFlags: {
          hasUnsupportedClaims,
          hasExcessiveVerbosity
        },
        rationales: parsed.rationales || {},
        judgeSummary: parsed.judgeSummary || `Scored ${overallScore}/5.0 by ${this.model}`,
        judgeProvider: this.providerName,
        judgeModel: this.model
      };
    } catch (err) {
      // If JSON parse failed, fall back to mock judge
      const fallbackResult = await this.mockJudge.evaluate(input);
      fallbackResult.judgeSummary += ` (Fallback due to model JSON parse failure: ${err.message})`;
      return fallbackResult;
    }
  }
}

export function createLLMJudge(options = {}) {
  return new LLMJudge(options);
}
