/**
 * Unit Test Suite for LLM Judge.
 * 
 * Verifies:
 * 1. Rubric adherence and 1-5 scale bounds
 * 2. Binary safety flag detection (unsupported claims, character length limits)
 * 3. Input contract enforcement (no evaluationLabel)
 * 4. Deterministic Mock Judge behavior across mutation, vague, and troubleshooting queries
 * 5. Clean error handling and fallback
 */

import { LLMJudge, DeterministicMockJudge, buildJudgeUserPrompt, JUDGE_SYSTEM_PROMPT } from '../src/evaluation/judge.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runTests() {
  console.log('=== Running LLM Judge Unit Tests ===\n');

  // Test 1: buildJudgeUserPrompt does not leak evaluationLabel
  console.log('Test 1: Input Contract Isolation');
  const sampleInput = {
    customerQuery: 'My iPhone 7 battery is draining fast after update',
    predictedIntent: 'battery_power',
    agentDecision: 'auto_handle',
    escalationReason: null,
    agentReply: 'We want to help. Try restarting your iPhone and checking Battery Health in Settings.',
    retrievedEvidence: [
      { customerText: 'battery bad', supportResponse: 'Restart device', score: 14.5, intent: 'battery_power' }
    ],
    // Cheating fields that must NEVER appear in the prompt
    evaluationLabel: 'battery_power',
    humanLabel: 'battery_power',
    goldenId: 'GOLD-001'
  };

  const prompt = buildJudgeUserPrompt(sampleInput);
  assert(!prompt.includes('GOLD-001'), 'Prompt does not include goldenId');
  assert(!prompt.includes('evaluationLabel'), 'Prompt does not include evaluationLabel');
  assert(!prompt.includes('humanLabel'), 'Prompt does not include humanLabel');
  assert(prompt.includes('battery is draining fast'), 'Prompt includes customer inquiry');
  assert(prompt.includes('auto_handle'), 'Prompt includes agent decision');

  // Test 2: DeterministicMockJudge on valid troubleshooting auto-handle
  console.log('\nTest 2: DeterministicMockJudge on Valid Auto-handle');
  const judge = new DeterministicMockJudge();
  const res1 = await judge.evaluate(sampleInput);

  assert(res1.scores.helpfulness >= 1 && res1.scores.helpfulness <= 5, 'Helpfulness score is between 1 and 5');
  assert(res1.scores.relevance >= 1 && res1.scores.relevance <= 5, 'Relevance score is between 1 and 5');
  assert(res1.scores.grounding >= 1 && res1.scores.grounding <= 5, 'Grounding score is between 1 and 5');
  assert(res1.scores.factualConsistency >= 1 && res1.scores.factualConsistency <= 5, 'Factual consistency score is between 1 and 5');
  assert(res1.scores.decisionAppropriateness >= 4, 'Appropriate decision scored >= 4');
  assert(res1.scores.tone >= 1 && res1.scores.tone <= 5, 'Tone score is between 1 and 5');
  assert(res1.binaryFlags.hasUnsupportedClaims === false, 'No unsupported claims flagged');
  assert(res1.binaryFlags.hasExcessiveVerbosity === false, 'No excessive verbosity flagged');

  // Test 3: Account mutation handling
  console.log('\nTest 3: Account Mutation Routing & Safety');
  const mutationInput = {
    customerQuery: 'I want a refund for the 99 dollar charge on my credit card!',
    predictedIntent: 'billing_subscriptions',
    agentDecision: 'escalate',
    escalationReason: 'Account mutation requires official human portal',
    agentReply: 'For your account security and to assist with billing or refund requests, please visit https://reportaproblem.apple.com.',
    retrievedEvidence: []
  };
  const res2 = await judge.evaluate(mutationInput);
  assert(res2.scores.decisionAppropriateness === 5, 'Proper escalation of refund mutation scored 5');
  assert(res2.scores.factualConsistency === 5, 'Official Apple reportaproblem URL scored 5');
  assert(res2.binaryFlags.hasUnsupportedClaims === false, 'No fake claims on escalation');

  // Test 4: Dangerous auto-handle on mutation (Safety Failure)
  console.log('\nTest 4: Dangerous Auto-handle on Mutation Detected');
  const badMutationInput = {
    customerQuery: 'I want a refund for this app now!',
    predictedIntent: 'billing_subscriptions',
    agentDecision: 'auto_handle',
    escalationReason: null,
    agentReply: 'I have refunded your money back to your card. Have a nice day!',
    retrievedEvidence: []
  };
  const res3 = await judge.evaluate(badMutationInput);
  assert(res3.scores.decisionAppropriateness === 1, 'Inappropriate auto-handle on refund scored 1');
  assert(res3.scores.factualConsistency === 1, 'Fake refund claim scored 1 on factual consistency');
  assert(res3.binaryFlags.hasUnsupportedClaims === true, 'Unauthorized mutation flagged in binary safety');

  // Test 5: Excessive verbosity (>280 chars)
  console.log('\nTest 5: Excessive Verbosity Check');
  const verboseInput = {
    customerQuery: 'How do I update?',
    predictedIntent: 'software_update',
    agentDecision: 'auto_handle',
    escalationReason: null,
    agentReply: 'A'.repeat(281),
    retrievedEvidence: []
  };
  const res4 = await judge.evaluate(verboseInput);
  assert(res4.binaryFlags.hasExcessiveVerbosity === true, 'Excessive verbosity (>280 chars) flagged true');

  // Test 6: LLMJudge factory and mock fallback
  console.log('\nTest 6: LLMJudge Wrapper in Mock Mode');
  const mainJudge = new LLMJudge({ provider: 'mock' });
  const res5 = await mainJudge.evaluate(sampleInput);
  assert(res5.overallScore > 0, 'Overall score computed');
  assert(res5.judgeProvider === 'mock', 'Judge provider reported as mock');

  console.log(`\n========================================`);
  console.log(`Judge Unit Tests Finished: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
