import fs from 'fs';
import path from 'path';
import { ParsedPrompt } from '../queue/types';
import { getLogger } from '../utils/logger';

/**
 * Parse moodboard.md to extract image IDs and naming conventions.
 * Moodboard IDs follow patterns: MB-CHAR-01, MB-ENV-01, MB-PROP-01, MB-DEV-01
 */

/**
 * Parse a moodboard prompt file to extract imageIds from section headers.
 * The moodboard prompts use format: PROMPT 001 with MB-XXX-NN references in the text.
 */
export function parseMoodboardPromptIds(promptText: string): Map<number, string> {
  const idMap = new Map<number, string>();
  const lines = promptText.split('\n');
  
  let currentPromptIndex = 0;
  
  for (const line of lines) {
    const promptMatch = line.match(/^PROMPT\s+(\d+)/i);
    if (promptMatch) {
      currentPromptIndex = parseInt(promptMatch[1], 10);
    }
    
    // Extract MB-XXX-NN references from the prompt text
    if (currentPromptIndex > 0) {
      const mbMatch = line.match(/moodboard\s+\((MB-[A-Z]+-\d+)\)/i);
      if (mbMatch && !idMap.has(currentPromptIndex)) {
        idMap.set(currentPromptIndex, mbMatch[1]);
      }
    }
  }
  
  return idMap;
}

/**
 * Parse images.md format to extract image IDs and REFS.
 * Format:
 * ## IMG-001
 * USE: ...
 * REFS: MB-PROP-01, MB-ENV-01, MB-KEY-01
 * PROMPT: ...
 */
export interface ImageEntry {
  imageId: string;        // e.g. IMG-001
  use: string;            // e.g. STILL, START-FRAME
  refs: string[];         // e.g. ['MB-PROP-01', 'MB-ENV-01']
  shot: string;
  prompt: string;
  negative: string;
}

export function parseImagesDocument(text: string): ImageEntry[] {
  const logger = getLogger();
  const entries: ImageEntry[] = [];
  
  // Split by ## IMG-NNN headers
  const sections = text.split(/^##\s+(IMG-\d+)/gm);
  
  // sections alternates: [preamble, id1, body1, id2, body2, ...]
  for (let i = 1; i < sections.length; i += 2) {
    const imageId = sections[i].trim();
    const body = sections[i + 1] || '';
    
    const entry: ImageEntry = {
      imageId,
      use: '',
      refs: [],
      shot: '',
      prompt: '',
      negative: '',
    };
    
    // Parse fields
    const useMatch = body.match(/^USE:\s*(.+)$/m);
    if (useMatch) entry.use = useMatch[1].trim();
    
    const refsMatch = body.match(/^REFS:\s*(.+)$/m);
    if (refsMatch) {
      entry.refs = refsMatch[1].split(',').map(r => r.trim()).filter(Boolean);
    }
    
    const shotMatch = body.match(/^SHOT:\s*(.+)$/m);
    if (shotMatch) entry.shot = shotMatch[1].trim();
    
    const promptMatch = body.match(/^PROMPT:\s*(.+)$/m);
    if (promptMatch) entry.prompt = promptMatch[1].trim();
    
    const negativeMatch = body.match(/^NEGATIVE:\s*(.+)$/m);
    if (negativeMatch) entry.negative = negativeMatch[1].trim();
    
    entries.push(entry);
  }
  
  logger.info('image-parser', `Parsed ${entries.length} image entries from images.md`);
  return entries;
}

/**
 * Resolve moodboard refs (e.g. MB-PROP-01) to actual file paths in the moodboard images dir.
 */
export function resolveMoodboardRefs(refs: string[], moodboardImagesDir: string): string[] {
  const resolvedPaths: string[] = [];
  
  if (!fs.existsSync(moodboardImagesDir)) return resolvedPaths;
  
  const availableFiles = fs.readdirSync(moodboardImagesDir);
  
  for (const ref of refs) {
    // Look for files matching the ref ID (e.g. MB-PROP-01.png, MB-PROP-01.jpg)
    const match = availableFiles.find(f => {
      const nameWithoutExt = path.parse(f).name;
      return nameWithoutExt.toUpperCase() === ref.toUpperCase();
    });
    
    if (match) {
      resolvedPaths.push(path.join(moodboardImagesDir, match));
    }
  }
  
  return resolvedPaths;
}

/**
 * Read all .md files from a prompts directory and combine them.
 */
export function readPromptsFromFolder(folderPath: string): string {
  if (!fs.existsSync(folderPath)) return '';
  
  const files = fs.readdirSync(folderPath)
    .filter(f => f.endsWith('.md') && !f.startsWith('combined'))
    .sort();
  
  let combined = '';
  for (const file of files) {
    const content = fs.readFileSync(path.join(folderPath, file), 'utf-8');
    combined += content + '\n\n';
  }
  
  return combined;
}

/**
 * Scan an images directory and return found images with their IDs.
 */
export function scanImageDirectory(dirPath: string): { filename: string; imageId: string; absolutePath: string; sizeBytes: number }[] {
  if (!fs.existsSync(dirPath)) return [];
  
  return fs.readdirSync(dirPath)
    .filter(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f))
    .map(filename => {
      const stat = fs.statSync(path.join(dirPath, filename));
      const imageId = path.parse(filename).name;
      return {
        filename,
        imageId,
        absolutePath: path.join(dirPath, filename),
        sizeBytes: stat.size,
      };
    })
    .sort((a, b) => a.filename.localeCompare(b.filename));
}
