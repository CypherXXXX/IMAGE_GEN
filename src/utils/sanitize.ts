/**
 * Sanitize a string into a safe Windows filename.
 * - Replaces unsafe characters with underscores
 * - Trims to max length
 * - Ensures no reserved Windows names
 */
export function sanitizeFilename(input: string, maxLength: number = 60): string {
  // Remove leading/trailing whitespace
  let safe = input.trim();

  // Convert to lowercase
  safe = safe.toLowerCase();

  // Replace any character that's not alphanumeric, hyphen, underscore, or period
  safe = safe.replace(/[^a-z0-9\-_.]/g, '_');

  // Collapse multiple underscores
  safe = safe.replace(/_+/g, '_');

  // Remove leading/trailing underscores and periods
  safe = safe.replace(/^[_.]+|[_.]+$/g, '');

  // Truncate
  if (safe.length > maxLength) {
    safe = safe.substring(0, maxLength);
    // Don't end on an underscore
    safe = safe.replace(/_+$/, '');
  }

  // Avoid Windows reserved names
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  if (reserved.test(safe)) {
    safe = `_${safe}`;
  }

  // Fallback if empty
  if (!safe) {
    safe = 'unnamed';
  }

  return safe;
}

/**
 * Create a numbered image filename.
 * Example: "001_person_procrastinating.png"
 */
export function makeImageFilename(
  index: number,
  promptTitle: string,
  extension: string = 'png'
): string {
  const num = String(index).padStart(3, '0');
  const name = sanitizeFilename(promptTitle, 40);
  return `${num}_${name}.${extension}`;
}

/**
 * Create a batch folder name with timestamp.
 * Example: "2026-09-16_223900_my-batch"
 */
export function makeBatchFolderName(batchName: string): string {
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // 2026-09-16
  const time = now.toTimeString().split(' ')[0].replace(/:/g, ''); // 223900
  const name = sanitizeFilename(batchName, 30);
  return `${date}_${time}_${name}`;
}

/**
 * Extract a short title from a prompt (first few meaningful words).
 */
export function extractPromptTitle(prompt: string, maxWords: number = 4): string {
  const words = prompt
    .replace(/[\n\r]+/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, maxWords);

  return words.join('_') || 'untitled';
}
