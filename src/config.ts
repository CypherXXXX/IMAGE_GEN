import path from 'path';
import fs from 'fs';

export interface AppConfig {
  // Paths
  projectRoot: string;
  referenceImagesDir: string;
  batchesDir: string;
  downloadedImagesDir: string;
  browserProfilesDir: string;
  defaultProfileDir: string;

  // Browser
  browserType: 'chrome-cdp' | 'persistent' | 'cdp';
  cdpEndpoint: string;
  cdpPort: number;
  headless: boolean;
  slowMo: number;

  // ChatGPT
  chatgptUrl: string;
  imagesPerChat: number;
  generationTimeoutMs: number;
  pollIntervalMs: number;
  delayBetweenPromptsMs: number;
  delayAfterSubmitMs: number;

  // Server
  serverPort: number;
  wsPort: number;

  // Downloads
  enableScreenshotFallback: boolean;
  maxRetries: number;
  retryDelayMs: number;
}

const PROJECT_ROOT = path.resolve(__dirname, '..');

export const DEFAULT_CONFIG: AppConfig = {
  projectRoot: PROJECT_ROOT,
  referenceImagesDir: path.join(PROJECT_ROOT, 'reference-images'),
  batchesDir: path.join(PROJECT_ROOT, 'batches'),
  downloadedImagesDir: path.join(PROJECT_ROOT, 'downloaded_images'),
  browserProfilesDir: path.join(PROJECT_ROOT, 'browser-profiles'),
  defaultProfileDir: path.join(PROJECT_ROOT, 'browser-profiles', 'chatgpt-main'),

  browserType: 'chrome-cdp',
  cdpEndpoint: 'http://localhost:9222',
  cdpPort: 9222,
  headless: false,
  slowMo: 50,

  chatgptUrl: 'https://chatgpt.com',
  imagesPerChat: 10,
  generationTimeoutMs: 180_000, // 3 minutes
  pollIntervalMs: 2_000,
  delayBetweenPromptsMs: 5_000,
  delayAfterSubmitMs: 3_000,

  serverPort: 3847,
  wsPort: 3848,

  enableScreenshotFallback: false,
  maxRetries: 2,
  retryDelayMs: 10_000,
};

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const configPath = path.join(PROJECT_ROOT, 'config.json');
  let fileConfig: Partial<AppConfig> = {};

  if (fs.existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {
      console.warn(`Warning: Could not parse config.json: ${e}`);
    }
  }

  const config = { ...DEFAULT_CONFIG, ...fileConfig, ...overrides };

  // Ensure directories exist
  for (const dir of [config.referenceImagesDir, config.batchesDir, config.downloadedImagesDir, config.browserProfilesDir, config.defaultProfileDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  return config;
}

export function saveConfig(config: Partial<AppConfig>): void {
  const configPath = path.join(PROJECT_ROOT, 'config.json');
  const existing = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    : {};
  fs.writeFileSync(configPath, JSON.stringify({ ...existing, ...config }, null, 2));
}
