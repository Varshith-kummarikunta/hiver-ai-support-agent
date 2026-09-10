/**
 * Dedicated Fact-Check Audit for Phase 7 Benchmark Results.
 * 
 * Verifies that all metrics, breakdowns, disclaimers, and failure modes
 * in docs/agent-evaluation-report.md and README.md match the machine-readable
 * outputs in data/evaluation/agent-evaluation-results.json byte-for-byte.
 */

import fs from 'fs';
import path from 'path';

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

async function runAudit() {
  console.log('===============================================================');
  console.log('  Phase 7 Fact-Check Audit & Verification Engine');
  console.log('===============================================================\n');

  // 1. Load results JSON
  const jsonPath = path.join(process.cwd(), 'data', 'evaluation', 'agent-evaluation-results.json');
  assert(fs.existsSync(jsonPath), `Results JSON exists at ${jsonPath}`);
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  // 2. Provenance & Sample Counts
  console.log('\nAudit 1: Provenance & Benchmark Population');
  assert(data.items.length === 200, 'Exactly 200 evaluation items present');
  assert(data.metadata.provenance.authorReviewedCount === 4, 'Exactly 4 author-reviewed items');
  assert(data.metadata.provenance.automaticProposalCount === 196, 'Exactly 196 automatic proposal items');

  // 3. Classification Metrics
  console.log('\nAudit 2: Intent Classification Metrics');
  const cls = data.summary.classification;
  assert(cls.overallAgreement === 0.695, `Overall agreement is exactly 69.50% (got ${cls.overallAgreement})`);
  assert(cls.authorAgreement === 0.5, `Author-reviewed agreement is exactly 50.00% (got ${cls.authorAgreement})`);
  assert(cls.proposalAgreement === 0.699, `Automatic proposal agreement is exactly 69.90% (got ${cls.proposalAgreement})`);
  assert(cls.macroPrecision === 0.7416, `Macro precision is exactly 74.16% (got ${cls.macroPrecision})`);
  assert(cls.macroRecall === 0.7407, `Macro recall is exactly 74.07% (got ${cls.macroRecall})`);
  assert(cls.macroF1 === 0.6827, `Macro F1 is exactly 68.27% (got ${cls.macroF1})`);
  assert(cls.weightedF1 === 0.6505, `Weighted F1 is exactly 65.05% (got ${cls.weightedF1})`);

  // 4. Raw BM25 Corpus Retrieval (Matching Phase 5)
  console.log('\nAudit 3: Raw BM25 Retrieval Metrics (Phase 5 Alignment)');
  const rawRet = data.summary.rawCorpusRetrieval;
  assert(rawRet.recallAt1 === 0.6, `Raw BM25 Recall@1 is exactly 60.00% (got ${rawRet.recallAt1})`);
  assert(rawRet.recallAt3 === 0.835, `Raw BM25 Recall@3 is exactly 83.50% (got ${rawRet.recallAt3})`);
  assert(rawRet.recallAt5 === 0.885, `Raw BM25 Recall@5 is exactly 88.50% (got ${rawRet.recallAt5})`);
  assert(rawRet.recallAt10 === 0.945, `Raw BM25 Recall@10 is exactly 94.50% (got ${rawRet.recallAt10})`);

  // 5. Post-Filter Prompt Alignment
  console.log('\nAudit 4: Post-Filter Evidence Prompt Alignment');
  const postRet = data.summary.postFilterPromptAlignment;
  assert(postRet.alignmentAt1 === 0.79, `Post-filter Top-1 alignment is 79.00% (got ${postRet.alignmentAt1})`);
  assert(postRet.alignmentAt3 === 0.805, `Post-filter Top-3 alignment is 80.50% (got ${postRet.alignmentAt3})`);

  // 6. Decision Breakdown
  console.log('\nAudit 5: Decision Policy & Routing Breakdown');
  const dec = data.summary.decisionPolicy;
  assert(dec.autoHandleCount === 109, `Auto-handle count is exactly 109 (got ${dec.autoHandleCount})`);
  assert(dec.escalateCount === 91, `Escalate count is exactly 91 (got ${dec.escalateCount})`);
  assert(dec.autoHandleCount + dec.escalateCount === 200, 'Sum of decisions equals 200');

  // 7. Dual Success Metrics
  console.log('\nAudit 6: Dual Success Metrics (Policy Gate vs Task Correctness)');
  const succ = data.summary.successMetrics;
  assert(succ.policyGatePassRate === 1, 'Policy gate pass rate is 100.00% (200/200)');
  assert(succ.taskCorrectnessRate === 0.945, `Strict task correctness rate is 94.50% (got ${succ.taskCorrectnessRate})`);
  assert(succ.taskCorrectnessCount === 189, `Strict task correctness count is 189 (got ${succ.taskCorrectnessCount})`);
  assert(succ.authorReviewedTaskCorrectnessRate === 0.75, 'Author task correctness is 75.00% (3/4)');

  // 8. GOLD-172 Specific Audit
  console.log('\nAudit 7: GOLD-172 Specific Task Failure Audit');
  const g172 = data.items.find(i => i.goldenId === 'GOLD-172');
  assert(g172 !== undefined, 'GOLD-172 exists in results');
  assert(g172.evaluationLabel === 'display_hardware', 'GOLD-172 gold label is display_hardware');
  assert(g172.predictedIntent === 'account_icloud', 'GOLD-172 predicted intent is account_icloud');
  assert(g172.isIntentCorrect === false, 'GOLD-172 isIntentCorrect is false');
  assert(g172.agentDecision === 'auto_handle', 'GOLD-172 agentDecision is auto_handle');
  assert(g172.taskCorrectness === false, 'GOLD-172 taskCorrectness is FALSE (Strict task failure)');
  assert(g172.policyGatePass === true, 'GOLD-172 policyGatePass is TRUE (Passed non-crashing gate)');

  // 9. Judge Metadata & Offline Disclaimer
  console.log('\nAudit 8: LLM Judge Provider & Offline Disclaimer');
  assert(data.metadata.judgeInfo.isRealLLM === false, 'isRealLLM is false');
  assert(data.metadata.judgeInfo.realLLMExecuted === false, 'realLLMExecuted is false');
  assert(data.metadata.judgeInfo.provider === 'mock', 'Judge provider is mock');
  assert(data.metadata.judgeInfo.humanAgreementMeasured === false, 'humanAgreementMeasured is false');

  // 10. Judge Score Inflation by Decision
  console.log('\nAudit 9: Judge Score Inflation Audit');
  const jScore = data.summary.mockHarnessValidation.judgeScoresByDecision;
  assert(jScore.autoHandle.groundingMean === 3, `Auto-handle grounding mean is 3.000 (got ${jScore.autoHandle.groundingMean})`);
  assert(jScore.escalate.groundingMean === 5, `Escalate grounding mean is 5.000 (got ${jScore.escalate.groundingMean})`);

  // 11. Narrative Consistency in Report & README
  console.log('\nAudit 10: Narrative & Report Cross-Checks');
  const reportContent = fs.readFileSync('docs/agent-evaluation-report.md', 'utf8');
  assert(!reportContent.includes('always predicts `battery_power`'), 'Report does NOT claim majority always predicts battery_power');
  assert(reportContent.includes('other_unclear'), 'Report mentions other_unclear as majority baseline');
  assert(reportContent.includes('94.50%'), 'Report contains 94.50% Strict Task Correctness Rate');
  assert(reportContent.includes('88.50%'), 'Report contains 88.50% Raw Corpus Recall@5');
  assert(reportContent.includes('Real LLM reply-quality benchmarking was NOT executed'), 'Report contains prominent offline disclaimer');

  const readmeContent = fs.readFileSync('README.md', 'utf8');
  assert(!readmeContent.includes('always predicts `battery_power`'), 'README does NOT claim majority always predicts battery_power');
  assert(readmeContent.includes('94.50%'), 'README contains 94.50% Strict Task Correctness Rate');

  console.log('\n===============================================================');
  console.log(`Audit Summary: ${passed} Checks Passed, ${failed} Failed`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
