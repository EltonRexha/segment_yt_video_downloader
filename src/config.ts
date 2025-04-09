import { config } from 'dotenv';
import path from 'path';
import { AppConfig } from './types';

// Load environment variables from .env file
config();

const defaultConfig: AppConfig = {
  concurrency: 2,
  outputDir: path.resolve(process.cwd(), 'output'),
  tempDir: path.resolve(process.cwd(), 'temp'),
  logLevel: 'info',
  devMode: process.env.NODE_ENV === 'development',
};

// Read config from environment variables
const appConfig: AppConfig = {
  concurrency: parseInt(
    process.env.CONCURRENCY || `${defaultConfig.concurrency}`,
    10
  ),
  outputDir: process.env.OUTPUT_DIR || defaultConfig.outputDir,
  tempDir: process.env.TEMP_DIR || defaultConfig.tempDir,
  logLevel: process.env.LOG_LEVEL || defaultConfig.logLevel,
  devMode: process.env.DEV_MODE === 'true' || defaultConfig.devMode,
};

export default appConfig;
