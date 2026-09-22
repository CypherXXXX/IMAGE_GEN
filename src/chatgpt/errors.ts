import { Page } from 'playwright';
import { SELECTORS } from './selectors';
import { getLogger } from '../utils/logger';

export type ChatGPTError =
  | 'captcha'
  | 'rate_limit'
  | 'content_policy'
  | 'network_error'
  | 'generation_error'
  | 'unknown_error'
  | 'none';

export interface ErrorDetection {
  errorType: ChatGPTError;
  message: string;
  requiresManualAction: boolean;
}

/**
 * Detect any ChatGPT error state on the page.
 */
export async function detectError(page: Page): Promise<ErrorDetection> {
  const noError: ErrorDetection = { errorType: 'none', message: '', requiresManualAction: false };

  try {
    // Check for CAPTCHA / verification
    if (await isVisible(page, SELECTORS.ERRORS.CAPTCHA_TURNSTILE) ||
      await isVisible(page, SELECTORS.ERRORS.CAPTCHA_FRAME)) {
      return {
        errorType: 'captcha',
        message: 'CAPTCHA/verification detected. Please complete it manually in the browser.',
        requiresManualAction: true,
      };
    }

    // Check page content for common error patterns
    const bodyText = await getPageText(page);

    // Rate limit
    if (bodyText.includes("you've reached") ||
      bodyText.includes('rate limit') ||
      bodyText.includes('too many requests') ||
      bodyText.includes('usage cap') ||
      bodyText.includes('limit reached') ||
      bodyText.includes('try again later') ||
      bodyText.includes('come back in')) {
      return {
        errorType: 'rate_limit',
        message: 'Rate limit or usage cap reached. The queue will pause.',
        requiresManualAction: false,
      };
    }

    // Content policy
    if (bodyText.includes('content policy') ||
      bodyText.includes("can't create that") ||
      bodyText.includes("couldn't generate") ||
      bodyText.includes('against our usage policies') ||
      bodyText.includes('not able to generate')) {
      return {
        errorType: 'content_policy',
        message: 'Content policy restriction detected.',
        requiresManualAction: false,
      };
    }

    // Network error
    if (bodyText.includes('network error') ||
      bodyText.includes('something went wrong') ||
      bodyText.includes('failed to fetch')) {
      return {
        errorType: 'network_error',
        message: 'Network error detected.',
        requiresManualAction: false,
      };
    }

    // Check for error message elements
    if (await isVisible(page, SELECTORS.ERRORS.ERROR_MESSAGE) ||
      await isVisible(page, SELECTORS.ERRORS.GENERIC_ERROR)) {
      const errorText = await page.locator(SELECTORS.ERRORS.ERROR_MESSAGE).first().textContent() || 'Unknown error';
      return {
        errorType: 'generation_error',
        message: errorText,
        requiresManualAction: false,
      };
    }

  } catch (err) {
    getLogger().debug('errors', `Error detection failed: ${err}`);
  }

  return noError;
}

/**
 * Wait for a specific error condition to be resolved.
 * Useful for CAPTCHA — pauses until the user resolves it.
 */
export async function waitForErrorResolution(
  page: Page,
  error: ErrorDetection,
  timeoutMs: number = 300_000
): Promise<boolean> {
  const logger = getLogger();

  if (error.errorType === 'captcha') {
    logger.info('errors', 'Waiting for CAPTCHA resolution...');
    try {
      // Wait for composer to appear (means CAPTCHA was solved)
      await page.waitForSelector(SELECTORS.AUTH.LOGGED_IN_INDICATOR, {
        timeout: timeoutMs,
        state: 'visible',
      });
      logger.info('errors', 'CAPTCHA resolved!');
      return true;
    } catch {
      logger.error('errors', 'CAPTCHA not resolved within timeout');
      return false;
    }
  }

  return false;
}

/**
 * Get visible text from the main content area.
 */
async function getPageText(page: Page): Promise<string> {
  try {
    return (await page.locator('main').first().textContent() || '').toLowerCase();
  } catch {
    try {
      return (await page.locator('body').textContent() || '').toLowerCase();
    } catch {
      return '';
    }
  }
}

/**
 * Safely check element visibility.
 */
async function isVisible(page: Page, selector: string): Promise<boolean> {
  try {
    return await page.locator(selector).first().isVisible({ timeout: 1000 });
  } catch {
    return false;
  }
}
