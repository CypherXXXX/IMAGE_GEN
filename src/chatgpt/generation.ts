import { Page } from 'playwright';
import { SELECTORS } from './selectors';
import { getLogger } from '../utils/logger';
import { captureScreenshot } from '../utils/screenshot';

export interface GenerationResult {
  completed: boolean;
  timedOut: boolean;
  error: string;
  durationMs: number;
}

/**
 * Wait for image generation to complete.
 *
 * Two-phase detection:
 *
 * Phase 1 — Response started:
 *   Stop button appears OR new content appears on the page.
 *
 * Phase 2 — Generation finished:
 *   Stop button has been gone for 3+ consecutive seconds
 *   AND the composer textarea is visible (ready for new input).
 *
 * We intentionally DO NOT check message count because ChatGPT's
 * DALL-E image responses may use DOM structures that don't match
 * the `[data-message-author-role="assistant"]` selector.
 */
export async function waitForGeneration(
  page: Page,
  preSubmitMessageCount: number,
  timeoutMs: number = 180_000,
  pollIntervalMs: number = 2_000,
  screenshotsDir: string = ''
): Promise<GenerationResult> {
  const logger = getLogger();
  const startTime = Date.now();

  logger.info('generation', `Waiting for generation (timeout: ${timeoutMs / 1000}s)`);

  // ─── Phase 1: Wait for response to start ───
  let responseStarted = false;
  const responseStartTimeout = 30_000;

  while (Date.now() - startTime < responseStartTimeout) {
    // Check if stop button is visible (generation started)
    const stopVisible = await isElementVisible(page, SELECTORS.COMPOSER.STOP_BUTTON) ||
      await isElementVisible(page, SELECTORS.COMPOSER.STOP_BUTTON_ALT);

    if (stopVisible) {
      responseStarted = true;
      logger.info('generation', 'Response started (stop button visible)');
      break;
    }

    // Fallback: check if submit button is gone (replaced by stop)
    const submitVisible = await isElementVisible(page, SELECTORS.COMPOSER.SUBMIT_BUTTON);
    if (!submitVisible) {
      // Submit button gone = likely generating
      responseStarted = true;
      logger.info('generation', 'Response started (submit button gone)');
      break;
    }

    await page.waitForTimeout(500);
  }

  if (!responseStarted) {
    // Even if we didn't see the stop button, continue to Phase 2
    // (generation might have started and completed very fast)
    logger.warn('generation', 'Did not detect explicit response start — continuing to Phase 2');
  }

  // ─── Phase 2: Wait for generation to finish ───
  //
  // SIMPLE LOGIC:
  //   1. Is the stop button visible? → Still generating, keep waiting
  //   2. Stop button NOT visible? → Start a confirmation countdown
  //   3. Stop button gone for 3+ consecutive seconds? → Check textarea
  //   4. Textarea visible? → DONE! Generation complete.
  //
  // That's it. No message count check. No submit button check.
  //
  const STOP_GONE_CONFIRM_MS = 3000;
  let stopGoneTimestamp = 0;

  while (Date.now() - startTime < timeoutMs) {
    try {
      // Check if stop button is still visible
      const stopVisible = await isElementVisible(page, SELECTORS.COMPOSER.STOP_BUTTON) ||
        await isElementVisible(page, SELECTORS.COMPOSER.STOP_BUTTON_ALT);

      if (stopVisible) {
        // Reset the confirmation timer — generation is still running
        if (stopGoneTimestamp !== 0) {
          logger.info('generation', 'Stop button reappeared — resetting timer');
        }
        stopGoneTimestamp = 0;
        await page.waitForTimeout(pollIntervalMs);
        continue;
      }

      // Stop button is NOT visible
      if (stopGoneTimestamp === 0) {
        stopGoneTimestamp = Date.now();
        logger.info('generation', 'Stop button gone — starting 3s confirmation');
      }

      const goneForMs = Date.now() - stopGoneTimestamp;

      if (goneForMs < STOP_GONE_CONFIRM_MS) {
        // Wait for the confirmation period to elapse
        await page.waitForTimeout(500);
        continue;
      }

      // ─── Stop button has been gone for 3+ seconds ───

      // Check that the composer textarea is visible (ChatGPT is ready for input)
      const textareaVisible = await isElementVisible(page, SELECTORS.COMPOSER.TEXTAREA);

      if (!textareaVisible) {
        // Textarea not visible yet — might still be rendering
        // But don't wait forever; if we've been waiting 10+ seconds with no stop button, just proceed
        if (goneForMs > 10_000) {
          logger.warn('generation', `Textarea not visible but stop button gone for ${(goneForMs / 1000).toFixed(0)}s — declaring complete anyway`);
        } else {
          logger.info('generation', 'Stop button gone 3s+ but textarea not visible yet — waiting');
          await page.waitForTimeout(1000);
          continue;
        }
      }

      // ═══════════════════════════════════════
      // GENERATION COMPLETE!
      // ═══════════════════════════════════════

      // Small settle delay for images to finish rendering
      await page.waitForTimeout(2000);

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.info('generation', `✅ Generation completed in ${elapsed}s`);

      // Quick error check on the response text (non-blocking)
      try {
        const lastText = await getLastAssistantText(page);
        const lower = lastText.toLowerCase();

        // Comprehensive error phrase matching
        const errorPhrases = [
          'content policy',
          "can't create",
          "cannot create",
          'unable to generate',
          "couldn't generate",
          "wasn't able to generate",
          "wasn't able to create",
          "not able to generate",
          "not able to create",
          'error on my side',
          'an error occurred',
          "i can't generate",
          "i cannot generate",
          'failed to generate',
          "i'm unable to",
          "i'm not able to",
          'violates our',
          'against our policy',
          'safety system',
        ];

        const matchedError = errorPhrases.find(phrase => lower.includes(phrase));
        if (matchedError) {
          logger.warn('generation', `ChatGPT error detected ("${matchedError}"): ${lastText.substring(0, 150)}`);
          return {
            completed: false,
            timedOut: false,
            error: `ChatGPT error ("${matchedError}"): ${lastText.substring(0, 200)}`,
            durationMs: Date.now() - startTime,
          };
        }

        // Also check: if there's text but NO image, it might be a refusal
        const hasImage = await checkForImage(page);
        if (!hasImage && lastText.length > 10) {
          logger.warn('generation', `Response has text but no image — possible refusal: ${lastText.substring(0, 150)}`);
          return {
            completed: false,
            timedOut: false,
            error: `No image generated. Response: ${lastText.substring(0, 200)}`,
            durationMs: Date.now() - startTime,
          };
        }
      } catch { /* non-critical */ }

      return {
        completed: true,
        timedOut: false,
        error: '',
        durationMs: Date.now() - startTime,
      };

    } catch (err) {
      logger.info('generation', `Poll error (transient): ${err}`);
    }

    await page.waitForTimeout(pollIntervalMs);
  }

  // ─── TIMEOUT ───
  // But check: has the stop button been gone? Maybe we just failed the textarea check.
  // If stop button is gone, the generation likely DID complete.
  const finalStopVisible = await isElementVisible(page, SELECTORS.COMPOSER.STOP_BUTTON) ||
    await isElementVisible(page, SELECTORS.COMPOSER.STOP_BUTTON_ALT);

  if (!finalStopVisible) {
    logger.warn('generation', 'Timed out but stop button is gone — declaring complete (probable success)');
    return {
      completed: true,
      timedOut: false,
      error: '',
      durationMs: Date.now() - startTime,
    };
  }

  logger.error('generation', `Generation timed out after ${timeoutMs / 1000}s (stop button still visible)`);
  if (screenshotsDir) await captureScreenshot(page, screenshotsDir, 'generation_timeout');
  return {
    completed: false,
    timedOut: true,
    error: `Timed out after ${timeoutMs / 1000}s`,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Count assistant messages.
 */
export async function countAssistantMessages(page: Page): Promise<number> {
  try {
    return await page.locator(SELECTORS.CHAT.ASSISTANT_MESSAGE).count();
  } catch {
    return 0;
  }
}

/**
 * Get text from the last assistant message (best effort).
 * Falls back to searching visible text on the page if the assistant
 * message selector doesn't match (DALL-E uses different DOM structure).
 */
async function getLastAssistantText(page: Page): Promise<string> {
  try {
    // Try the standard assistant message selector first
    const msgs = page.locator(SELECTORS.CHAT.ASSISTANT_MESSAGE);
    const count = await msgs.count();
    if (count > 0) {
      return await msgs.nth(count - 1).textContent() || '';
    }

    // Fallback: search for any text that looks like a response
    // (ChatGPT DALL-E responses may not have the standard role attribute)
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const pageText: string = await page.evaluate(`
      (() => {
        // Find text content after the user message
        var userMsgs = document.querySelectorAll('[data-message-author-role="user"]');
        if (userMsgs.length === 0) return '';
        var lastUser = userMsgs[userMsgs.length - 1];
        
        // Get all text nodes that come after the last user message
        var parent = lastUser.closest('[data-testid]') || lastUser.parentElement;
        if (!parent) return '';
        
        // Look at siblings that come after
        var nextEl = parent.nextElementSibling;
        var texts = [];
        while (nextEl) {
          var t = (nextEl.textContent || '').trim();
          if (t.length > 5) texts.push(t);
          nextEl = nextEl.nextElementSibling;
        }
        return texts.join(' ');
      })()
    `) as string;
    
    return pageText || '';
  } catch {
    return '';
  }
}

/**
 * Check if there's a generated image visible on the page.
 */
async function checkForImage(page: Page): Promise<boolean> {
  try {
    // Check for images in assistant messages
    const imgs = page.locator('[data-message-author-role="assistant"] img[src]');
    const count = await imgs.count();
    if (count > 0) return true;

    // Fallback: check for any large image on the page that's not a reference upload
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const hasLargeImage: boolean = await page.evaluate(`
      (() => {
        var imgs = document.querySelectorAll('img[src]');
        for (var i = 0; i < imgs.length; i++) {
          var img = imgs[i];
          var w = img.naturalWidth || img.width || 0;
          var h = img.naturalHeight || img.height || 0;
          var rect = img.getBoundingClientRect();
          // Generated images are typically displayed large (300+ px wide)
          if ((w > 300 || rect.width > 300) && !img.src.startsWith('blob:')) {
            return true;
          }
        }
        return false;
      })()
    `) as boolean;

    return hasLargeImage;
  } catch {
    return false;
  }
}

/**
 * Check element visibility safely.
 */
async function isElementVisible(page: Page, selector: string): Promise<boolean> {
  try {
    return await page.locator(selector).first().isVisible({ timeout: 500 });
  } catch {
    return false;
  }
}
