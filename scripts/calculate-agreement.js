import fs from 'fs';
import path from 'path';
import config from '../src/config/index.js';

const agreementPath = path.join(config.projectRoot, 'data/golden/golden-agreement.jsonl');

console.log('===============================================================');
console.log('DOUBLE ANNOTATION: Human Inter-Annotator Agreement (Cohen’s Kappa)');
console.log('===============================================================\n');

if (!fs.existsSync(agreementPath)) {
  console.error(`Agreement file not found at ${agreementPath}`);
  process.exit(1);
}

const lines = fs.readFileSync(agreementPath, 'utf8').split('\n').filter(Boolean);
const records = lines.map(line => JSON.parse(line));

const total = records.length;
const fullyAnnotated = records.filter(r => r.annotatorA && r.annotatorB);

console.log(`Total Double-Annotation Sample: ${total} records`);
console.log(`Completed Double-Annotations: ${fullyAnnotated.length} / ${total}\n`);

if (fullyAnnotated.length < total) {
  console.log('STATUS:');
  console.log('  Human annotation completion: NOT YET COMPLETED');
  console.log('  Human agreement:             NOT YET MEASURED (pending second annotator)');
  console.log('  Cohen’s kappa:               NOT YET MEASURED (pending second annotator)\n');
  console.log('Run `node scripts/annotate-golden.js <annotator_name>` to record labels.');
  process.exit(0);
}

// Calculate Cohen's Kappa once annotations are complete
const labels = Array.from(new Set(fullyAnnotated.flatMap(r => [r.annotatorA, r.annotatorB]))).sort();
const N = fullyAnnotated.length;

let agreements = 0;
const countsA = {};
const countsB = {};
labels.forEach(l => {
  countsA[l] = 0;
  countsB[l] = 0;
});

fullyAnnotated.forEach(r => {
  if (r.annotatorA === r.annotatorB) agreements++;
  countsA[r.annotatorA]++;
  countsB[r.annotatorB]++;
});

const Po = agreements / N;
let Pe = 0;
labels.forEach(l => {
  Pe += (countsA[l] / N) * (countsB[l] / N);
});

const kappa = Pe === 1 ? 1 : (Po - Pe) / (1 - Pe);

console.log('===============================================================');
console.log('MEASURED AGREEMENT RESULTS');
console.log('===============================================================');
console.log(`Evaluated Sample Size: ${N}`);
console.log(`Raw Agreement:         ${agreements} / ${N} (${(Po * 100).toFixed(2)}%)`);
console.log(`Chance Agreement (Pe): ${(Pe * 100).toFixed(2)}%`);
console.log(`Cohen’s Kappa (κ):     ${kappa.toFixed(4)}`);
