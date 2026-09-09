import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

export const config = {
  projectRoot,
  rawdataPath: process.env.RAW_DATA_PATH || path.join(projectRoot, 'data/raw/twcs.csv'),
  processedDataDir: process.env.PROCESSED_DATA_DIR || path.join(projectRoot, 'data/processed'),
  goldenSetPath: process.env.GOLDEN_SET_PATH || path.join(projectRoot, 'data/golden/golden_set.csv'),
  llm: {
    provider: process.env.LLM_PROVIDER || 'gemini',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    agentModel: process.env.AGENT_MODEL || 'gemini-2.0-flash',
    judgeModel: process.env.JUDGE_MODEL || 'gemini-2.0-flash',
  }
};

export default config;
