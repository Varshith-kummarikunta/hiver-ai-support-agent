import fs from 'fs';
import readline from 'readline';
import path from 'path';
import config from '../src/config/index.js';

console.log('===============================================================');
console.log('PHASE 2B: AppleSupport Intent Discovery (N-gram & Topic Analysis)');
console.log('===============================================================\n');

const pairsPath = path.join(config.processedDataDir, 'applesupport_pairs.jsonl');

if (!fs.existsSync(pairsPath)) {
  console.error(`[BLOCKER] Processed pairs file not found at ${pairsPath}`);
  process.exit(1);
}

// Comprehensive English & Twitter stopwords
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
  'any', 'are', 'arent', 'as', 'at', 'be', 'because', 'been', 'before', 'being',
  'below', 'between', 'both', 'but', 'by', 'cant', 'cannot', 'could', 'couldnt',
  'did', 'didnt', 'do', 'does', 'doesnt', 'doing', 'dont', 'down', 'during',
  'each', 'few', 'for', 'from', 'further', 'had', 'hadnt', 'has', 'hasnt',
  'have', 'havent', 'having', 'he', 'hed', 'hell', 'hes', 'her', 'here',
  'heres', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'hows', 'i',
  'id', 'ill', 'im', 'ive', 'if', 'in', 'into', 'is', 'isnt', 'it', 'its',
  'itself', 'lets', 'me', 'more', 'most', 'mustnt', 'my', 'myself', 'no',
  'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought',
  'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shant', 'she',
  'shed', 'shell', 'shes', 'should', 'shouldnt', 'so', 'some', 'such', 'than',
  'that', 'thats', 'the', 'their', 'theirs', 'them', 'themselves', 'then',
  'there', 'theres', 'these', 'they', 'theyd', 'theyll', 'theyre', 'theyve',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very',
  'was', 'wasnt', 'we', 'wed', 'well', 'were', 'werent', 'what', 'whats',
  'when', 'whens', 'where', 'wheres', 'which', 'while', 'who', 'whos', 'whom',
  'why', 'whys', 'with', 'wont', 'would', 'wouldnt', 'you', 'youd', 'youll',
  'youre', 'youve', 'your', 'yours', 'yourself', 'yourselves',
  // Domain conversational stopwords
  'hi', 'hello', 'hey', 'please', 'pls', 'help', 'thanks', 'thank', 'anyone',
  'someone', 'guys', 'apple', 'applesupport', 'phone', 'iphone', 'device', 'get',
  'got', 'go', 'going', 'know', 'see', 'want', 'like', 'need', 'still', 'even',
  'just', 'now', 'since', 'day', 'days', 'time', 'times', 'one', 'two', 'new',
  'also', 'back', 'way', 'much', 'many', 'good', 'bad', 'fix', 'fixed', 'try',
  'tried', 'trying', 'work', 'working', 'worked', 'works', 'issue', 'issues',
  'problem', 'problems', 'cant', 'wont', 'doesnt'
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t));
}

async function discover() {
  const rl = readline.createInterface({
    input: fs.createReadStream(pairsPath),
    crlfDelay: Infinity
  });

  const unigramFreq = new Map();
  const bigramFreq = new Map();
  let initialInquiriesCount = 0;
  let totalPairsCount = 0;

  console.log('Scanning customer initial inquiries for dominant terms and bigrams...');

  for await (const line of rl) {
    if (!line.trim()) continue;
    totalPairsCount++;
    const pair = JSON.parse(line);

    // Focus intent discovery on root/initial inquiries where customer initiates issue
    if (!pair.isInitialInquiry) continue;
    initialInquiriesCount++;

    const tokens = tokenize(pair.customerTextClean);
    const seenUnigrams = new Set();
    const seenBigrams = new Set();

    for (let i = 0; i < tokens.length; i++) {
      const u = tokens[i];
      if (!seenUnigrams.has(u)) {
        seenUnigrams.add(u);
        unigramFreq.set(u, (unigramFreq.get(u) || 0) + 1);
      }

      if (i < tokens.length - 1) {
        const bg = `${tokens[i]} ${tokens[i + 1]}`;
        if (!seenBigrams.has(bg)) {
          seenBigrams.add(bg);
          bigramFreq.set(bg, (bigramFreq.get(bg) || 0) + 1);
        }
      }
    }
  }

  console.log(`Total pairs examined: ${totalPairsCount.toLocaleString()}`);
  console.log(`Initial customer inquiries analyzed: ${initialInquiriesCount.toLocaleString()}\n`);

  const topUnigrams = Array.from(unigramFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40);

  const topBigrams = Array.from(bigramFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40);

  console.log('--- Top 30 Most Frequent Content Terms (Document Frequency) ---');
  topUnigrams.slice(0, 30).forEach(([term, count], i) => {
    const pct = ((count / initialInquiriesCount) * 100).toFixed(1) + '%';
    console.log(`${String(i + 1).padStart(2)}. ${term.padEnd(16)}: ${count.toLocaleString().padStart(6)} (${pct})`);
  });

  console.log('\n--- Top 30 Most Frequent Bigrams (Document Frequency) ---');
  topBigrams.slice(0, 30).forEach(([bg, count], i) => {
    const pct = ((count / initialInquiriesCount) * 100).toFixed(1) + '%';
    console.log(`${String(i + 1).padStart(2)}. ${bg.padEnd(24)}: ${count.toLocaleString().padStart(6)} (${pct})`);
  });
}

discover().catch(console.error);
