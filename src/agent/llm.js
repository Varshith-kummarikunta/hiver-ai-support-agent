/**
 * Pluggable LLM Provider Adapter for AppleSupport AI Support Agent.
 * 
 * Supports:
 * - Gemini REST API (gemini-2.0-flash, etc.)
 * - OpenAI REST API (gpt-4o-mini, gpt-3.5-turbo, etc.)
 * - MockProvider for deterministic offline unit testing (zero API keys required)
 * 
 * Uses native Node 20 fetch, zero heavy external SDKs, fails gracefully on network/key errors.
 */

export class LLMAdapter {
  constructor(options = {}) {
    this.model = options.model;
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 15000;
  }

  async generate({ systemPrompt, userPrompt }) {
    throw new Error('LLMAdapter.generate() must be implemented by subclass');
  }
}

export class GeminiProvider extends LLMAdapter {
  constructor(options = {}) {
    super({
      model: options.model || process.env.AGENT_MODEL || 'gemini-2.0-flash',
      apiKey: options.apiKey || process.env.GEMINI_API_KEY,
      timeoutMs: options.timeoutMs
    });
  }

  async generate({ systemPrompt, userPrompt }) {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'Missing GEMINI_API_KEY environment variable',
        code: 'MISSING_API_KEY'
      };
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    };

    if (systemPrompt) {
      payload.systemInstruction = {
        parts: [{ text: systemPrompt }]
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return {
          success: false,
          error: `Gemini API HTTP ${response.status}: ${errorText.slice(0, 300)}`,
          code: `HTTP_${response.status}`
        };
      }

      const json = await response.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        return {
          success: false,
          error: 'Gemini API returned empty candidate content',
          code: 'EMPTY_RESPONSE'
        };
      }

      return {
        success: true,
        text,
        model: this.model,
        provider: 'gemini'
      };
    } catch (err) {
      clearTimeout(timeout);
      return {
        success: false,
        error: err.name === 'AbortError' ? 'Gemini API request timed out' : err.message,
        code: err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR'
      };
    }
  }
}

export class OpenAIProvider extends LLMAdapter {
  constructor(options = {}) {
    super({
      model: options.model || process.env.AGENT_MODEL || 'gpt-4o-mini',
      apiKey: options.apiKey || process.env.OPENAI_API_KEY,
      timeoutMs: options.timeoutMs
    });
  }

  async generate({ systemPrompt, userPrompt }) {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'Missing OPENAI_API_KEY environment variable',
        code: 'MISSING_API_KEY'
      };
    }

    const endpoint = 'https://api.openai.com/v1/chat/completions';
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userPrompt });

    const payload = {
      model: this.model,
      messages,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return {
          success: false,
          error: `OpenAI API HTTP ${response.status}: ${errorText.slice(0, 300)}`,
          code: `HTTP_${response.status}`
        };
      }

      const json = await response.json();
      const text = json.choices?.[0]?.message?.content;

      if (!text) {
        return {
          success: false,
          error: 'OpenAI API returned empty response content',
          code: 'EMPTY_RESPONSE'
        };
      }

      return {
        success: true,
        text,
        model: this.model,
        provider: 'openai'
      };
    } catch (err) {
      clearTimeout(timeout);
      return {
        success: false,
        error: err.name === 'AbortError' ? 'OpenAI API request timed out' : err.message,
        code: err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR'
      };
    }
  }
}

export class MockProvider extends LLMAdapter {
  constructor(options = {}) {
    super(options);
    this.customResponder = options.customResponder || null;
    this.failureMode = options.failureMode || null; // 'network_error', 'invalid_json', 'timeout', etc.
  }

  setCustomResponder(fn) {
    this.customResponder = fn;
  }

  setFailureMode(mode) {
    this.failureMode = mode;
  }

  async generate({ systemPrompt, userPrompt }) {
    if (this.failureMode === 'network_error') {
      return { success: false, error: 'Simulated connection failure', code: 'NETWORK_ERROR' };
    }
    if (this.failureMode === 'timeout') {
      return { success: false, error: 'Simulated request timeout', code: 'TIMEOUT' };
    }
    if (this.failureMode === 'invalid_json') {
      return { success: true, text: 'This is not valid JSON at all: <xml>broken</xml>', model: 'mock', provider: 'mock' };
    }

    if (typeof this.customResponder === 'function') {
      const customOutput = await this.customResponder({ systemPrompt, userPrompt });
      const text = typeof customOutput === 'string' ? customOutput : JSON.stringify(customOutput);
      return { success: true, text, model: 'mock', provider: 'mock' };
    }

    // Default mock behavior: extract context from userPrompt and return grounded JSON
    const intentMatch = userPrompt.match(/PREDICTED INTENT:\s*([a-z_]+)/i);
    const intent = intentMatch ? intentMatch[1] : 'other_unclear';

    // Check if userPrompt contains evidence
    const hasEvidence = userPrompt.includes('HISTORICAL EVIDENCE CANDIDATES');

    const defaultMockResponse = {
      intent,
      intentConfidence: 0.85,
      reply: "We want to help resolve this issue with your Apple device. Please try restarting your device, and let us know if the issue persists.",
      decision: hasEvidence ? "auto_handle" : "escalate",
      escalationReason: hasEvidence ? null : "Historical evidence does not provide sufficiently grounded guidance.",
      evidence: [
        {
          rank: 1,
          customerTweetId: "1734376",
          supportTweetId: "1734374",
          score: 20.75,
          intent,
          supportResponseUsed: true
        }
      ],
      grounding: {
        supportedByHistoricalEvidence: true,
        evidenceSummary: "Grounding supported by top historical customer interaction sharing matching intent."
      }
    };

    return {
      success: true,
      text: JSON.stringify(defaultMockResponse),
      model: 'mock',
      provider: 'mock'
    };
  }
}

/**
 * Factory function to instantiate configured LLM provider.
 * @param {Object} options
 * @returns {LLMAdapter}
 */
export function createLLMProvider(options = {}) {
  const providerName = (options.provider || process.env.LLM_PROVIDER || 'gemini').toLowerCase();

  switch (providerName) {
    case 'gemini':
      return new GeminiProvider(options);
    case 'openai':
      return new OpenAIProvider(options);
    case 'mock':
      return new MockProvider(options);
    default:
      throw new Error(`Unsupported LLM provider: '${providerName}'. Supported: 'gemini', 'openai', 'mock'`);
  }
}
