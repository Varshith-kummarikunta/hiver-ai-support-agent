import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import config from '../src/config/index.js';

console.log('==================================================');
console.log('PHASE 1: Inspect Dataset Schema & Sample Records');
console.log('==================================================\n');

const filePath = config.rawdataPath;

if (!fs.existsSync(filePath)) {
  console.error(`[BLOCKER] Dataset file not found at: ${filePath}`);
  console.error(`Please place 'twcs.csv' into ${path.dirname(filePath)} before running this script.`);
  process.exit(1);
}

const stats = fs.statSync(filePath);
console.log(`File: ${filePath}`);
console.log(`Size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB\n`);

let rowCount = 0;
const sampleLimit = 5;
const samples = [];
let detectedColumns = [];

fs.createReadStream(filePath)
  .pipe(csv())
  .on('headers', (headers) => {
    detectedColumns = headers;
    console.log('Detected CSV Columns:');
    headers.forEach((h, i) => console.log(`  [${i + 1}] ${h}`));
    console.log('\nReading sample records...\n');
  })
  .on('data', (row) => {
    rowCount++;
    if (rowCount <= sampleLimit) {
      samples.push(row);
    }
  })
  .on('end', () => {
    console.log(`--- Sample Records (First ${samples.length}) ---`);
    samples.forEach((sample, idx) => {
      console.log(`\n[Record #${idx + 1}]`);
      for (const [key, val] of Object.entries(sample)) {
        console.log(`  ${key}: ${val}`);
      }
    });
    console.log('\nStreaming inspection complete.');
  })
  .on('error', (err) => {
    console.error('Error reading CSV stream:', err);
    process.exit(1);
  });
