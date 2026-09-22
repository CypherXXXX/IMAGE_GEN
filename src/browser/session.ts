import { Page } from 'playwright';
import { BrowserSession } from './launcher';
import { getLogger } from '../utils/logger';
import { AppConfig } from '../config';

/**
 * Manages the browser session lifecycle — reconnection, page navigation, state tracking.
 */
export class SessionManager {
  private session: BrowserSession;
  private config: AppConfig;
  private activePage: Page;

  constructor(session: BrowserSession, config: AppConfig) {
    this.session = session;
    this.config = config;
    this.activePage = session.page;
  }

  getPage(): Page {
    return this.activePage;
  }

  getSession(): BrowserSession {
    return this.session;
  }

  /**
   * Navigate to ChatGPT.
   */
  async navigateToChatGPT(): Promise<void> {
    const logger = getLogger();
    logger.info('session', `Navigating to ${this.config.chatgptUrl}`);
    await this.activePage.goto(this.config.chatgptUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    // Wait for page to stabilize
    await this.activePage.waitForTimeout(2000);
  }

  /**
   * Check if the page is still connected and responsive.
   */
  async isPageAlive(): Promise<boolean> {
    try {
      await this.activePage.title();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Attempt to recover a dead page.
   */
  async recoverPage(): Promise<boolean> {
    const logger = getLogger();
    try {
      logger.warn('session', 'Attempting page recovery...');
      // Try to get an existing page
      const pages = this.session.context.pages();
      if (pages.length > 0) {
        this.activePage = pages[0];
        await this.navigateToChatGPT();
        return true;
      }
      // Create a new page
      this.activePage = await this.session.context.newPage();
      await this.navigateToChatGPT();
      return true;
    } catch (err) {
      logger.error('session', `Page recovery failed: ${err}`);
      return false;
    }
  }

  /**
   * Get the current URL.
   */
  async getCurrentUrl(): Promise<string> {
    return this.activePage.url();
  }

  /**
   * Wait for manual user action (e.g., completing CAPTCHA).
   * Returns when the specified element appears or timeout.
   */
  async waitForManualAction(
    waitForSelector: string,
    message: string,
    timeoutMs: number = 300_000
  ): Promise<boolean> {
    const logger = getLogger();
    logger.info('session', `Waiting for manual action: ${message}`);
    try {
      await this.activePage.waitForSelector(waitForSelector, {
        timeout: timeoutMs,
        state: 'visible',
      });
      logger.info('session', 'Manual action completed');
      return true;
    } catch {
      logger.warn('session', 'Manual action timed out');
      return false;
    }
  }
}
