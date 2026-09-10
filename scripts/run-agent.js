/**
 * CLI Runner for AppleSupport AI Support Agent.
 * 
 * Supports:
 * - Single query: node scripts/run-agent.js "my iphone battery is draining very fast"
 * - Interactive REPL: node scripts/run-agent.js --interactive
 * - Configurable provider: LLM_PROVIDER=gemini | openai | mock
 */

import readline from 'readline';
import { SupportAgent } from '../src/agent/agent.js';

function formatOutput(result, query) {
  console.log('\n===============================================================');
  console.log('APPLESUPPORT AI AGENT EXECUTION RESULT');
  console.log('===============================================================');

  console.log('\nCustomer:');
  console.log(`"${query}"`);

  console.log('\nIntent:');
  console.log(`${result.intent}`);

  console.log('\nConfidence:');
  console.log(`${(result.intentConfidence * 100).toFixed(2)}%`);

  console.log('\nDecision:');
  const decisionBadge = result.decision === 'auto_handle' ? 'AUTO-HANDLE [✓]' : 'ESCALATE [⚠]';
  console.log(`${decisionBadge}`);

  if (result.decision === 'escalate') {
    console.log('\nEscalation Reason:');
    console.log(`${result.escalationReason}`);
  }

  console.log('\nDraft Reply (Public Customer-Facing):');
  console.log(`"${result.reply}"`);

  console.log('\nHistorical Evidence:');
  if (!result.evidence || result.evidence.length === 0) {
    console.log('  (No historical evidence selected)');
  } else {
    result.evidence.forEach((ev, i) => {
      console.log(`  ${i + 1}. [Rank ${ev.rank}] Tweet ID: ${ev.customerTweetId} -> ${ev.supportTweetId} (Score: ${ev.score.toFixed(2)}, Intent: ${ev.intent})`);
    });
  }

  console.log('\nGrounding:');
  console.log(`  Supported by Historical Evidence: ${result.grounding.supportedByHistoricalEvidence}`);
  console.log(`  Summary: ${result.grounding.evidenceSummary}`);

  if (result._internal) {
    console.log('\n--- Developer Diagnostics ---');
    console.log(`  Processing Latency: ${result._internal.latencyMs} ms`);
    if (result._internal.guardrailOverride) {
      console.log(`  Guardrail Override Triggered: ${result._internal.guardrailOverride}`);
    }
    if (result._internal.validation && !result._internal.validation.isValid) {
      console.log(`  Validation Violations: ${result._internal.validation.violations.join('; ')}`);
    }
    if (result._internal.apiError) {
      console.log(`  Note: LLM API returned: ${result._internal.apiError}`);
    }
  }
  console.log('===============================================================\n');
}

async function runInteractive(agent) {
  console.log('\n===============================================================');
  console.log('AppleSupport AI Agent — Interactive Session');
  console.log("Type an inquiry and press Enter. Type 'exit' or 'quit' to exit.");
  console.log('===============================================================\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const promptUser = () => {
    rl.question('Customer Inquiry > ', async (input) => {
      const trimmed = input.trim();
      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        rl.close();
        return;
      }

      if (trimmed.length > 0) {
        try {
          const result = await agent.processInquiry(trimmed);
          formatOutput(result, trimmed);
        } catch (err) {
          console.error(`Error processing inquiry: ${err.message}`);
        }
      }
      promptUser();
    });
  };

  promptUser();
}

async function main() {
  const args = process.argv.slice(2);
  const isInteractive = args.includes('--interactive') || args.includes('-i');
  const providerArg = args.find(a => a.startsWith('--provider='))?.split('=')[1];
  const queryArg = args.filter(a => !a.startsWith('--') && !a.startsWith('-')).join(' ').trim();

  // Create and initialize agent
  const agent = new SupportAgent({
    provider: providerArg || process.env.LLM_PROVIDER
  });
  await agent.initialize();

  if (isInteractive) {
    await runInteractive(agent);
  } else if (queryArg.length > 0) {
    const result = await agent.processInquiry(queryArg);
    formatOutput(result, queryArg);
  } else {
    console.log('Usage:');
    console.log('  Single query:       node scripts/run-agent.js "my iphone battery is draining very fast"');
    console.log('  Interactive session: node scripts/run-agent.js --interactive');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
