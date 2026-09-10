/**
 * Structured Run Logger for AppleSupport AI Support Agent.
 * 
 * Captures comprehensive telemetry and audit logs for every query:
 * - Query text and metadata
 * - Deterministic intent & confidence
 * - Retrieved candidate IDs & scores
 * - Raw LLM draft response (for Phase 7 error analysis)
 * - Validation results & violations
 * - Pre & post guardrail decisions & overrides
 * - Processing latencies
 * 
 * Security: Strictly excludes API keys, auth headers, and sensitive personal credentials.
 */

import fs from 'fs';
import path from 'path';

export class AgentLogger {
  constructor(options = {}) {
    this.logFile = options.logFile || null;
    this.inMemoryLogs = [];
    this.maxMemoryLogs = options.maxMemoryLogs || 500;
  }

  /**
   * Log an agent interaction.
   * @param {Object} logEntry
   */
  log(logEntry) {
    const sanitizedEntry = {
      timestamp: new Date().toISOString(),
      customerText: logEntry.customerText,
      intent: logEntry.intent,
      intentConfidence: logEntry.intentConfidence,
      retrievedEvidence: (logEntry.retrievedEvidence || []).map(e => ({
        rank: e.rank,
        customerTweetId: e.customerTweetId,
        supportTweetId: e.supportTweetId,
        score: e.score,
        intent: e.intent
      })),
      filterSummary: logEntry.filterSummary || null,
      rawModelDraft: logEntry.rawModelDraft || null,
      validation: logEntry.validation || null,
      modelDecision: logEntry.rawModelDraft?.decision || null,
      finalDecision: logEntry.finalDecision,
      escalationReason: logEntry.escalationReason || null,
      guardrailOverride: logEntry.guardrailOverride || null,
      latencyMs: logEntry.latencyMs
    };

    this.inMemoryLogs.push(sanitizedEntry);
    if (this.inMemoryLogs.length > this.maxMemoryLogs) {
      this.inMemoryLogs.shift();
    }

    if (this.logFile) {
      try {
        const dir = path.dirname(this.logFile);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.appendFileSync(this.logFile, JSON.stringify(sanitizedEntry) + '\n', 'utf8');
      } catch (err) {
        // Silently ignore disk logging error to prevent breaking runtime execution
      }
    }

    return sanitizedEntry;
  }

  getRecentLogs(limit = 50) {
    return this.inMemoryLogs.slice(-limit);
  }

  clear() {
    this.inMemoryLogs = [];
  }
}
