import fs from 'fs';
import path from 'path';
import config from '../src/config/index.js';

console.log('==================================================');
console.log('Customer Support on Twitter — Dataset Checker');
console.log('==================================================\n');

const targetPath = config.rawdataPath;
console.log(`Checking target path: ${targetPath}`);

if (fs.existsSync(targetPath)) {
  const stats = fs.statSync(targetPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`[OK] Dataset found!`);
  console.log(`File size: ${sizeMB} MB`);
  process.exit(0);
} else {
  console.error(`[BLOCKER] Dataset not found at: ${targetPath}`);
  console.error(`\nPlease follow these steps to obtain the dataset:`);
  console.error(`1. Download the dataset from Kaggle:`);
  console.error(`   https://www.kaggle.com/datasets/thoughtvector/customer-support-on-twitter`);
  console.error(`2. Extract the archive if zipped.`);
  console.error(`3. Place 'twcs.csv' into:`);
  console.error(`   ${path.resolve(targetPath)}`);
  console.error(`\nSee docs/dataset-acquisition.md for full details.`);
  process.exit(1);
}
