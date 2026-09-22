import fs from 'fs';
import path from 'path';
import { getLogger } from '../utils/logger';

/**
 * Watches the downloaded_images/ directory for new image files.
 * Used after clicking the download button in ChatGPT — the image
 * gets downloaded by Chrome to this directory, and we pick it up.
 */

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

/**
 * Snapshot all existing files in the download directory.
 * Call this BEFORE clicking the download button.
 */
export function snapshotDownloadDir(downloadDir: string): Set<string> {
  const snapshot = new Set<string>();
  if (!fs.existsSync(downloadDir)) return snapshot;

  for (const file of fs.readdirSync(downloadDir)) {
    snapshot.add(file);
  }
  return snapshot;
}

/**
 * Wait for a new image file to appear in the download directory.
 * Compares against the pre-click snapshot to detect the new file.
 *
 * Handles Chrome's .crdownload temp files — waits for them to complete.
 */
export async function waitForNewDownload(
  downloadDir: string,
  previousSnapshot: Set<string>,
  timeoutMs: number = 60_000,
  pollIntervalMs: number = 500
): Promise<{ success: boolean; filePath: string; error: string }> {
  const logger = getLogger();
  const startTime = Date.now();

  logger.info('download-watcher', `Watching ${downloadDir} for new file (timeout: ${timeoutMs / 1000}s)`);

  // Ensure directory exists
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  while (Date.now() - startTime < timeoutMs) {
    try {
      const currentFiles = fs.readdirSync(downloadDir);

      // Look for new files that weren't in the snapshot
      for (const file of currentFiles) {
        if (previousSnapshot.has(file)) continue;

        const fullPath = path.join(downloadDir, file);
        const ext = path.extname(file).toLowerCase();

        // Skip Chrome temp download files
        if (ext === '.crdownload' || ext === '.tmp' || ext === '.part') {
          logger.debug('download-watcher', `Temp file detected: ${file} — waiting for completion…`);
          continue;
        }

        // Check if it's an image
        if (!IMAGE_EXTENSIONS.has(ext)) {
          logger.debug('download-watcher', `Non-image file detected: ${file} — skipping`);
          continue;
        }

        // Verify file is complete (not being written to)
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size === 0) {
            logger.debug('download-watcher', `Empty file: ${file} — waiting…`);
            continue;
          }

          // Wait a moment and check if file size is still changing
          await sleep(300);
          const stat2 = fs.statSync(fullPath);
          if (stat2.size !== stat.size) {
            logger.debug('download-watcher', `File still writing: ${file} — waiting…`);
            continue;
          }

          logger.info('download-watcher', `New download detected: ${file} (${stat2.size} bytes)`);
          return { success: true, filePath: fullPath, error: '' };
        } catch {
          // File may have been moved/deleted
          continue;
        }
      }
    } catch (err) {
      logger.debug('download-watcher', `Poll error: ${err}`);
    }

    await sleep(pollIntervalMs);
  }

  logger.error('download-watcher', 'Timed out waiting for download');
  return { success: false, filePath: '', error: `No new download detected within ${timeoutMs / 1000}s` };
}

/**
 * Clear all files from the download directory.
 */
export function clearDownloadDir(downloadDir: string): void {
  const logger = getLogger();
  if (!fs.existsSync(downloadDir)) return;

  const files = fs.readdirSync(downloadDir);
  for (const file of files) {
    try {
      const fullPath = path.join(downloadDir, file);
      if (fs.statSync(fullPath).isFile()) {
        fs.unlinkSync(fullPath);
      }
    } catch (err) {
      logger.debug('download-watcher', `Could not delete ${file}: ${err}`);
    }
  }
  logger.info('download-watcher', `Cleared ${files.length} files from ${downloadDir}`);
}

/**
 * Move all image files from the download directory to a batch-specific archive folder.
 */
export function archiveDownloadedImages(
  downloadDir: string,
  archiveDir: string
): string[] {
  const logger = getLogger();
  const moved: string[] = [];

  if (!fs.existsSync(downloadDir)) return moved;
  fs.mkdirSync(archiveDir, { recursive: true });

  const files = fs.readdirSync(downloadDir);
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) continue;

    try {
      const src = path.join(downloadDir, file);
      const dest = path.join(archiveDir, file);

      if (fs.statSync(src).isFile()) {
        fs.copyFileSync(src, dest);
        fs.unlinkSync(src);
        moved.push(dest);
      }
    } catch (err) {
      logger.debug('download-watcher', `Failed to archive ${file}: ${err}`);
    }
  }

  logger.info('download-watcher', `Archived ${moved.length} images to ${archiveDir}`);
  return moved;
}

/**
 * Get the latest image file in the download directory (by mtime).
 */
export function getLatestDownloadedFile(downloadDir: string): string | null {
  if (!fs.existsSync(downloadDir)) return null;

  let latest: { path: string; mtime: number } | null = null;
  for (const file of fs.readdirSync(downloadDir)) {
    const ext = path.extname(file).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) continue;

    const fullPath = path.join(downloadDir, file);
    try {
      const stat = fs.statSync(fullPath);
      if (!latest || stat.mtimeMs > latest.mtime) {
        latest = { path: fullPath, mtime: stat.mtimeMs };
      }
    } catch { continue; }
  }

  return latest?.path || null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
