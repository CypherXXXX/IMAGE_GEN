import fs from 'fs';
import path from 'path';
import { getLogger } from '../utils/logger';

/**
 * Save image data atomically: write to .tmp, verify, then rename.
 */
export function saveImageAtomic(
  data: Buffer,
  finalPath: string
): boolean {
  const logger = getLogger();
  const dir = path.dirname(finalPath);
  fs.mkdirSync(dir, { recursive: true });

  // Check for existing file — don't overwrite
  if (fs.existsSync(finalPath)) {
    logger.warn('saver', `File already exists, not overwriting: ${finalPath}`);
    return true; // Consider it success since file is already there
  }

  const tmpPath = finalPath + '.tmp';

  try {
    // Write to temp
    fs.writeFileSync(tmpPath, data);

    // Verify temp file
    const stat = fs.statSync(tmpPath);
    if (stat.size === 0) {
      fs.unlinkSync(tmpPath);
      logger.error('saver', 'Temp file is empty, aborting save');
      return false;
    }

    // Rename to final
    fs.renameSync(tmpPath, finalPath);
    logger.info('saver', `Image saved: ${path.basename(finalPath)} (${stat.size} bytes)`);
    return true;
  } catch (err) {
    logger.error('saver', `Failed to save image: ${err}`);
    // Clean up temp file
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
    return false;
  }
}

/**
 * Ensure a file was fully saved by checking its existence and size.
 */
export function confirmFileSaved(filepath: string): boolean {
  if (!fs.existsSync(filepath)) return false;
  const stat = fs.statSync(filepath);
  return stat.size > 0;
}
