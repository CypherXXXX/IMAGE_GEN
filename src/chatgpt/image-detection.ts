import { Page } from 'playwright';
import { SELECTORS } from './selectors';
import { getLogger } from '../utils/logger';

export interface DetectedImage {
  src: string;
  alt: string;
  index: number;        // Index within the message
  messageIndex: number;  // Which assistant message it's in
  isNew: boolean;        // Whether it appeared after our last snapshot
}

/**
 * Snapshot all existing image sources in the chat.
 * Call this BEFORE submitting a prompt.
 */
export async function snapshotExistingImages(page: Page): Promise<Set<string>> {
  const logger = getLogger();
  const snapshot = new Set<string>();

  try {
    const images = page.locator(`${SELECTORS.CHAT.ASSISTANT_MESSAGE} img[src]`);
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      const src = await images.nth(i).getAttribute('src');
      if (src) {
        snapshot.add(src);
      }
    }

    logger.debug('image-detection', `Snapshotted ${snapshot.size} existing images`);
  } catch (err) {
    logger.debug('image-detection', `Snapshot error: ${err}`);
  }

  return snapshot;
}

/**
 * Detect the newly generated image(s) by comparing against the pre-submission snapshot.
 * Returns the new image(s) that appeared after the prompt was sent.
 */
export async function detectNewImages(
  page: Page,
  previousSnapshot: Set<string>
): Promise<DetectedImage[]> {
  const logger = getLogger();
  const newImages: DetectedImage[] = [];

  try {
    const assistantMsgs = page.locator(SELECTORS.CHAT.ASSISTANT_MESSAGE);
    const msgCount = await assistantMsgs.count();

    for (let mi = 0; mi < msgCount; mi++) {
      const msg = assistantMsgs.nth(mi);
      const images = msg.locator('img[src]');
      const imgCount = await images.count();

      for (let ii = 0; ii < imgCount; ii++) {
        const src = await images.nth(ii).getAttribute('src') || '';
        const alt = await images.nth(ii).getAttribute('alt') || '';

        if (src && !previousSnapshot.has(src)) {
          newImages.push({
            src,
            alt,
            index: ii,
            messageIndex: mi,
            isNew: true,
          });
        }
      }
    }

    logger.info('image-detection', `Detected ${newImages.length} new image(s)`);
  } catch (err) {
    logger.error('image-detection', `Detection error: ${err}`);
  }

  return newImages;
}

/**
 * Get the latest generated image (the one just created).
 * This should be the last new image in the last assistant message.
 */
export async function getLatestGeneratedImage(
  page: Page,
  previousSnapshot: Set<string>
): Promise<DetectedImage | null> {
  const newImages = await detectNewImages(page, previousSnapshot);

  if (newImages.length === 0) {
    getLogger().warn('image-detection', 'No new images detected');
    return null;
  }

  // Return the last new image (most recently generated)
  return newImages[newImages.length - 1];
}

/**
 * Validate that a detected image URL looks genuine and not a placeholder.
 */
export function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('data:')) return false; // Data URI (placeholder)
  if (url.includes('loading') || url.includes('spinner')) return false;
  if (!url.startsWith('http') && !url.startsWith('blob:')) return false;

  return true;
}

/**
 * Extract the full-resolution image URL from the detected image.
 * ChatGPT may serve preview images that differ from the download URL.
 */
export async function extractFullResolutionUrl(
  page: Page,
  detectedImage: DetectedImage
): Promise<string> {
  const logger = getLogger();

  // The src from the preview might be sufficient
  // But we can also try to get the URL from the download link
  try {
    // Click the image to open lightbox/fullscreen
    const assistantMsgs = page.locator(SELECTORS.CHAT.ASSISTANT_MESSAGE);
    const msg = assistantMsgs.nth(detectedImage.messageIndex);
    const imgElement = msg.locator('img[src]').nth(detectedImage.index);

    // Check for a parent link with download attribute
    const parentLink = imgElement.locator('xpath=ancestor::a[@download]');
    if (await parentLink.count() > 0) {
      const href = await parentLink.getAttribute('href');
      if (href) {
        logger.debug('image-detection', `Found download link: ${href}`);
        return href;
      }
    }
  } catch (err) {
    logger.debug('image-detection', `Full resolution URL extraction failed: ${err}`);
  }

  // Fallback to the detected src
  return detectedImage.src;
}
