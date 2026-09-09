# Dataset Acquisition Guide: Customer Support on Twitter

This project uses the official Kaggle dataset:
**Customer Support on Twitter** (	houghtvector/customer-support-on-twitter)

## 1. Where to Obtain the Dataset

Download from Kaggle:
- **URL**: https://www.kaggle.com/datasets/thoughtvector/customer-support-on-twitter
- **Filename**: 	wcs.csv (inside customer-support-on-twitter.zip or 	wcs.zip)
- **File size**: ~235 MB compressed, ~700 MB uncompressed (approx 2,811,774 tweets)

## 2. Where to Place the File

Place the extracted 	wcs.csv file into:
`
data/raw/twcs.csv
`

The relative path from the project root is:
./data/raw/twcs.csv

## 3. Verify the Dataset

Run:
`ash
node scripts/check-dataset.js
`
or
`ash
npm run inspect-data
`

Once data/raw/twcs.csv is in place, Phase 1 data analysis can execute immediately.
