/**
 * Structured Run Logger for AppleSupport AI Support Agent.
 * 
 * Separates operational modes:
 * - Production Telemetry Mode: Omits raw customer text and raw model drafts to prevent
 *   storing PII. Logs only non-sensitive operational metrics (latencies, counts, decision badges).
 * - Development & Evaluation Mode (Phase 7): Captures rich audit payloads (rawModelDraft,
 *   validation violations, filter rationale) essential for offline error analysis and evaluation.
 * 
 * Security: Strictly sanitizes credentials, authorization tokens, API keys, and passwords.
 */

import fs from 'fs';
import path from 'path';

/**
 * Sanitizes an object to guarantee no sensitive credentials or keys are logged.
 * @param {any} obj
 * @returns {any}
 */
export function sanitizeCredentials(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const SENSITIVE_KEYS = new Set([
    'apikey', 'api_key', 'authorization', 'bearer', 'password',
    'secret', 'token', 'access_token', 'gemini_api_key', 'openai_api_key'
  ]);

  if (Array.isArray(obj)) {
    return obj.map(sanitizeCredentials);
  }

  const sanitized = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      sanitized[k] = '[REDACTED_CREDENTIAL]';
    } else if (v && typeof v === 'object') {
      sanitized[k] = sanitizeCredentials(v);
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

export class AgentLogger {
  constructor(options = {}) {
    this.mode = options.mode || (process.env.NODE_ENV === 'production' ? 'production' : 'evaluation');
    this.logFile = options.logFile || null;
    this.inMemoryLogs = [];
    this.maxMemoryLogs = options.maxMemoryLogs || 500;
  }

  /**
   * Log an agent interaction according to operational mode.
   * @param {Object} logEntry
   * @returns {Object} The recorded log entry
   */
  log(logEntry) {
    const isProduction = this.mode === 'production';
    const timestamp = new Date().toISOString();

    let entryToRecord;

    if (isProduction) {
      // Production Telemetry: strictly privacy-safe (zero raw PII / customer text / model text)
      entryToRecord = {
        timestamp,
        logMode: 'production_telemetry',
        intent: logEntry.intent,
        intentConfidence: logEntry.intentConfidence,
        decision: logEntry.finalDecision,
        escalationReason: logEntry.escalationReason || null,
        guardrailOverride: logEntry.guardrailOverride || null,
        evidenceCount: (logEntry.retrievedEvidence || []).length,
        latencyMs: logEntry.latencyMs
      };
    } else {
      // Evaluation & Development Mode: rich structured metadata for Phase 7 analysis
      entryToRecord = {
        timestamp,
        logMode: this.mode, // 'evaluation' or 'development'
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
    }

    const sanitized = sanitizeCredentials(entryToRecord);

    this.inMemoryLogs.push(sanitized);
    if (this.inMemoryLogs.length > this.maxMemoryLogs) {
      this.inMemoryLogs.shift();
    }

    if (this.logFile) {
      try {
        const dir = path.dirname(this.logFile);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.appendFileSync(this.logFile, JSON.stringify(sanitized) + '\n', 'utf8');
      } catch (err) {
        // Silently catch disk write error to prevent failing the inquiry
      }
    }

    return sanitized;
  }

  getRecentLogs(limit = 50) {
    return this.inMemoryLogs.slice(-limit);
  }

  clear() {
    this.inMemoryLogs = [];
  }
}
