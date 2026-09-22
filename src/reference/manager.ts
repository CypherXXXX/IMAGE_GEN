import fs from 'fs';
import path from 'path';
import { ScannedImage } from './scanner';
import { ReferenceImage } from '../queue/types';
import { getLogger } from '../utils/logger';

/**
 * Copy selected reference images into the batch folder.
 */
export function copyReferencesToBatch(
  selectedImages: ScannedImage[],
  batchReferencesDir: string
): ReferenceImage[] {
  const logger = getLogger();
  fs.mkdirSync(batchReferencesDir, { recursive: true });

  const references: ReferenceImage[] = [];

  for (let i = 0; i < selectedImages.length; i++) {
    const img = selectedImages[i];
    const destFilename = `reference_${String(i + 1).padStart(2, '0')}${img.extension}`;
    const destPath = path.join(batchReferencesDir, destFilename);

    fs.copyFileSync(img.absolutePath, destPath);

    references.push({
      originalPath: img.absolutePath,
      batchPath: destPath,
      filename: destFilename,
      sizeBytes: img.sizeBytes,
      order: i + 1,
    });

    logger.info('reference-manager', `Copied: ${img.filename} → ${destFilename}`);
  }

  return references;
}

/**
 * Get the batch-local paths for reference images (for upload to ChatGPT).
 */
export function getReferenceFilePaths(references: ReferenceImage[]): string[] {
  return references
    .sort((a, b) => a.order - b.order)
    .map(r => r.batchPath);
}
