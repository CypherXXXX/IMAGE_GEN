import express from 'express';
import path from 'path';
import { createServer } from 'http';
import { setupWebSocket, broadcast } from './websocket';
import { setupApiRoutes } from './api';
import { BatchOrchestrator } from '../batch/orchestrator';
import { AppConfig } from '../config';

/**
 * Create and configure the Express server.
 */
export function createApp(config: AppConfig, orchestrator: BatchOrchestrator) {
  const app = express();
  const httpServer = createServer(app);

  // Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Serve static files from public/
  const publicDir = path.join(config.projectRoot, 'public');
  app.use(express.static(publicDir));

  // Serve batch images for preview
  app.use('/batches', express.static(config.batchesDir));

  // Serve reference images for preview
  app.use('/reference-images', express.static(config.referenceImagesDir));

  // Serve moodboard images
  app.use('/moodboard-images', express.static(config.moodboardImagesDir));

  // Serve script images
  app.use('/script-images', express.static(config.scriptImagesDir));

  // API routes
  setupApiRoutes(app, orchestrator);

  // Setup WebSocket
  const wss = setupWebSocket(httpServer);

  // Forward orchestrator events to WebSocket
  // Listen on the orchestrator itself (always exists) — not the queue
  // (which only exists after batch setup)
  orchestrator.on('event', (event: any) => {
    broadcast(wss, event);
  });

  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return { app, httpServer, wss };
}

/**
 * Start the server.
 */
export function startServer(
  config: AppConfig,
  orchestrator: BatchOrchestrator
): Promise<{ port: number }> {
  return new Promise((resolve) => {
    const { httpServer, wss } = createApp(config, orchestrator);

    httpServer.listen(config.serverPort, () => {
      console.log(`\n🎨 ChatGPT Image Batch Studio`);
      console.log(`   Dashboard: http://localhost:${config.serverPort}`);
      console.log(`   WebSocket: ws://localhost:${config.serverPort}`);
      console.log('');
      resolve({ port: config.serverPort });
    });
  });
}
