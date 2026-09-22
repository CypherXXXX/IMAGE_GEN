import { Express, Request, Response } from 'express';
import { BatchOrchestrator } from '../batch/orchestrator';
import { listBatchFolders } from '../batch/folder';
import { scanReferenceImages } from '../reference/scanner';
import { getLatestDownloadedFile, clearDownloadDir } from '../download/download-watcher';
import fs from 'fs';
import path from 'path';

/**
 * Set up REST API routes.
 */
export function setupApiRoutes(app: Express, orchestrator: BatchOrchestrator): void {

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
      const { batchName, promptsText, referenceImagePaths, browserType } = req.body;
      const result = await orchestrator.setupBatch({
        batchName,
        promptsText,
        referenceImagePaths: referenceImagePaths || [],
        browserType: browserType || 'persistent',
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
      await orchestrator.resumeBatch(batchFolder);
      await orchestrator.launchBrowser();
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

  // ─── List Batches (Gallery) ───
  app.get('/api/batches', (req: Request, res: Response) => {
    try {
      const batches = listBatchFolders(orchestrator.getConfig().batchesDir);
      const batchInfo = batches.map(b => {
        let progress = null;
        if (b.hasProgress) {
          try {
            progress = JSON.parse(fs.readFileSync(path.join(b.path, 'progress.json'), 'utf-8'));
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

  // ─── Latest Downloaded File ───
  app.get('/api/download/latest', (req: Request, res: Response) => {
    try {
      const latest = getLatestDownloadedFile(orchestrator.getConfig().downloadedImagesDir);
      if (latest) {
        const filename = path.basename(latest);
        res.json({
          found: true,
          filename,
          url: `/downloaded-images/${filename}`,
        });
      } else {
        res.json({ found: false });
      }
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Clear Downloaded Images ───
  app.post('/api/download/clear', (req: Request, res: Response) => {
    try {
      clearDownloadDir(orchestrator.getConfig().downloadedImagesDir);
      res.json({ status: 'cleared' });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ─── Retry Job ───
  app.post('/api/batch/retry', (req: Request, res: Response) => {
    try {
      const { promptIndex } = req.body;
      orchestrator.getQueue().retryJob(promptIndex);
      res.json({ status: 'retried' });
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

  // ─── Get Config ───
  app.get('/api/config', (req: Request, res: Response) => {
    res.json(orchestrator.getConfig());
  });
}
