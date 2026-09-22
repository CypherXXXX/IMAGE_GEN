import { Page } from 'playwright';
import { SELECTORS } from '../chatgpt/selectors';
import { getLogger } from '../utils/logger';

export interface HealthStatus {
  isLoaded: boolean;
  isLoggedIn: boolean;
  hasCaptcha: boolean;
  hasRateLimit: boolean;
  accountName: string;
  currentUrl: string;
}

/**
 * Check ChatGPT page health — login status, CAPTCHA, rate limits.
 */
export async function checkHealth(page: Page): Promise<HealthStatus> {
  const logger = getLogger();
  const status: HealthStatus = {
    isLoaded: false,
    isLoggedIn: false,
    hasCaptcha: false,
    hasRateLimit: false,
    accountName: '',
    currentUrl: page.url(),
  };

  try {
    // Check if page has basic content
    const title = await page.title();
    status.isLoaded = title.includes('ChatGPT') || page.url().includes('chatgpt.com');

    // Check for CAPTCHA
    status.hasCaptcha = await page.locator(SELECTORS.ERRORS.CAPTCHA_TURNSTILE).count() > 0 ||
      await page.locator(SELECTORS.ERRORS.CAPTCHA_FRAME).count() > 0;

    if (status.hasCaptcha) {
      logger.warn('health', 'CAPTCHA detected — manual verification required');
      return status;
    }

    // Check for login by looking for the composer textarea
    const composerCount = await page.locator(SELECTORS.AUTH.LOGGED_IN_INDICATOR).count();
    status.isLoggedIn = composerCount > 0;

    if (!status.isLoggedIn) {
      // Check if we see login/signup buttons
      const loginBtn = await page.locator(SELECTORS.AUTH.LOGIN_BUTTON).count();
      if (loginBtn > 0) {
        logger.info('health', 'Not logged in — login page detected');
      }
      return status;
    }

    // Try to get account name from sidebar
    try {
      const navButtons = page.locator('nav button');
      const count = await navButtons.count();
      for (let i = 0; i < count; i++) {
        const text = await navButtons.nth(i).textContent();
        if (text && text.length > 1 && !text.includes('New chat') && !text.includes('Search')) {
          status.accountName = text.trim();
          break;
        }
      }
    } catch {
      // Account name extraction is best-effort
    }

    logger.info('health', `Health check OK — logged in as: ${status.accountName || 'unknown'}`);

  } catch (err) {
    logger.error('health', `Health check failed: ${err}`);
  }

  return status;
}

/**
 * Wait until ChatGPT is ready (logged in, no CAPTCHA).
 * If CAPTCHA detected, pauses for manual resolution.
 */
export async function waitUntilReady(
  page: Page,
  timeoutMs: number = 120_000
): Promise<HealthStatus> {
  const logger = getLogger();
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const status = await checkHealth(page);

    if (status.hasCaptcha) {
      logger.warn('health', 'CAPTCHA detected — waiting for manual completion...');
      // Wait for CAPTCHA to disappear and composer to appear
      try {
        await page.waitForSelector(SELECTORS.AUTH.LOGGED_IN_INDICATOR, {
          timeout: 300_000, // 5 minutes for manual CAPTCHA
          state: 'visible',
        });
        continue; // Re-check health after CAPTCHA
      } catch {
        throw new Error('CAPTCHA resolution timed out after 5 minutes');
      }
    }

    if (status.isLoggedIn) {
      return status;
    }

    if (!status.isLoaded) {
      logger.info('health', 'Page not loaded yet, waiting...');
    } else {
      logger.info('health', 'Not logged in yet. Please log in manually in the browser.');
    }

    await page.waitForTimeout(3000);
  }

  throw new Error(`ChatGPT not ready within ${timeoutMs / 1000}s timeout`);
}
