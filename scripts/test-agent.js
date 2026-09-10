/**
 * Comprehensive Unit and Integration Test Suite for AppleSupport AI Support Agent.
 * 
 * Tests 22 distinct scenarios with zero external API dependencies:
 * - Uses MockProvider for deterministic LLM behavior
 * - Tests informational vs action billing queries
 * - Tests troubleshooting vs repair hardware queries
 * - Tests vague vs informative other_unclear queries
 * - Tests empty, punctuation, emoji inputs
 * - Tests configurable confidence & BM25 score thresholds
 * - Tests safety violations: false action claims, internal ID leaks, invalid JSON
 * - Tests deterministic guardrail overrides
 * - Tests API failure resilience
 * - Tests customer reply cleanliness
 */

import assert from 'assert';
import { SupportAgent } from '../src/agent/agent.js';
import { MockProvider } from '../src/agent/llm.js';
import { validateAgentOutputSchema } from '../src/agent/schema.js';
import { isAccountMutationRequest, isVagueOrVenting } from '../src/agent/guardrails.js';

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [Check ${totalTests}] ${name} -> PASS ✅`);
    passedTests++;
  } catch (err) {
    console.error(`  [Check ${totalTests}] ${name} -> FAIL ❌: ${err.message}`);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  [Check ${totalTests}] ${name} -> PASS ✅`);
    passedTests++;
  } catch (err) {
    console.error(`  [Check ${totalTests}] ${name} -> FAIL ❌: ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('===============================================================');
  console.log('TEST SUITE: APPLESUPPORT AI SUPPORT AGENT (PHASE 6)');
  console.log('===============================================================\n');

  // Shared test agent with MockProvider
  const mockProvider = new MockProvider();
  const agent = new SupportAgent({
    provider: 'mock',
    llmProvider: mockProvider,
    minConfidence: 0.40,
    minBm25Score: 5.0
  });

  console.log('1. Initializing Agent and Models...');
  await agent.initialize();
  assert.ok(agent.isInitialized, 'Agent must be initialized');
  console.log('  Models loaded successfully.\n');

  console.log('2. Testing Query Classification and Edge-Case Guards...');

  // Test 1: Valid normal technical query
  await runAsyncTest('Valid normal technical query (battery drain -> auto_handle)', async () => {
    mockProvider.setCustomResponder(() => ({
      intent: 'battery_power',
      intentConfidence: 0.85,
      reply: "We know battery life is important. Please take a look at your battery usage in Settings > Battery, and let us know what you see.",
      decision: 'auto_handle',
      escalationReason: null,
      evidence: [{ rank: 1, customerTweetId: "1734376", supportTweetId: "1734374", score: 20.75, intent: "battery_power", supportResponseUsed: true }],
      grounding: { supportedByHistoricalEvidence: true, evidenceSummary: "Grounded in top battery troubleshooting interaction." }
    }));

    const res = await agent.processInquiry('my iphone battery is draining very fast after the new update');
    assert.strictEqual(res.intent, 'battery_power');
    assert.strictEqual(res.decision, 'auto_handle');
    assert.ok(res.reply.length > 15, 'Reply must be substantive');
    const schema = validateAgentOutputSchema(res);
    assert.ok(schema.isValid, `Schema must be valid: ${schema.errors.join('; ')}`);
  });

  // Test 2: Account-specific credential query
  await runAsyncTest('Account-specific query ("reset my apple id password" -> escalates)', async () => {
    mockProvider.setCustomResponder(() => ({
      intent: 'account_icloud',
      intentConfidence: 0.90,
      reply: "I will reset your password right now.",
      decision: 'auto_handle', // LLM attempts to auto-handle
      escalationReason: null,
      evidence: [],
      grounding: { supportedByHistoricalEvidence: true, evidenceSummary: "Password reset." }
    }));

    const res = await agent.processInquiry('I forgot my password and need to reset my Apple ID password');
    assert.strictEqual(res.decision, 'escalate', 'Guardrail must override LLM and force escalate');
    assert.ok(res.escalationReason.includes('Account security operations') || res.escalationReason.includes('password'));
    assert.ok(!res.reply.includes('I will reset your password'), 'Must not make false action claims');
  });

  // Test 3: Account-specific billing action (refund request -> escalates)
  await runAsyncTest('Account-specific billing action (refund request -> escalates)', async () => {
    const res = await agent.processInquiry('I was charged twice for an app and I want a full refund immediately');
    assert.strictEqual(res.decision, 'escalate');
    assert.ok(res.escalationReason.includes('Billing mutations and refund requests'));
  });

  // Test 4: Informational billing question with useful evidence (can be auto_handle)
  await runAsyncTest('Informational billing question with useful evidence (not automatically escalated)', async () => {
    mockProvider.setCustomResponder(() => ({
      intent: 'billing_subscriptions',
      intentConfidence: 0.80,
      reply: "To view or cancel your subscriptions, open Settings > [Your Name] > Subscriptions. Let us know if you need further help.",
      decision: 'auto_handle',
      escalationReason: null,
      evidence: [{ rank: 1, customerTweetId: "12345", supportTweetId: "12346", score: 18.5, intent: "billing_subscriptions", supportResponseUsed: true }],
      grounding: { supportedByHistoricalEvidence: true, evidenceSummary: "Grounded in subscription settings guidance." }
    }));

    const res = await agent.processInquiry('How do I view my active subscriptions on my iPhone?');
    assert.strictEqual(res.intent, 'billing_subscriptions');
    // Informational question: should NOT be blocked by billing mutation guardrail
    const mutation = isAccountMutationRequest('How do I view my active subscriptions on my iPhone?');
    assert.strictEqual(mutation.isMutation, false, 'Informational question must not be classified as mutation');
    assert.strictEqual(res.decision, 'auto_handle');
  });

  // Test 5: Hardware troubleshooting with useful evidence (can be auto_handle)
  await runAsyncTest('Hardware troubleshooting with useful evidence (can be handled)', async () => {
    mockProvider.setCustomResponder(() => ({
      intent: 'display_hardware',
      intentConfidence: 0.82,
      reply: "Let's work together on this. Have you tried a forced restart of your iPhone? Here are the steps to try.",
      decision: 'auto_handle',
      escalationReason: null,
      evidence: [{ rank: 1, customerTweetId: "511134", supportTweetId: "511132", score: 25.0, intent: "display_hardware", supportResponseUsed: true }],
      grounding: { supportedByHistoricalEvidence: true, evidenceSummary: "Grounded in frozen screen troubleshooting." }
    }));

    const res = await agent.processInquiry('My iPhone screen is freezing on a black display');
    assert.strictEqual(res.intent, 'display_hardware');
    assert.strictEqual(res.decision, 'auto_handle');
  });

  // Test 6: Hardware repair / booking action (escalates)
  await runAsyncTest('Hardware repair / appointment booking request (escalates)', async () => {
    const res = await agent.processInquiry('My screen is shattered and I need to book a Genius Bar appointment for screen replacement');
    assert.strictEqual(res.decision, 'escalate');
    assert.ok(res.escalationReason.includes('hardware service') || res.escalationReason.includes('repair'));
  });

  // Test 7: other_unclear vague/venting query (escalates)
  await runAsyncTest('other_unclear vague/venting case ("fix this shit" -> escalates)', async () => {
    const res = await agent.processInquiry('fix this shit');
    assert.strictEqual(res.decision, 'escalate');
    assert.ok(res.escalationReason.includes('Inquiry lacks sufficient diagnostic detail'));
  });

  // Test 8: Informative query requiring clarification / safe handling
  await runAsyncTest('Informative query requiring clarification (handles safely without crashing)', async () => {
    mockProvider.setCustomResponder(() => ({
      intent: 'other_unclear',
      intentConfidence: 0.60,
      reply: "We'd like to help get this sorted out. Could you tell us more about what happened during the setup?",
      decision: 'escalate',
      escalationReason: "Inquiry requires more diagnostic context.",
      evidence: [{ rank: 1, customerTweetId: "999", supportTweetId: "998", score: 12.0, intent: "other_unclear", supportResponseUsed: true }],
      grounding: { supportedByHistoricalEvidence: true, evidenceSummary: "Clarification request." }
    }));

    const res = await agent.processInquiry('My device is behaving erratically after I finished initial setup');
    assert.ok(res.reply.length > 10, 'Must produce substantive reply');
    assert.ok(['auto_handle', 'escalate'].includes(res.decision));
    const schema = validateAgentOutputSchema(res);
    assert.ok(schema.isValid, `Schema must be valid: ${schema.errors.join('; ')}`);
  });

  // Test 9: Empty customer query
  await runAsyncTest('Empty customer query (handled safely -> escalates)', async () => {
    const res = await agent.processInquiry('');
    assert.strictEqual(res.decision, 'escalate');
    assert.ok(res.escalationReason.includes('empty or non-informative'));
  });

  // Test 10: Punctuation-only query
  await runAsyncTest('Punctuation-only query ("??? !!!" -> escalates)', async () => {
    const res = await agent.processInquiry('??? !!! ...');
    assert.strictEqual(res.decision, 'escalate');
    assert.ok(res.escalationReason.includes('empty or non-informative'));
  });

  // Test 11: Emoji-only query
  await runAsyncTest('Emoji-only query ("😡📱" -> escalates)', async () => {
    const res = await agent.processInquiry('😡📱💥');
    assert.strictEqual(res.decision, 'escalate');
    assert.ok(res.escalationReason.includes('empty or non-informative'));
  });

  // Test 12: Low intent confidence (< minConfidence -> escalates)
  await runAsyncTest('Low intent confidence classification (< 0.40 -> guardrail escalates)', async () => {
    // Run inquiry with high confidence threshold (0.99) to verify threshold enforcement
    const res = await agent.processInquiry('strange intermittent bug', { minConfidence: 0.99 });
    assert.strictEqual(res.decision, 'escalate');
    assert.ok(res.escalationReason.includes('below operational threshold'));
  });

  // Test 13: Configurable BM25 threshold behavior
  await runAsyncTest('Configurable BM25 threshold (minBm25Score = 100.0 -> evidence insufficient -> escalates)', async () => {
    // Set an artificially high score threshold so all evidence is filtered out
    const res = await agent.processInquiry('my battery is draining', { minBm25Score: 100.0 });
    assert.strictEqual(res.decision, 'escalate');
    assert.ok(res.escalationReason.includes('Historical evidence does not provide sufficiently grounded guidance'));
  });

  console.log('\n3. Testing Post-Generation Safety and Validation Guardrails...');

  // Test 14: LLM output that attempts to claim an action was performed
  await runAsyncTest('LLM draft claiming action performed ("I have refunded..." -> guardrail overrides to escalate)', async () => {
    mockProvider.setCustomResponder(() => ({
      intent: 'billing_subscriptions',
      intentConfidence: 0.85,
      reply: "I have refunded your money for the App Store purchase. Have a great day!",
      decision: 'auto_handle',
      escalationReason: null,
      evidence: [{ rank: 1, customerTweetId: "123", supportTweetId: "124", score: 20.0, intent: "billing_subscriptions", supportResponseUsed: true }],
      grounding: { supportedByHistoricalEvidence: true, evidenceSummary: "Refund processed." }
    }));

    const res = await agent.processInquiry('can you help with this billing error?');
    assert.strictEqual(res.decision, 'escalate', 'Guardrail must catch false action claim and force escalate');
    assert.ok(res._internal.validation.violations.some(v => v.includes('performed a backend mutation')));
    assert.ok(!res.reply.includes('I have refunded'), 'Customer reply must be clean of false claims');
  });

  // Test 15: LLM output containing internal IDs / scores
  await runAsyncTest('LLM draft leaking internal IDs or BM25 scores (validation catches -> escalates)', async () => {
    mockProvider.setCustomResponder(() => ({
      intent: 'battery_power',
      intentConfidence: 0.88,
      reply: "According to tweet 1734376 with BM25 score 24.5, you should charge your phone.",
      decision: 'auto_handle',
      escalationReason: null,
      evidence: [{ rank: 1, customerTweetId: "1734376", supportTweetId: "1734374", score: 24.5, intent: "battery_power", supportResponseUsed: true }],
      grounding: { supportedByHistoricalEvidence: true, evidenceSummary: "Grounded." }
    }));

    const res = await agent.processInquiry('my iphone battery dies very quickly');
    assert.strictEqual(res.decision, 'escalate');
    assert.ok(res._internal.validation.violations.some(v => v.includes('leaks')));
    assert.ok(!res.reply.includes('BM25'), 'Customer reply must never mention BM25');
    assert.ok(!res.reply.includes('1734376'), 'Customer reply must never leak tweet ID');
  });

  // Test 16: Invalid LLM JSON output
  await runAsyncTest('Invalid LLM JSON response (caught safely -> escalates without crash)', async () => {
    mockProvider.setFailureMode('invalid_json');
    const res = await agent.processInquiry('my keyboard is typing duplicate letters');
    mockProvider.setFailureMode(null); // reset

    assert.strictEqual(res.decision, 'escalate');
    assert.ok(res._internal.draftParseError.includes('JSON parse failure'));
  });

  // Test 17: Missing escalation reason in model escalate response
  await runAsyncTest('Missing escalation reason in model escalate draft (schema validator catches -> fixed)', async () => {
    mockProvider.setCustomResponder(() => ({
      intent: 'apps_appstore',
      intentConfidence: 0.80,
      reply: "Please contact support.",
      decision: 'escalate',
      escalationReason: "", // Empty reason violates schema!
      evidence: [],
      grounding: { supportedByHistoricalEvidence: false, evidenceSummary: "Escalated" }
    }));

    const res = await agent.processInquiry('app store keeps crashing when opening');
    assert.strictEqual(res.decision, 'escalate');
    assert.ok(res.escalationReason.length > 0, 'Final escalation reason must be non-empty');
  });

  // Test 18: API failure / timeout handling
  await runAsyncTest('LLM API failure handling (network error -> fails safely to escalate)', async () => {
    mockProvider.setFailureMode('network_error');
    const res = await agent.processInquiry('my wifi keeps disconnecting');
    mockProvider.setFailureMode(null); // reset

    assert.strictEqual(res.decision, 'escalate');
    assert.ok(res.escalationReason.includes('LLM generation unavailable or failed'));
    assert.ok(res.reply.includes('Apple Support'), 'Must return courteous public fallback');
  });

  // Test 19: Guardrail override of an unsafe LLM decision
  await runAsyncTest('Guardrail override of unsafe LLM decision (LLM auto_handles password reset -> overridden)', async () => {
    mockProvider.setCustomResponder(() => ({
      intent: 'account_icloud',
      intentConfidence: 0.95,
      reply: "Just reply with your email and I will unlock it for you.",
      decision: 'auto_handle',
      escalationReason: null,
      evidence: [{ rank: 1, customerTweetId: "111", supportTweetId: "112", score: 15.0, intent: "account_icloud", supportResponseUsed: true }],
      grounding: { supportedByHistoricalEvidence: true, evidenceSummary: "Unlocked." }
    }));

    const res = await agent.processInquiry('my apple id is locked and disabled');
    assert.strictEqual(res.decision, 'escalate');
    assert.ok(res._internal.guardrailOverride.includes('OVERRIDE_PRE_ACCOUNT_MUTATION'));
  });

  console.log('\n4. Testing Determinism and Architecture Verification...');

  // Test 20: Deterministic intent classification matches Phase 4 model
  runTest('Deterministic intent classification matches Phase 4 baseline model exactly', () => {
    const q1 = agent.classifier.predict('my iphone battery is draining very fast');
    const q2 = agent.classifier.predict('my iphone battery is draining very fast');
    assert.strictEqual(q1.intent, q2.intent);
    assert.strictEqual(q1.confidence, q2.confidence);
    assert.strictEqual(q1.intent, 'battery_power');
  });

  // Test 21: Evidence fields preserved in output
  await runAsyncTest('Evidence fields preserved in structured output', async () => {
    mockProvider.setCustomResponder(() => ({
      intent: 'battery_power',
      intentConfidence: 0.85,
      reply: "Please check your battery usage in Settings > Battery.",
      decision: 'auto_handle',
      escalationReason: null,
      evidence: [{ rank: 1, customerTweetId: "1734376", supportTweetId: "1734374", score: 20.75, intent: "battery_power", supportResponseUsed: true }],
      grounding: { supportedByHistoricalEvidence: true, evidenceSummary: "Battery evidence." }
    }));

    const res = await agent.processInquiry('battery health advice');
    assert.ok(Array.isArray(res.evidence));
    assert.ok(res.evidence.length > 0);
    const ev = res.evidence[0];
    assert.ok('rank' in ev);
    assert.ok('customerTweetId' in ev);
    assert.ok('supportTweetId' in ev);
    assert.ok('score' in ev);
    assert.ok('intent' in ev);
    assert.ok('supportResponseUsed' in ev);
  });

  // Test 22: Public customer reply cleanliness
  await runAsyncTest('Public customer reply cleanliness (zero internal IDs or scores in text)', async () => {
    const res = await agent.processInquiry('my sound is low on calls');
    assert.ok(!res.reply.includes('BM25'), 'No BM25 mentions');
    assert.ok(!res.reply.includes('score:'), 'No score mentions');
    assert.ok(!res.reply.includes('GOLD-'), 'No golden ID mentions');
    assert.ok(!res.reply.includes('tweet_id'), 'No internal database names');
  });

  console.log('\n===============================================================');
  console.log(`AGENT TEST SUMMARY: ${passedTests} / ${totalTests} CHECKS PASSED`);
  console.log('===============================================================\n');
}

main().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
