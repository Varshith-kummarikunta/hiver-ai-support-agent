/**
 * Unit & Robustness Test Suite for Baseline Metrics and Classifiers.
 */

import { calculateMetrics } from '../src/baselines/metrics.js';
import { MajorityClassClassifier } from '../src/baselines/majority.js';
import { TfidfVectorizer } from '../src/baselines/tfidf.js';
import { MultinomialNaiveBayesClassifier } from '../src/baselines/naive-bayes.js';

console.log('===============================================================');
console.log('UNIT & ROBUSTNESS TESTS: Baselines and Metrics Engine');
console.log('===============================================================\n');

let passCount = 0;
let totalTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    passCount++;
    console.log(`  [Test ${totalTests}] ${testName} -> PASS ✅`);
  } else {
    console.error(`  [Test ${totalTests}] ${testName} -> FAIL ❌`);
    process.exitCode = 1;
  }
}

// -------------------------------------------------------------
// 1. Metrics Engine Verification
// -------------------------------------------------------------
console.log('1. Metrics Engine Mathematical Correctness:');

// Toy 3-class problem:
// True:  [A, A, B, B, C, C]
// Pred:  [A, B, B, B, C, A]
// Class A: TP=1, FP=1, FN=1, Support=2. Prec=0.5, Rec=0.5, F1=0.5
// Class B: TP=2, FP=1, FN=0, Support=2. Prec=2/3=0.6667, Rec=1.0, F1=0.8
// Class C: TP=1, FP=0, FN=1, Support=2. Prec=1.0, Rec=0.5, F1=0.6667
// Overall accuracy: 4 / 6 = 0.6667
const toyTrue = ['A', 'A', 'B', 'B', 'C', 'C'];
const toyPred = ['A', 'B', 'B', 'B', 'C', 'A'];
const toyResults = calculateMetrics(toyTrue, toyPred, ['A', 'B', 'C']);

assert(toyResults.accuracy === 0.6667, `Overall Accuracy matches expected 0.6667 (Got: ${toyResults.accuracy})`);
assert(toyResults.perClass['A'].precision === 0.5, `Class A Precision: 0.5 (Got: ${toyResults.perClass['A'].precision})`);
assert(toyResults.perClass['B'].recall === 1.0, `Class B Recall: 1.0 (Got: ${toyResults.perClass['B'].recall})`);
assert(toyResults.confusionMatrix.matrix[0][0] === 1, `Confusion matrix cell [A, A] = 1`);
assert(toyResults.confusionMatrix.matrix[0][1] === 1, `Confusion matrix cell [A, B] = 1`);
assert(toyResults.confusionMatrix.matrix[2][0] === 1, `Confusion matrix cell [C, A] = 1`);

// -------------------------------------------------------------
// 2. Majority Class Classifier Verification
// -------------------------------------------------------------
console.log('\n2. Majority Class Classifier:');
const majTraining = [
  { intent: 'other_unclear' },
  { intent: 'other_unclear' },
  { intent: 'other_unclear' },
  { intent: 'battery_power' },
  { intent: 'keyboard_typing' }
];
const majClf = new MajorityClassClassifier();
majClf.fit(majTraining);

assert(majClf.majorityClass === 'other_unclear', `Empirical majority class correctly identified as other_unclear`);
assert(majClf.majorityCount === 3, `Majority count = 3`);
assert(majClf.majorityShare === 0.6, `Majority share = 0.6`);

const majPred = majClf.predict('Any random text or empty');
assert(majPred.intent === 'other_unclear', `Predicts empirical majority class`);

// Serialization test
const majJson = majClf.toJSON();
const majRehydrated = MajorityClassClassifier.fromJSON(majJson);
assert(majRehydrated.majorityClass === 'other_unclear', `MajorityClass serialization roundtrip preserved`);

// -------------------------------------------------------------
// 3. TF-IDF & Naive Bayes Verification
// -------------------------------------------------------------
console.log('\n3. TF-IDF & Naive Bayes Classifier:');
const sampleCorpus = [
  { text: 'My battery is dying fast and phone is overheating', intent: 'battery_power' },
  { text: 'Battery drain is awful after charging', intent: 'battery_power' },
  { text: 'When typing the letter i it changes to question mark', intent: 'keyboard_typing' },
  { text: 'Keyboard lag and predictive text autocorrect bug', intent: 'keyboard_typing' },
  { text: 'I want a refund for unauthorized subscription charge', intent: 'billing_subscriptions' },
  { text: 'Card declined for in-app purchase and billing receipt', intent: 'billing_subscriptions' },
  { text: 'Hello what are your retail store hours today', intent: 'other_unclear' },
  { text: 'Thanks for nothing worst service ever', intent: 'other_unclear' }
];

const nbClf = new MultinomialNaiveBayesClassifier({ alpha: 1.0, classPriorMode: 'uniform' });
nbClf.fit(sampleCorpus);

const testBattery = nbClf.predict('battery keeps dying super fast');
assert(testBattery.intent === 'battery_power', `Predicts battery_power on domain query (Got: ${testBattery.intent})`);

const testTyping = nbClf.predict('autocorrect typing issue');
assert(testTyping.intent === 'keyboard_typing', `Predicts keyboard_typing on domain query (Got: ${testTyping.intent})`);

// -------------------------------------------------------------
// 4. Robustness & Edge Cases
// -------------------------------------------------------------
console.log('\n4. Robustness & Extreme Edge Cases:');

// Empty string
const emptyPred = nbClf.predict('');
assert(typeof emptyPred.intent === 'string' && !isNaN(emptyPred.confidence), 'Empty string handled without throwing');

// Pure punctuation
const punctPred = nbClf.predict('!?!?!?!? ...');
assert(typeof punctPred.intent === 'string', 'Pure punctuation handled cleanly');

// Emoji only
const emojiPred = nbClf.predict('🔥🔥🔥🤷‍♂️💀');
assert(typeof emojiPred.intent === 'string', 'Emoji-only query handled cleanly');

// Completely unseen vocabulary
const oovPred = nbClf.predict('zyxwvutsrqponmlkjihgfedcba');
assert(oovPred.isOutOfVocabulary === true, 'Out-of-vocabulary detected and handled');

// Serialization roundtrip
const nbJson = nbClf.toJSON();
const nbRehydrated = MultinomialNaiveBayesClassifier.fromJSON(nbJson);
const rehydratedPred = nbRehydrated.predict('battery keeps dying super fast');
assert(rehydratedPred.intent === 'battery_power', 'Naive Bayes serialization roundtrip produces identical prediction');

console.log('\n===============================================================');
console.log(`TEST SUMMARY: ${passCount} / ${totalTests} TESTS PASSED`);
console.log('===============================================================');
