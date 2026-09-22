import { Page } from 'playwright';
import { SELECTORS } from './selectors';
import { getLogger } from '../utils/logger';

/**
 * Navigate to a new ChatGPT conversation.
 */
export async function startNewChat(page: Page): Promise<void> {
  const logger = getLogger();
  logger.info('navigation', 'Starting new chat...');

  // Try clicking "New chat" in sidebar
  try {
    const newChatBtn = page.locator(SELECTORS.CHAT.NEW_CHAT_BUTTON).first();
    if (await newChatBtn.isVisible({ timeout: 3000 })) {
      await newChatBtn.click();
      await page.waitForTimeout(3000);
      // Wait for composer to appear
      try {
        await page.waitForSelector(SELECTORS.COMPOSER.TEXTAREA, {
          timeout: 15_000,
          state: 'visible',
        });
        logger.info('navigation', 'New chat started via sidebar');
        return;
      } catch {
        logger.debug('navigation', 'Composer not ready after sidebar click, trying URL navigation');
      }
    }
  } catch {
    // Try direct navigation
  }

  // Fallback: navigate to root URL
  logger.info('navigation', 'Navigating directly to chatgpt.com for new chat');
  await page.goto('https://chatgpt.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  });
  await page.waitForTimeout(3000);

  // Verify composer is available — wait up to 30s for the page to fully load
  try {
    await page.waitForSelector(SELECTORS.COMPOSER.TEXTAREA, {
      timeout: 30_000,
      state: 'visible',
    });
    logger.info('navigation', 'New chat ready — composer available');
  } catch {
    logger.warn('navigation', 'Composer not found after navigation — may need manual check');
  }
}

/**
 * Check if the page is currently on a chat with messages.
 */
export async function hasExistingMessages(page: Page): Promise<boolean> {
  try {
    const msgs = await page.locator(SELECTORS.CHAT.ASSISTANT_MESSAGE).count();
    return msgs > 0;
  } catch {
    return false;
  }
}

/**
 * Get the current chat URL (for tracking which chat we're in).
 */
export function getChatUrl(page: Page): string {
  return page.url();
}
