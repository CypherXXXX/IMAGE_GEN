import { chromium, BrowserContext, Page, Browser } from 'playwright';
import { AppConfig } from '../config';
import { getLogger } from '../utils/logger';
import fs from 'fs';
import { execSync, spawn } from 'child_process';
import path from 'path';

export type SessionType = 'persistent' | 'cdp' | 'chrome-cdp';

export interface BrowserSession {
  context: BrowserContext;
  page: Page;
  browser?: Browser;
  sessionType: SessionType;
  profilePath: string;
}

/**
 * Launch a Playwright browser session.
 * Supports: 
 *   - 'chrome-cdp': Launch user's real Chrome with CDP (default, recommended)
 *   - 'cdp': Connect to already-running Chrome with CDP
 *   - 'persistent': Playwright's own Chromium with persistent profile
 */
export async function launchBrowser(config: AppConfig): Promise<BrowserSession> {
  const logger = getLogger();

  switch (config.browserType) {
    case 'chrome-cdp':
      return launchChromeCDP(config);
    case 'cdp':
      return connectCDP(config);
    case 'persistent':
      return launchPersistent(config);
    default:
      return launchChromeCDP(config);
  }
}

/**
 * Find the user's Chrome installation.
 */
function findChromePath(): string {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Try 'where' command
  try {
    const result = execSync('where chrome.exe 2>nul', { encoding: 'utf-8' }).trim();
    if (result) return result.split('\n')[0].trim();
  } catch { }

  throw new Error(
    'Chrome not found. Please install Google Chrome or set the path manually in config.'
  );
}

/**
 * Launch the user's real Chrome with a dedicated profile and CDP enabled.
 * This uses the real Chrome binary (not Playwright's Chromium) so the user can see and interact with it.
 */
async function launchChromeCDP(config: AppConfig): Promise<BrowserSession> {
  const logger = getLogger();
  const chromePath = findChromePath();
  const profileDir = config.defaultProfileDir;
  const port = config.cdpPort || 9222;

  logger.info('browser', `Launching Chrome at: ${chromePath}`);
  logger.info('browser', `Profile: ${profileDir}`);
  logger.info('browser', `CDP port: ${port}`);

  // Ensure profile directory exists
  fs.mkdirSync(profileDir, { recursive: true });

  // Check if Chrome is already running on this port
  let alreadyRunning = false;
  try {
    const resp = await fetch(`http://127.0.0.1:${port}/json/version`);
    if (resp.ok) {
      alreadyRunning = true;
      logger.info('browser', 'Chrome already running with CDP — connecting...');
    }
  } catch {
    // Not running — we'll start it
  }

  if (!alreadyRunning) {
    // Launch Chrome as a detached subprocess
    const chromeArgs = [
      `--remote-debugging-port=${port}`,
      `--user-data-dir="${profileDir}"`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-features=IsolateOrigins,site-per-process',
      '--start-maximized',
    ];

    logger.info('browser', `Starting Chrome with args: ${chromeArgs.join(' ')}`);

    const child = spawn(chromePath, chromeArgs.map(arg => arg.replace(/"/g, '')), {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    // Wait for Chrome to start accepting CDP connections
    logger.info('browser', 'Waiting for Chrome to start...');
    let connected = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      try {
        const resp = await fetch(`http://127.0.0.1:${port}/json/version`);
        if (resp.ok) {
          connected = true;
          break;
        }
      } catch {
        // Keep waiting
      }
    }

    if (!connected) {
      throw new Error(`Chrome failed to start with CDP on port ${port} after 30 seconds`);
    }

    logger.info('browser', 'Chrome started with CDP!');
  }

  // Connect Playwright via CDP
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const contexts = browser.contexts();
  let context: BrowserContext;
  let page: Page;

  if (contexts.length > 0) {
    context = contexts[0];
    const pages = context.pages();
    page = pages[0] || await context.newPage();
  } else {
    context = await browser.newContext();
    page = await context.newPage();
  }

  logger.info('browser', 'Connected to Chrome via CDP successfully');

  return {
    context,
    page,
    browser,
    sessionType: 'chrome-cdp',
    profilePath: profileDir,
  };
}

/**
 * Launch with persistent Chromium profile (Playwright's own Chromium).
 * Note: May not show visible window on some systems.
 */
async function launchPersistent(config: AppConfig): Promise<BrowserSession> {
  const logger = getLogger();
  const profileDir = config.defaultProfileDir;

  logger.info('browser', `Launching persistent Chromium profile at: ${profileDir}`);

  // Ensure profile directory exists
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: config.headless,
    slowMo: config.slowMo,
    viewport: { width: 1440, height: 900 },
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });

  const page = context.pages()[0] || await context.newPage();

  logger.info('browser', 'Persistent browser launched successfully');

  return {
    context,
    page,
    sessionType: 'persistent',
    profilePath: profileDir,
  };
}

/**
 * Connect to already-open Chrome via CDP.
 * Chrome must be started with: chrome.exe --remote-debugging-port=9222
 */
async function connectCDP(config: AppConfig): Promise<BrowserSession> {
  const logger = getLogger();

  logger.info('browser', `Connecting to Chrome via CDP at: ${config.cdpEndpoint}`);

  const browser = await chromium.connectOverCDP(config.cdpEndpoint);
  const context = browser.contexts()[0];

  if (!context) {
    throw new Error('No browser context found. Ensure Chrome is open with at least one tab.');
  }

  const page = context.pages()[0] || await context.newPage();

  logger.info('browser', 'Connected to Chrome via CDP successfully');

  return {
    context,
    page,
    browser,
    sessionType: 'cdp',
    profilePath: 'cdp-connected',
  };
}

/**
 * Close the browser session gracefully.
 */
export async function closeBrowser(session: BrowserSession): Promise<void> {
  const logger = getLogger();
  try {
    if (session.sessionType === 'persistent') {
      await session.context.close();
    } else if (session.browser) {
      // For CDP — disconnect, don't close the user's Chrome
      await session.browser.close();
    }
    logger.info('browser', 'Browser session closed');
  } catch (err) {
    logger.warn('browser', `Error closing browser: ${err}`);
  }
}
