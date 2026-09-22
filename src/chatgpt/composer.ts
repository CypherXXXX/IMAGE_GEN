import { Page } from 'playwright';
import { SELECTORS } from './selectors';
import { getLogger } from '../utils/logger';
import path from 'path';

/**
 * Type text into the ChatGPT composer (ProseMirror editor).
 */
export async function typeInComposer(page: Page, text: string, append: boolean = false): Promise<void> {
  const logger = getLogger();
  logger.debug('composer', `Typing ${text.length} chars into composer (append: ${append})`);

  const textarea = page.locator(SELECTORS.COMPOSER.TEXTAREA);

  // Wait longer — a new chat may take time to load the composer
  await textarea.waitFor({ state: 'visible', timeout: 30_000 });

  // Click to focus
  await textarea.click();
  await page.waitForTimeout(500);

  if (!append) {
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
  } else {
    // Append mode: move cursor to end, then type
    await page.keyboard.press('End');
    await page.keyboard.press('Control+End');
    await page.waitForTimeout(200);

    // Use keyboard type for appending — reliable and doesn't overwrite
    await page.keyboard.type(text, { delay: 3 });
    await page.waitForTimeout(500);
    logger.debug('composer', 'Text appended via keyboard type');
  }
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
 * Attach the skill file (02-gpt-image-generator.md) before every generation.
 * Types "+" then "02" into the composer, waits for the suggestion dropdown,
 * selects the skill file, then adds instruction text.
 *
 * Flow after selection:
 * 1. Hit Spacebar (to confirm/anchor the file reference)
 * 2. Hit Shift+Enter twice (line breaks)
 * 3. Type "Read extensively the skill file then generate the image"
 * 4. Hit Shift+Enter twice (more line breaks before prompt)
 */
export async function attachSkillFile(page: Page): Promise<void> {
  const logger = getLogger();
  logger.info('composer', 'Attaching skill file 02-gpt-image-generator.md...');

  const textarea = page.locator(SELECTORS.COMPOSER.TEXTAREA);
  await textarea.waitFor({ state: 'visible', timeout: 15_000 });

  // Click to focus the composer
  await textarea.click();
  await page.waitForTimeout(300);

  // Type "+" to trigger the attachment/mention menu
  await page.keyboard.type('+', { delay: 100 });
  await page.waitForTimeout(800);

  // Type "02" to filter to the skill file
  await page.keyboard.type('02', { delay: 100 });
  await page.waitForTimeout(1500);

  // Look for the skill file suggestion in the dropdown menu
  let selected = false;

  // Strategy 1: Look for menu item containing "02-gpt-image-generator"
  try {
    const menuItem = page.locator('[role="option"], [role="menuitem"], li').filter({ hasText: '02-gpt-image-generator' }).first();
    if (await menuItem.isVisible({ timeout: 3000 })) {
      await menuItem.click();
      selected = true;
      logger.info('composer', 'Skill file selected via menu item');
    }
  } catch {
    logger.debug('composer', 'Menu item strategy 1 failed');
  }

  // Strategy 2: Look for any visible list item or option containing "02"
  if (!selected) {
    try {
      const item = page.locator('[data-value*="02"], [class*="option"]').filter({ hasText: '02' }).first();
      if (await item.isVisible({ timeout: 2000 })) {
        await item.click();
        selected = true;
        logger.info('composer', 'Skill file selected via data-value');
      }
    } catch {
      logger.debug('composer', 'Menu item strategy 2 failed');
    }
  }

  // Strategy 3: Just press Enter to select the first suggestion
  if (!selected) {
    try {
      await page.waitForTimeout(500);
      await page.keyboard.press('Enter');
      selected = true;
      logger.info('composer', 'Skill file selected via Enter key on first suggestion');
    } catch {
      logger.debug('composer', 'Enter key selection failed');
    }
  }

  await page.waitForTimeout(800);

  if (!selected) {
    logger.warn('composer', 'Could not select skill file — continuing without it');
    // Clear the typed "+02" text
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);
    return;
  }

  // === Post-selection flow to anchor the file reference ===

  // 1. Hit Spacebar to confirm/anchor the file reference
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);

  // 2. Hit Shift+Enter twice to add line breaks
  await page.keyboard.press('Shift+Enter');
  await page.waitForTimeout(100);
  await page.keyboard.press('Shift+Enter');
  await page.waitForTimeout(300);

  // 3. Type the instruction to read the skill file
  await page.keyboard.type('Read extensively the skill file then generate the image', { delay: 10 });
  await page.waitForTimeout(300);

  // 4. Hit Shift+Enter twice more to create space before the prompt
  await page.keyboard.press('Shift+Enter');
  await page.waitForTimeout(100);
  await page.keyboard.press('Shift+Enter');
  await page.waitForTimeout(500);

  logger.info('composer', 'Skill file attached with instruction text');
}

/**
 * Upload files AND type prompt, then submit.
 * This is the main entry point for sending a generation request.
 * 
 * Flow: attach skill file → upload images → type/append prompt → submit
 */
export async function sendGenerationRequest(
  page: Page,
  promptText: string,
  imageFiles: string[] = [],
  useSkillFile: boolean = true
): Promise<void> {
  const logger = getLogger();

  // Step 1: Attach skill file before every generation
  if (useSkillFile) {
    await attachSkillFile(page);
    await page.waitForTimeout(500);
  }

  // Step 2: Upload images (if any)
  if (imageFiles.length > 0) {
    await uploadFiles(page, imageFiles);
    // Wait for uploads to process and appear in composer
    await page.waitForTimeout(3000);
  }

  // Step 3: Type the prompt
  // If skill file was attached, append the prompt (don't clear the composer)
  // Otherwise, type it fresh
  await typeInComposer(page, promptText, useSkillFile);
  await page.waitForTimeout(500);

  // Step 4: Submit
  await submitPrompt(page);
  logger.info('composer', 'Generation request sent');
}

