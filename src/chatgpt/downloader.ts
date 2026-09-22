import { Page, Response as PlaywrightResponse } from 'playwright';
import { getLogger } from '../utils/logger';
import path from 'path';
import fs from 'fs';

export interface DownloadResult {
  success: boolean;
  filePath: string;
  fileSize: number;
  error: string;
  strategy: string;
}

/**
 * Image download manager.
 *
 * Uses a priority chain of strategies:
 *
 * 1. NETWORK INTERCEPTION — Listen for image responses from OpenAI's
 *    CDN during generation. The image URL is captured passively with
 *    zero UI interaction. We then download it via HTTP.
 *    → Most reliable, zero button-clicking needed.
 *
 * 2. DIRECT DOM URL EXTRACTION — After generation, read the <img> src
 *    from the last assistant message and fetch via HTTP with cookies.
 *    → Reliable fallback if interception missed the response.
 *
 * 3. HOVER + DOWNLOAD BUTTON — Hover the image and try to click
 *    a download button (aria-label or positional).
 *    → UI-dependent, least reliable.
 */

// ═══════════════════════════════════════════════════════════════
// Network Interceptor — set up BEFORE submitting the prompt
// ═══════════════════════════════════════════════════════════════

interface InterceptedImage {
  url: string;
  contentType: string;
  buffer: Buffer | null;
}

/**
 * Set up a response interceptor that captures DALL-E image URLs
 * and optionally their binary data as they stream in.
 *
 * Call this BEFORE submitting the generation prompt.
 * Returns a handle with .getResult() and .dispose().
 */
