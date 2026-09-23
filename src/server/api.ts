import { Express, Request, Response } from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import { BatchOrchestrator } from '../batch/orchestrator';
import { listBatchFolders } from '../batch/folder';
import { scanReferenceImages } from '../reference/scanner';
import { scanImageDirectory, readPromptsFromFolder } from '../prompt/image-name-parser';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Set up REST API routes.
 */
export function setupApiRoutes(app: Express, orchestrator: BatchOrchestrator): void {

  // Multer config for ZIP uploads
  const upload = multer({ dest: path.join(os.tmpdir(), 'image-gen-uploads') });

  // ─── Reference Images ───
  app.get('/api/references', (req: Request, res: Response) => {
    try {
      const images = scanReferenceImages(orchestrator.getConfig().referenceImagesDir);
      res.json({ images });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Parse Prompts ───
  app.post('/api/parse-prompts', (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      const result = orchestrator.parsePrompts(text);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Setup Batch ───
  app.post('/api/batch/setup', async (req: Request, res: Response) => {
    try {
      const { batchName, batchType, promptsText, referenceImagePaths, browserType, outputDir } = req.body;
      const result = await orchestrator.setupBatch({
        batchName,
        batchType: batchType || 'script',
        promptsText,
        referenceImagePaths: referenceImagePaths || [],
        browserType: browserType || 'persistent',
        outputDir: outputDir || undefined,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Launch Browser ───
  app.post('/api/batch/launch-browser', async (req: Request, res: Response) => {
    try {
      const result = await orchestrator.launchBrowser();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Start Batch ───
  app.post('/api/batch/start', async (req: Request, res: Response) => {
    try {
      res.json({ status: 'started' });
      // Run in background — this auto-launches browser via ensureBrowserReady()
      orchestrator.runBatch().catch((err) => {
        console.error('Batch failed:', err);
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Resume Batch ───
  app.post('/api/batch/resume', async (req: Request, res: Response) => {
    try {
      const { batchFolder } = req.body;
      if (batchFolder) {
        await orchestrator.resumeBatch(batchFolder);
        await orchestrator.launchBrowser();
      }
      // If no batchFolder, just resume the current queue
      const queue = orchestrator.getQueue();
      if (queue) {
        queue.resume();
      }
      res.json({ status: 'resumed' });
      orchestrator.runBatch().catch((err) => {
        console.error('Batch resume failed:', err);
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Pause Batch ───
  app.post('/api/batch/pause', (req: Request, res: Response) => {
    orchestrator.pause();
    res.json({ status: 'paused' });
  });

  // ─── Cancel Batch ───
  app.post('/api/batch/cancel', (req: Request, res: Response) => {
    orchestrator.cancel();
    res.json({ status: 'cancelled' });
  });

  // ─── Submit Review ───
  app.post('/api/review', (req: Request, res: Response) => {
    try {
      const { approved, revisionInstructions } = req.body;
      orchestrator.submitReview({
        approved: approved === true,
        revisionInstructions: revisionInstructions || '',
      });
      res.json({ status: 'reviewed' });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Get Progress ───
  app.get('/api/batch/progress', (req: Request, res: Response) => {
    try {
      const queue = orchestrator.getQueue();
      if (!queue) {
        res.json({ progress: null });
        return;
      }
      res.json({ progress: queue.getProgress() });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Get Style Bible ───
  app.get('/api/style-bible', (req: Request, res: Response) => {
    try {
      const anchor = orchestrator.getStyleAnchor();
      res.json({
        locked: anchor.isLocked(),
        bible: anchor.getBible(),
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── List Batches (Gallery) — with accurate status ───
  app.get('/api/batches', (req: Request, res: Response) => {
    try {
      const batches = listBatchFolders(orchestrator.getConfig().batchesDir);
      const isRunning = orchestrator.getIsRunning();
      const currentQueue = orchestrator.getQueue();
      const currentBatchFolder = currentQueue ? currentQueue.getProgress().batchFolder : '';

      const batchInfo = batches.map(b => {
        let progress = null;
        if (b.hasProgress) {
          try {
            progress = JSON.parse(fs.readFileSync(path.join(b.path, 'progress.json'), 'utf-8'));
            // Fix inaccurate "running" status on stale batches
            if (progress.state === 'running') {
              // Only the currently active batch can be "running"
              const isThisBatchActive = isRunning && b.path === currentBatchFolder;
              if (!isThisBatchActive) {
                progress.state = 'interrupted';
              }
            }
          } catch {}
        }
        return { ...b, progress };
      });
      res.json({ batches: batchInfo });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Get Batch Images (Gallery) ───
  app.get('/api/batch/:name/images', (req: Request, res: Response) => {
    try {
      const batchName = req.params.name;
      const batchDir = path.join(orchestrator.getConfig().batchesDir, batchName);
      const imagesDir = path.join(batchDir, 'images');

      if (!fs.existsSync(imagesDir)) {
        res.json({ images: [] });
        return;
      }

      const images = fs.readdirSync(imagesDir)
        .filter(f => /\.(png|jpg|jpeg|webp|gif)$/i.test(f))
        .map(filename => {
          const stat = fs.statSync(path.join(imagesDir, filename));
          return {
            filename,
            url: `/batches/${batchName}/images/${filename}`,
            sizeBytes: stat.size,
            createdAt: stat.mtime.toISOString(),
          };
        })
        .sort((a, b) => a.filename.localeCompare(b.filename));

      res.json({ images });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Download a specific batch image ───
  app.get('/api/batch/:name/images/:filename/download', (req: Request, res: Response) => {
    try {
      const { name, filename } = req.params;
      const imagePath = path.join(orchestrator.getConfig().batchesDir, name, 'images', filename);
      
      if (!fs.existsSync(imagePath)) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }

      // Get the imageId from the batch progress if available
      let downloadFilename = filename;
      try {
        const progressPath = path.join(orchestrator.getConfig().batchesDir, name, 'progress.json');
        if (fs.existsSync(progressPath)) {
          const progress = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
          const job = (progress.jobs || []).find((j: any) => j.imageFilename === filename);
          if (job && job.imageId) {
            const ext = path.extname(filename);
            downloadFilename = `${job.imageId}${ext}`;
          }
        }
      } catch {}

      res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
      res.sendFile(path.resolve(imagePath));
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Retry Job (actually re-generates) ───
  app.post('/api/batch/retry', async (req: Request, res: Response) => {
    try {
      const { promptIndex } = req.body;
      res.json({ status: 'retry_started' });
      // Run retry in background
      orchestrator.retryFailedJob(promptIndex).catch((err) => {
        console.error(`Retry of prompt ${promptIndex} failed:`, err);
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Regenerate Job (works on completed, failed, any state) ───
  app.post('/api/batch/regenerate', async (req: Request, res: Response) => {
    try {
      const { promptIndex } = req.body;
      res.json({ status: 'regenerate_started' });
      // Run regeneration in background
      orchestrator.regenerateJob(promptIndex).catch((err) => {
        console.error(`Regeneration of prompt ${promptIndex} failed:`, err);
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Skip Job ───
  app.post('/api/batch/skip', (req: Request, res: Response) => {
    try {
      const { promptIndex } = req.body;
      orchestrator.getQueue().skipJob(promptIndex);
      res.json({ status: 'skipped' });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Scan Moodboard Images ───
  app.get('/api/moodboard-images', (req: Request, res: Response) => {
    try {
      const images = scanImageDirectory(orchestrator.getConfig().moodboardImagesDir);
      res.json({ images });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Scan Script Images ───
  app.get('/api/script-images', (req: Request, res: Response) => {
    try {
      const images = scanImageDirectory(orchestrator.getConfig().scriptImagesDir);
      res.json({ images });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Read Moodboard Prompts from folder ───
  app.get('/api/moodboard-prompts/read', (req: Request, res: Response) => {
    try {
      const config = orchestrator.getConfig();
      // Check for combined file first
      const combinedPath = path.join(config.moodboardPromptsDir, 'combined_moodboard.md');
      let content = '';
      if (fs.existsSync(combinedPath)) {
        content = fs.readFileSync(combinedPath, 'utf-8');
      } else {
        content = readPromptsFromFolder(config.moodboardPromptsDir);
      }
      
      const result = orchestrator.parsePrompts(content);
      res.json({ content, ...result });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Read Image Prompts from folder ───
  app.get('/api/image-prompts/read', (req: Request, res: Response) => {
    try {
      const config = orchestrator.getConfig();
      // Check for combined file first
      const combinedPath = path.join(config.imagePromptsDir, 'combined_images.md');
      let content = '';
      if (fs.existsSync(combinedPath)) {
        content = fs.readFileSync(combinedPath, 'utf-8');
      } else {
        content = readPromptsFromFolder(config.imagePromptsDir);
      }
      
      const result = orchestrator.parsePrompts(content);
      res.json({ content, ...result });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Scan folder for images by type ───
  app.get('/api/scan-folder/:type', (req: Request, res: Response) => {
    try {
      const { type } = req.params;
      const config = orchestrator.getConfig();
      let dirPath: string;
      
      switch (type) {
        case 'moodboard':
          dirPath = config.moodboardImagesDir;
          break;
        case 'script':
          dirPath = config.scriptImagesDir;
          break;
        case 'reference':
          dirPath = config.referenceImagesDir;
          break;
        default:
          res.status(400).json({ error: `Unknown folder type: ${type}` });
          return;
      }

      const images = scanImageDirectory(dirPath);
      res.json({ images, path: dirPath });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Download image from output directory ───
  app.get('/api/output-image/:type/:filename/download', (req: Request, res: Response) => {
    try {
      const { type, filename } = req.params;
      const config = orchestrator.getConfig();
      let dirPath: string;

      if (type === 'moodboard') {
        dirPath = config.moodboardImagesDir;
      } else {
        dirPath = config.scriptImagesDir;
      }

      const imagePath = path.join(dirPath, filename);
      if (!fs.existsSync(imagePath)) {
        res.status(404).json({ error: 'Image not found' });
        return;
      }

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.sendFile(path.resolve(imagePath));
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Get Config ───
  app.get('/api/config', (req: Request, res: Response) => {
    res.json(orchestrator.getConfig());
  });

  // ─── ZIP Upload & Extract ───
  app.post('/api/upload-zip', upload.single('zipfile'), (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const target = (req.body.target || 'moodboard') as string; // 'moodboard' or 'images'

      const zip = new AdmZip(file.path);
      const entries = zip.getEntries();

      // Search priorities based on target
      let searchNames: string[];
      if (target === 'moodboard') {
        searchNames = ['combined_moodboard.md', 'moodboard.md'];
      } else {
        searchNames = ['combined_images.md', 'images.md'];
      }

      let foundContent = '';
      let foundName = '';

      // Search for the target file in the ZIP (case-insensitive, ignoring path depth)
      for (const name of searchNames) {
        const entry = entries.find(e => {
          const basename = path.basename(e.entryName).toLowerCase();
          return basename === name.toLowerCase() && !e.isDirectory;
        });
        if (entry) {
          foundContent = entry.getData().toString('utf-8');
          foundName = entry.entryName;
          break;
        }
      }

      // Cleanup temp file
      try { fs.unlinkSync(file.path); } catch { /* ignore */ }

      if (!foundContent) {
        res.status(404).json({
          error: `Could not find ${searchNames.join(' or ')} in the ZIP file`,
          availableFiles: entries.filter(e => !e.isDirectory).map(e => e.entryName),
        });
        return;
      }

      // Parse the found content
      const parseResult = orchestrator.parsePrompts(foundContent);

      res.json({
        content: foundContent,
        filename: foundName,
        prompts: parseResult.prompts,
        valid: parseResult.valid,
        errors: parseResult.errors,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}
