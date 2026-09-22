import fs from 'fs';
import { getLogger } from '../utils/logger';

/**
 * Verify a downloaded image file is valid.
 */
export interface VerificationResult {
  valid: boolean;
  fileSize: number;
  format: string;
  errors: string[];
}

/**
 * Verify that a downloaded file is a real image.
 */
export function verifyImageFile(filepath: string): VerificationResult {
  const logger = getLogger();
  const result: VerificationResult = {
    valid: false,
    fileSize: 0,
    format: '',
    errors: [],
  };

  // Check file exists
  if (!fs.existsSync(filepath)) {
    result.errors.push('File does not exist');
    return result;
  }

  // Check file size
  const stat = fs.statSync(filepath);
  result.fileSize = stat.size;

  if (stat.size === 0) {
    result.errors.push('File is empty (0 bytes)');
    return result;
  }

  if (stat.size < 1000) {
    result.errors.push(`File suspiciously small: ${stat.size} bytes`);
  }

  // Check magic bytes
  const buffer = Buffer.alloc(16);
  const fd = fs.openSync(filepath, 'r');
  fs.readSync(fd, buffer, 0, 16, 0);
  fs.closeSync(fd);

  // Check for HTML (error page)
  const head = buffer.toString('utf-8', 0, 16).toLowerCase();
  if (head.includes('<!doctype') || head.includes('<html') || head.includes('<!doc')) {
    result.errors.push('File is an HTML page, not an image');
    return result;
  }

  // Detect format from magic bytes
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    result.format = 'png';
  }
  // JPEG: FF D8 FF
  else if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    result.format = 'jpeg';
  }
  // WebP: RIFF....WEBP
  else if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    result.format = 'webp';
  }
  // GIF: GIF87a or GIF89a
  else if (buffer.toString('ascii', 0, 3) === 'GIF') {
    result.format = 'gif';
  }
  // BMP: BM
  else if (buffer[0] === 0x42 && buffer[1] === 0x4D) {
    result.format = 'bmp';
  }
  else {
    result.errors.push('Unrecognized image format (magic bytes do not match known image types)');
    return result;
  }

  // All checks passed
  if (result.errors.length === 0) {
    result.valid = true;
    logger.debug('verifier', `Image verified: ${result.format}, ${result.fileSize} bytes`);
  }

  return result;
}
