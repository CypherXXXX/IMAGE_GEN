import { Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { getLogger } from './logger';

/**
 * Capture a diagnostic screenshot and save it.
 */
export async function captureScreenshot(
  page: Page,
  screenshotsDir: string,
  label: string
): Promise<string> {
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const timestamp = Date.now();
  const filename = `${label}_${timestamp}.png`;
  const filepath = path.join(screenshotsDir, filename);

  try {
    await page.screenshot({ path: filepath, fullPage: false });
    getLogger().debug('screenshot', `Captured: ${filename}`);
    return filepath;
  } catch (err) {
    getLogger().error('screenshot', `Failed to capture screenshot: ${err}`);
    return '';
  }
}

/**
 * Capture a screenshot of a specific element.
 */
export async function captureElementScreenshot(
  page: Page,
  selector: string,
  screenshotsDir: string,
  label: string
): Promise<string> {
  fs.mkdirSync(screenshotsDir, { recursive: true });

  const timestamp = Date.now();
  const filename = `${label}_${timestamp}.png`;
  const filepath = path.join(screenshotsDir, filename);

  try {
    const element = page.locator(selector).first();
    await element.screenshot({ path: filepath });
    getLogger().debug('screenshot', `Captured element: ${filename}`);
    return filepath;
  } catch (err) {
    getLogger().error('screenshot', `Failed to capture element screenshot: ${err}`);
    return '';
  }
}
