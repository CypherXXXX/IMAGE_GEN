import { Page } from 'playwright';
import { SELECTORS } from './selectors';
import { getLogger } from '../utils/logger';
import path from 'path';

/**
 * Type text into the ChatGPT composer (ProseMirror editor).
 */
export async function typeInComposer(page: Page, text: string): Promise<void> {
  const logger = getLogger();
  logger.debug('composer', `Typing ${text.length} chars into composer`);

  const textarea = page.locator(SELECTORS.COMPOSER.TEXTAREA);

  // Wait longer — a new chat may take time to load the composer
  await textarea.waitFor({ state: 'visible', timeout: 30_000 });

  // Click to focus
  await textarea.click();
  await page.waitForTimeout(500);

  // Clear any existing content
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(300);

  // Try fill() first — Playwright has special ProseMirror support
  try {
    await textarea.fill(text);
    await page.waitForTimeout(500);
    logger.debug('composer', 'Text entered via fill()');
    return;
  } catch (err) {
    logger.debug('composer', `fill() failed: ${err}, falling back to clipboard paste`);
  }

  // Fallback: use direct DOM manipulation in browser context
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    await page.evaluate(`
      (() => {
        const area = document.querySelector('#prompt-textarea');
        if (area) {
          area.focus();
          area.textContent = ${JSON.stringify(text)};
          area.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `);
    await page.waitForTimeout(500);
    logger.debug('composer', 'Text entered via DOM manipulation');
    return;
  } catch (err) {
    logger.debug('composer', `DOM manipulation failed: ${err}, falling back to keyboard type`);
  }

  // Last resort: type character by character (slow but reliable)
  await page.keyboard.type(text, { delay: 5 });
  await page.waitForTimeout(500);
  logger.debug('composer', 'Text entered via keyboard type');
}

/**
 * Upload files (reference images) to ChatGPT.
 * Uses the hidden file input behind the "+" button.
 */
export async function uploadFiles(page: Page, filePaths: string[]): Promise<void> {
  const logger = getLogger();

  if (filePaths.length === 0) {
    logger.debug('composer', 'No files to upload');
    return;
  }

  logger.info('composer', `Uploading ${filePaths.length} file(s)...`);

  // Resolve all paths to absolute
  const absolutePaths = filePaths.map(f => path.resolve(f));

  // Strategy 1: Try to find and use hidden file input directly
  try {
    const fileInput = page.locator(SELECTORS.COMPOSER.FILE_INPUT).first();

    // Check if file input exists (even if hidden)
    const inputCount = await page.locator('input[type="file"]').count();
    if (inputCount > 0) {
      logger.debug('composer', 'Found hidden file input, using setInputFiles');
      await page.locator('input[type="file"]').first().setInputFiles(absolutePaths);
      await page.waitForTimeout(2000); // Wait for upload processing
      logger.info('composer', 'Files uploaded via hidden input');
      return;
    }
  } catch (err) {
    logger.debug('composer', `Hidden input approach failed: ${err}`);
  }

  // Strategy 2: Click the "+" button, then use file chooser
  try {
    logger.debug('composer', 'Trying file chooser via + button');

    // Wait for file chooser when clicking the attachment button
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 10_000 }),
      clickPlusButton(page),
    ]);

    await fileChooser.setFiles(absolutePaths);
    await page.waitForTimeout(2000);
    logger.info('composer', 'Files uploaded via file chooser');
    return;
  } catch (err) {
    logger.debug('composer', `File chooser approach failed: ${err}`);
  }

  // Strategy 3: Click + button, then click "Upload from computer" menu item
  try {
    logger.debug('composer', 'Trying menu-based upload');
    await clickPlusButton(page);
    await page.waitForTimeout(500);

    // Look for upload menu item
    const uploadItem = page.locator('text=Upload').first();
    if (await uploadItem.isVisible({ timeout: 3000 })) {
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser', { timeout: 10_000 }),
        uploadItem.click(),
      ]);
      await fileChooser.setFiles(absolutePaths);
      await page.waitForTimeout(2000);
      logger.info('composer', 'Files uploaded via menu item');
      return;
    }
  } catch (err) {
    logger.warn('composer', `Menu-based upload failed: ${err}`);
  }

  throw new Error('Could not upload files — all strategies failed');
}

/**
 * Click the "+" (attachment) button.
 */
async function clickPlusButton(page: Page): Promise<void> {
  // Try primary selector
  try {
    const btn = page.locator(SELECTORS.COMPOSER.PLUS_BUTTON);
    if (await btn.isVisible({ timeout: 3000 })) {
      await btn.click();
      return;
    }
  } catch { }

  // Try alt selector
  try {
    const btn = page.locator(SELECTORS.COMPOSER.PLUS_BUTTON_ALT);
    if (await btn.isVisible({ timeout: 3000 })) {
      await btn.click();
      return;
    }
  } catch { }

  // Try generic approach
  const plusBtn = page.locator('button').filter({ hasText: '+' }).first();
  await plusBtn.click();
}

/**
 * Submit the current prompt by clicking the send button.
 */
export async function submitPrompt(page: Page): Promise<void> {
  const logger = getLogger();
  logger.info('composer', 'Submitting prompt...');

  // Try primary submit button
  try {
    const btn = page.locator(SELECTORS.COMPOSER.SUBMIT_BUTTON);
    if (await btn.isVisible({ timeout: 3000 })) {
      await btn.click();
      logger.info('composer', 'Prompt submitted via primary button');
      return;
    }
  } catch { }

  // Try alt submit button
  try {
    const btn = page.locator(SELECTORS.COMPOSER.SUBMIT_BUTTON_ALT);
    if (await btn.isVisible({ timeout: 3000 })) {
      await btn.click();
      logger.info('composer', 'Prompt submitted via alt button');
      return;
    }
  } catch { }

  // Fallback: Enter key
  logger.debug('composer', 'Submit button not found, trying Enter key');
  await page.keyboard.press('Enter');
  logger.info('composer', 'Prompt submitted via Enter key');
}

/**
 * Upload files AND type prompt, then submit.
 * This is the main entry point for sending a generation request.
 */
export async function sendGenerationRequest(
  page: Page,
  promptText: string,
  imageFiles: string[] = []
): Promise<void> {
  const logger = getLogger();

  // Upload images first (if any)
  if (imageFiles.length > 0) {
    await uploadFiles(page, imageFiles);
    // Wait for uploads to process and appear in composer
    await page.waitForTimeout(3000);
  }

  // Type the prompt
  await typeInComposer(page, promptText);
  await page.waitForTimeout(500);

  // Submit
  await submitPrompt(page);
  logger.info('composer', 'Generation request sent');
}
