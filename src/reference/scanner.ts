import fs from 'fs';
import path from 'path';
import { getLogger } from '../utils/logger';

export interface ScannedImage {
  filename: string;
  absolutePath: string;
  sizeBytes: number;
  extension: string;
}

const SUPPORTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);

/**
 * Scan the reference-images folder for supported image files.
 */
export function scanReferenceImages(referenceDir: string): ScannedImage[] {
  const logger = getLogger();

  if (!fs.existsSync(referenceDir)) {
    logger.warn('scanner', `Reference directory does not exist: ${referenceDir}`);
    fs.mkdirSync(referenceDir, { recursive: true });
    return [];
  }

  const files = fs.readdirSync(referenceDir);
  const images: ScannedImage[] = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

    const absolutePath = path.join(referenceDir, file);
    const stat = fs.statSync(absolutePath);

    if (!stat.isFile()) continue;
    if (stat.size === 0) {
      logger.warn('scanner', `Skipping empty file: ${file}`);
      continue;
    }

    images.push({
      filename: file,
      absolutePath,
      sizeBytes: stat.size,
      extension: ext,
    });
  }

  // Sort by filename for consistent ordering
  images.sort((a, b) => a.filename.localeCompare(b.filename));

  logger.info('scanner', `Found ${images.length} reference image(s) in ${referenceDir}`);
  return images;
}

/**
 * Validate that a file is actually an image by checking magic bytes.
 */
export function isValidImageFile(filepath: string): boolean {
  try {
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(filepath, 'r');
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
    // WebP: RIFF....WEBP
    if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return true;
    // GIF: GIF87a or GIF89a
    if (buffer.toString('ascii', 0, 3) === 'GIF') return true;
    // BMP: BM
    if (buffer[0] === 0x42 && buffer[1] === 0x4D) return true;

    return false;
  } catch {
    return false;
  }
}
