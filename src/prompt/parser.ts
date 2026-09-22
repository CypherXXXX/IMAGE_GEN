import { ParsedPrompt } from '../queue/types';
import { extractPromptTitle } from '../utils/sanitize';
import { getLogger } from '../utils/logger';

/**
 * Parse a prompt document into individual prompts.
 *
 * Supports multiple delimiter styles:
 * - "PROMPT 001" / "PROMPT 1" headers
 * - "---" separators
 * - Numbered lines "1." / "1)"
 * - Double newline separation (fallback)
 */
export function parsePromptDocument(text: string): ParsedPrompt[] {
  const logger = getLogger();
  const trimmed = text.trim();

  if (!trimmed) {
    logger.warn('parser', 'Empty prompt document');
    return [];
  }

  // Try pattern: "PROMPT 001" / "PROMPT 1" headers
  const headerPattern = /^PROMPT\s+(\d+)/gim;
  if (headerPattern.test(trimmed)) {
    return parseByHeaders(trimmed);
  }

  // Try pattern: "---" separators
  if (trimmed.includes('\n---\n') || trimmed.includes('\n---')) {
    return parseBySeparators(trimmed, /\n-{3,}\n?/);
  }

  // Try pattern: numbered lines "1." or "1)"
  const numberedPattern = /^\d+[.)]\s/m;
  if (numberedPattern.test(trimmed)) {
    return parseByNumbered(trimmed);
  }

  // Fallback: double newline separation
  return parseByDoubleNewline(trimmed);
}

/**
 * Parse using "PROMPT N" headers.
 */
function parseByHeaders(text: string): ParsedPrompt[] {
  const sections = text.split(/^PROMPT\s+\d+\s*/gim);
  const headers = text.match(/^PROMPT\s+(\d+)/gim) || [];
  const prompts: ParsedPrompt[] = [];

  for (let i = 0; i < headers.length; i++) {
    const body = (sections[i + 1] || '').trim();
    if (!body) continue;

    const index = i + 1;
    prompts.push({
      index,
      title: extractPromptTitle(body),
      originalText: body,
    });
  }

  getLogger().info('parser', `Parsed ${prompts.length} prompts via PROMPT headers`);
  return prompts;
}

/**
 * Parse using separator lines (e.g., "---").
 */
function parseBySeparators(text: string, separator: RegExp): ParsedPrompt[] {
  const sections = text.split(separator).map(s => s.trim()).filter(Boolean);
  const prompts: ParsedPrompt[] = [];

  for (let i = 0; i < sections.length; i++) {
    const body = sections[i];

    // Skip if it looks like a header-only line
    if (body.length < 10) continue;

    // Remove any "PROMPT N" prefix if present
    const cleaned = body.replace(/^PROMPT\s+\d+\s*/i, '').trim();
    if (!cleaned) continue;

    prompts.push({
      index: prompts.length + 1,
      title: extractPromptTitle(cleaned),
      originalText: cleaned,
    });
  }

  getLogger().info('parser', `Parsed ${prompts.length} prompts via separators`);
  return prompts;
}

/**
 * Parse numbered prompts (1. or 1)).
 */
function parseByNumbered(text: string): ParsedPrompt[] {
  const lines = text.split('\n');
  const prompts: ParsedPrompt[] = [];
  let currentPrompt = '';

  for (const line of lines) {
    const match = line.match(/^(\d+)[.)]\s+(.*)/);
    if (match) {
      // Save previous prompt
      if (currentPrompt.trim()) {
        prompts.push({
          index: prompts.length + 1,
          title: extractPromptTitle(currentPrompt),
          originalText: currentPrompt.trim(),
        });
      }
      currentPrompt = match[2];
    } else {
      currentPrompt += '\n' + line;
    }
  }

  // Save last prompt
  if (currentPrompt.trim()) {
    prompts.push({
      index: prompts.length + 1,
      title: extractPromptTitle(currentPrompt),
      originalText: currentPrompt.trim(),
    });
  }

  getLogger().info('parser', `Parsed ${prompts.length} prompts via numbering`);
  return prompts;
}

/**
 * Parse by double newlines (paragraphs).
 */
function parseByDoubleNewline(text: string): ParsedPrompt[] {
  const sections = text.split(/\n\s*\n/).map(s => s.trim()).filter(s => s.length > 10);
  const prompts: ParsedPrompt[] = [];

  for (let i = 0; i < sections.length; i++) {
    prompts.push({
      index: i + 1,
      title: extractPromptTitle(sections[i]),
      originalText: sections[i],
    });
  }

  getLogger().info('parser', `Parsed ${prompts.length} prompts via double-newline`);
  return prompts;
}

/**
 * Validate parsed prompts.
 */
export function validatePrompts(prompts: ParsedPrompt[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (prompts.length === 0) {
    errors.push('No prompts found in the document');
  }

  for (const p of prompts) {
    if (!p.originalText || p.originalText.trim().length < 5) {
      errors.push(`Prompt ${p.index}: Too short or empty`);
    }
    if (p.originalText.length > 10000) {
      errors.push(`Prompt ${p.index}: Exceeds 10,000 characters`);
    }
  }

  return { valid: errors.length === 0, errors };
}
