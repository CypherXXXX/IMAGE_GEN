import fs from 'fs';
import path from 'path';
import { makeBatchFolderName } from '../utils/sanitize';
import { getLogger } from '../utils/logger';

export interface BatchFolderPaths {
  root: string;
  references: string;
  styleAnchor: string;
  images: string;
  metadata: string;
  logs: string;
  screenshots: string;
  errors: string;
}

/**
 * Create a new batch folder with the standard structure.
 */
export function createBatchFolder(
  batchesDir: string,
  batchName: string
): BatchFolderPaths {
  const folderName = makeBatchFolderName(batchName);
  const root = path.join(batchesDir, folderName);

  const paths: BatchFolderPaths = {
    root,
    references: path.join(root, 'references'),
    styleAnchor: path.join(root, 'style-anchor'),
    images: path.join(root, 'images'),
    metadata: path.join(root, 'metadata'),
    logs: path.join(root, 'logs'),
    screenshots: path.join(root, 'logs', 'screenshots'),
    errors: path.join(root, 'logs', 'errors'),
  };

  // Create all directories
  for (const dir of Object.values(paths)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  getLogger().info('batch-folder', `Created batch folder: ${root}`);
  return paths;
}

/**
 * Get batch folder paths from an existing batch root.
 */
export function getBatchFolderPaths(root: string): BatchFolderPaths {
  return {
    root,
    references: path.join(root, 'references'),
    styleAnchor: path.join(root, 'style-anchor'),
    images: path.join(root, 'images'),
    metadata: path.join(root, 'metadata'),
    logs: path.join(root, 'logs'),
    screenshots: path.join(root, 'logs', 'screenshots'),
    errors: path.join(root, 'logs', 'errors'),
  };
}

/**
 * List all existing batch folders.
 */
export function listBatchFolders(batchesDir: string): { name: string; path: string; hasProgress: boolean }[] {
  if (!fs.existsSync(batchesDir)) return [];

  return fs.readdirSync(batchesDir)
    .filter(name => {
      const fullPath = path.join(batchesDir, name);
      return fs.statSync(fullPath).isDirectory();
    })
    .map(name => ({
      name,
      path: path.join(batchesDir, name),
      hasProgress: fs.existsSync(path.join(batchesDir, name, 'progress.json')),
    }))
    .sort((a, b) => b.name.localeCompare(a.name)); // Newest first
}