export function createImageInterceptor(page: Page): {
  getResult: () => InterceptedImage | null;
  dispose: () => void;
} {
  const logger = getLogger();
  let captured: InterceptedImage | null = null;

  const handler = async (response: PlaywrightResponse) => {
    try {
      const url = response.url();
      const status = response.status();
      const contentType = response.headers()['content-type'] || '';

      // ── STRICT FILTERING — only capture actual DALL-E generated images ──

      // Skip non-200 responses
      if (status !== 200) return;

      // Skip SVGs (favicons, icons, sprites)
      if (contentType.includes('svg') || url.endsWith('.svg')) return;

      // Skip blob: URLs (these are reference image previews, not generated images)
      if (url.startsWith('blob:')) return;

      // Skip CDN assets (favicon, sprites, CSS, JS)
      if (url.includes('/cdn/assets/')) return;

      // Skip non-image content types
      if (!contentType.includes('image/png') &&
        !contentType.includes('image/webp') &&
        !contentType.includes('image/jpeg')) return;

      // ── Match patterns for actual generated images ──

      // Pattern 1: ChatGPT's estuary content API (file storage for generated images)
      //   e.g., https://chatgpt.com/backend-api/estuary/content?id=file_XXXXX...
      const isEstuary = url.includes('backend-api/estuary/content') ||
        url.includes('backend-api/files/');

      // Pattern 2: OpenAI's DALL-E CDN
      const isDalleCdn = url.includes('oaidalleapiprodscus') ||
        url.includes('dall-e');

      // Pattern 3: OpenAI file hosting
      const isFileHost = url.includes('files.oaiusercontent.com');

      if (!isEstuary && !isDalleCdn && !isFileHost) return;

      // Try to grab the binary body
      let buffer: Buffer | null = null;
      try {
        buffer = await response.body();
        // Generated images are typically 100KB+ — skip small thumbnails
        if (buffer.length < 20_000) {
          logger.debug('interceptor', `Skipping small image (${buffer.length} bytes): ${url.substring(0, 80)}`);
          return;
        }
      } catch {
        // Body may not be available — we still have the URL
      }

      logger.info('interceptor', `✅ Captured generated image: ${url.substring(0, 120)} [${contentType}, ${buffer ? buffer.length + ' bytes' : 'no body'}]`);

      // Always keep the LATEST capture (last image response = the generated one)
      captured = { url, contentType, buffer };

    } catch { /* ignore transient errors */ }
  };

  page.on('response', handler);

  return {
    getResult: () => captured,
    dispose: () => {
      page.off('response', handler);
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// Main download function — orchestrates all strategies
// ═══════════════════════════════════════════════════════════════

/**
 * Download the generated image using the best available strategy.
 *
 * @param interceptor - Optional interceptor created before generation.
 *                      If provided, its captured data is tried first.
 */
export async function downloadGeneratedImage(
  page: Page,
  outputPath: string,
  _downloadDir: string,
  interceptor?: { getResult: () => InterceptedImage | null; dispose: () => void },
  _timeoutMs: number = 60_000
): Promise<DownloadResult> {
  const logger = getLogger();

  // ── Strategy 1: Use intercepted image data ──
  if (interceptor) {
    const intercepted = interceptor.getResult();
    interceptor.dispose(); // Always clean up

    if (intercepted) {
      logger.info('downloader', `Strategy 1 (interception): Got image URL [${intercepted.contentType}]`);

      // If we already have the binary body, save directly
      if (intercepted.buffer && intercepted.buffer.length > 10_000) {
        const result = saveBuffer(intercepted.buffer, outputPath, intercepted.contentType);
        if (result.success) {
          logger.info('downloader', `✅ Saved intercepted image: ${path.basename(result.filePath)} (${result.fileSize} bytes)`);
          return result;
        }
      }

      // Otherwise download from the captured URL via HTTP
      const httpResult = await downloadFromUrl(page, intercepted.url, outputPath);
      if (httpResult.success) {
        logger.info('downloader', `✅ Downloaded from intercepted URL: ${path.basename(httpResult.filePath)} (${httpResult.fileSize} bytes)`);
        return httpResult;
      }
      logger.warn('downloader', `Strategy 1 failed to download: ${httpResult.error}`);
    } else {
      logger.info('downloader', 'Strategy 1: No image was intercepted during generation');
    }
  }

  // ── Strategy 2: Extract image URL from DOM ──
  logger.info('downloader', 'Strategy 2 (DOM extraction): Reading img src from last message…');
  const domResult = await strategyDomUrlExtraction(page, outputPath);
  if (domResult.success) {
    logger.info('downloader', `✅ Downloaded via DOM extraction: ${path.basename(domResult.filePath)} (${domResult.fileSize} bytes)`);
    return domResult;
  }
  logger.warn('downloader', `Strategy 2 failed: ${domResult.error}`);

  logger.error('downloader', '❌ All download strategies failed');
  return { success: false, filePath: '', fileSize: 0, error: 'All download strategies failed', strategy: 'none' };
}

// ═══════════════════════════════════════════════════════════════
// Strategy 2: DOM URL Extraction
// ═══════════════════════════════════════════════════════════════

async function strategyDomUrlExtraction(page: Page, outputPath: string): Promise<DownloadResult> {
  const logger = getLogger();
  const fail: DownloadResult = { success: false, filePath: '', fileSize: 0, error: '', strategy: 'dom_extraction' };

  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const imageInfo: { url: string; width: number; height: number } | null = await page.evaluate(`
      (() => {
        const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
        if (messages.length === 0) return null;
        const lastMsg = messages[messages.length - 1];

        // Find all images, skip tiny ones (icons, avatars)
        const imgs = Array.from(lastMsg.querySelectorAll('img[src]'));
        
        // Filter to find the generated image (typically the largest one)
        const candidates = imgs
          .map(function(img) {
            return {
              url: img.src,
              width: img.naturalWidth || img.width || 0,
              height: img.naturalHeight || img.height || 0,
              displayWidth: img.getBoundingClientRect().width,
              displayHeight: img.getBoundingClientRect().height
            };
          })
          .filter(function(i) {
            // Skip tiny images (icons, loading placeholders)
            return (i.width > 100 || i.displayWidth > 100) && i.url && !i.url.startsWith('data:');
          });

        if (candidates.length === 0) return null;

        // Return the last (most recent) candidate
        var best = candidates[candidates.length - 1];
        return { url: best.url, width: best.width, height: best.height };
      })()
    `) as { url: string; width: number; height: number } | null;

    if (!imageInfo) {
      // Debug: log page state
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const debug: string = await page.evaluate(`
        (() => {
          var msgs = document.querySelectorAll('[data-message-author-role="assistant"]');
          var allImgs = document.querySelectorAll('img');
          var imgSrcs = Array.from(allImgs).slice(0, 10).map(function(i) { return i.src.substring(0, 60); });
          return 'AssistantMsgs=' + msgs.length + ' TotalImgs=' + allImgs.length + ' URL=' + location.href + ' Srcs=' + JSON.stringify(imgSrcs);
        })()
      `) as string;
      fail.error = `No image found in DOM. Debug: ${debug}`;
      return fail;
    }

    logger.info('downloader', `DOM extraction: Found image ${imageInfo.width}x${imageInfo.height} — URL: ${imageInfo.url.substring(0, 100)}…`);

    return await downloadFromUrl(page, imageInfo.url, outputPath);

  } catch (err) {
    fail.error = `DOM extraction error: ${err}`;
    return fail;
  }
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Download an image from a URL using the browser context (with cookies).
 */
async function downloadFromUrl(page: Page, imageUrl: string, outputPath: string): Promise<DownloadResult> {
  const logger = getLogger();
  const fail: DownloadResult = { success: false, filePath: '', fileSize: 0, error: '', strategy: 'url_download' };

  try {
    const context = page.context();
    const response = await context.request.get(imageUrl, { timeout: 30_000 });

    if (!response.ok()) {
      fail.error = `HTTP ${response.status()} from ${imageUrl.substring(0, 80)}`;
      return fail;
    }

    const buffer = await response.body();

    if (buffer.length < 1000) {
      fail.error = `Response too small (${buffer.length} bytes)`;
      return fail;
    }

    return saveBuffer(buffer, outputPath, response.headers()['content-type'] || '');

  } catch (err) {
    fail.error = `URL download error: ${err}`;
    logger.debug('downloader', fail.error);
    return fail;
  }
}

/**
 * Save a buffer to the output path with correct extension.
 */
function saveBuffer(buffer: Buffer, outputPath: string, contentType: string): DownloadResult {
  const fail: DownloadResult = { success: false, filePath: '', fileSize: 0, error: '', strategy: 'buffer_save' };

  try {
    // Determine extension from content-type
    let ext = path.extname(outputPath);
    if (!ext || ext === '.') {
      if (contentType.includes('png')) ext = '.png';
      else if (contentType.includes('webp')) ext = '.webp';
      else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';
      else ext = '.png';
    }

    if (!outputPath.endsWith(ext)) {
      const parsed = path.parse(outputPath);
      outputPath = path.join(parsed.dir, parsed.name + ext);
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buffer);

    return {
      success: true,
      filePath: outputPath,
      fileSize: buffer.length,
      error: '',
      strategy: 'buffer_save',
    };
  } catch (err) {
    fail.error = `Save error: ${err}`;
    return fail;
  }
}

/**
 * Save an image buffer to the output directory with the given imageId.
 * This is used to save to SCRIPT_IMAGES or MOODBOARD_IMAGES with proper naming.
 */
export function saveToOutputDir(buffer: Buffer, outputDir: string, imageId: string, contentType: string = 'image/png'): DownloadResult {
  let ext = '.png';
  if (contentType.includes('webp')) ext = '.webp';
  else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';

  const outputPath = path.join(outputDir, `${imageId}${ext}`);
  return saveBuffer(buffer, outputPath, contentType);
}

/**
 * Copy an already-saved image to the output directory with the proper imageId name.
 */
export function copyToOutputDir(srcPath: string, outputDir: string, imageId: string): DownloadResult {
  try {
    const ext = path.extname(srcPath) || '.png';
    const destPath = path.join(outputDir, `${imageId}${ext}`);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.copyFileSync(srcPath, destPath);
    const stat = fs.statSync(destPath);
    return { success: true, filePath: destPath, fileSize: stat.size, error: '', strategy: 'copy' };
  } catch (err) {
    return { success: false, filePath: '', fileSize: 0, error: `Copy error: ${err}`, strategy: 'copy' };
  }
}

