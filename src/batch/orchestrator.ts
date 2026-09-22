import fs from 'fs';
import { EventEmitter } from 'events';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Page } from 'playwright';

import { AppConfig, loadConfig } from '../config';
import { launchBrowser, closeBrowser, BrowserSession } from '../browser/launcher';
import { SessionManager } from '../browser/session';
import { waitUntilReady } from '../browser/health';
import { QueueManager } from '../queue/manager';
import { ParsedPrompt, ReferenceImage, StyleBible, BatchSetupOptions, ReviewDecision, OrchestratorEvent } from '../queue/types';
import { createBatchFolder, getBatchFolderPaths, BatchFolderPaths } from './folder';
import { parsePromptDocument, validatePrompts } from '../prompt/parser';
import { PromptBuilder } from '../prompt/builder';
import { scanReferenceImages, ScannedImage } from '../reference/scanner';
import { copyReferencesToBatch, getReferenceFilePaths } from '../reference/manager';
import { generateStyleBible, loadStyleBible } from '../style/bible';
import { StyleAnchor } from '../style/anchor';
import { startNewChat } from '../chatgpt/navigation';
import { sendGenerationRequest } from '../chatgpt/composer';
import { waitForGeneration, countAssistantMessages } from '../chatgpt/generation';
import { createImageInterceptor, downloadGeneratedImage } from '../chatgpt/downloader';
import { detectError, waitForErrorResolution } from '../chatgpt/errors';
import { verifyImageFile } from '../download/verifier';
import { clearDownloadDir, archiveDownloadedImages } from '../download/download-watcher';
import { makeImageFilename } from '../utils/sanitize';
import { initGlobalLogger, getLogger } from '../utils/logger';
import { captureScreenshot } from '../utils/screenshot';

/**
 * The main batch orchestrator.
 * Coordinates the entire workflow from setup through completion.
 *
 * Download-based workflow:
 * 1. Submit prompt + reference images to ChatGPT
 * 2. Wait for generation to complete (stop button disappears)
 * 3. Click the download button on the generated image
 * 4. Watch downloaded_images/ directory for the new file
 * 5. Copy to batch folder, display in review/gallery
 */
export class BatchOrchestrator extends EventEmitter {
  private config: AppConfig;
  private queue!: QueueManager;
  private session!: SessionManager;
  private browserSession!: BrowserSession;
  private promptBuilder: PromptBuilder;
  private styleAnchor: StyleAnchor;
  private batchPaths!: BatchFolderPaths;
  private prompts: ParsedPrompt[] = [];
  private referenceImages: ReferenceImage[] = [];
  private isRunning: boolean = false;
  private imagesInCurrentChat: number = 0;

  // Callbacks for UI integration
  private onReviewRequest?: (imagePath: string, promptIndex: number, prompt: string) => void;
  private reviewResolve?: (decision: ReviewDecision) => void;

  constructor(config?: Partial<AppConfig>) {
    super();
    this.config = loadConfig(config);
    this.promptBuilder = new PromptBuilder();
    this.styleAnchor = new StyleAnchor();
  }

  getQueue(): QueueManager { return this.queue; }
  getConfig(): AppConfig { return this.config; }
  getStyleAnchor(): StyleAnchor { return this.styleAnchor; }
  getBatchPaths(): BatchFolderPaths { return this.batchPaths; }
  getPrompts(): ParsedPrompt[] { return this.prompts; }
  getReferenceImages(): ReferenceImage[] { return this.referenceImages; }

  /**
   * Set the review callback for the UI.
   */
  setReviewCallback(callback: (imagePath: string, promptIndex: number, prompt: string) => void): void {
    this.onReviewRequest = callback;
  }

  /**
   * Submit a review decision from the UI.
   */
  submitReview(decision: ReviewDecision): void {
    if (this.reviewResolve) {
      this.reviewResolve(decision);
      this.reviewResolve = undefined;
    }
  }

  /**
   * Scan reference images from the reference-images folder.
   */
  scanReferences(): ScannedImage[] {
    return scanReferenceImages(this.config.referenceImagesDir);
  }

  /**
   * Parse a prompt document.
   */
  parsePrompts(text: string): { prompts: ParsedPrompt[]; valid: boolean; errors: string[] } {
    const prompts = parsePromptDocument(text);
    const validation = validatePrompts(prompts);
    return { prompts, ...validation };
  }

  /**
   * Set up a new batch.
   */
  async setupBatch(options: BatchSetupOptions): Promise<{ batchId: string; batchFolder: string }> {
    const batchId = uuidv4();

    // Create batch folder
    this.batchPaths = createBatchFolder(this.config.batchesDir, options.batchName);

    // Initialize logger for this batch
    initGlobalLogger(this.batchPaths.logs);
    const logger = getLogger();
    logger.info('orchestrator', `Setting up batch: ${options.batchName} (${batchId})`);

    // Parse prompts
    let promptText = options.promptsText;
    if (options.promptsFilePath && fs.existsSync(options.promptsFilePath)) {
      promptText = fs.readFileSync(options.promptsFilePath, 'utf-8');
    }

    this.prompts = parsePromptDocument(promptText);
    const validation = validatePrompts(this.prompts);
    if (!validation.valid) {
      throw new Error(`Invalid prompts: ${validation.errors.join(', ')}`);
    }

    // Save raw and normalized prompts
    fs.writeFileSync(path.join(this.batchPaths.root, 'prompts.txt'), promptText);
    fs.writeFileSync(
      path.join(this.batchPaths.root, 'prompts.normalized.json'),
      JSON.stringify(this.prompts, null, 2)
    );

    // Copy reference images
    const scannedRefs = options.referenceImagePaths.map(p => {
      const stat = fs.statSync(p);
      return {
        filename: path.basename(p),
        absolutePath: p,
        sizeBytes: stat.size,
        extension: path.extname(p).toLowerCase(),
      };
    });
    this.referenceImages = copyReferencesToBatch(scannedRefs, this.batchPaths.references);

    // Initialize queue
    this.queue = new QueueManager(this.batchPaths.root);
    // Forward all queue events through the orchestrator's own EventEmitter
    this.queue.on('event', (event: OrchestratorEvent) => {
      this.emit('event', event);
    });
    this.queue.initialize(
      batchId,
      options.batchName,
      this.batchPaths.root,
      this.prompts.map(p => ({ index: p.index, originalText: p.originalText }))
    );

    // Save batch config
    fs.writeFileSync(
      path.join(this.batchPaths.root, 'batch.json'),
      JSON.stringify({
        batchId,
        batchName: options.batchName,
        browserType: options.browserType,
        totalPrompts: this.prompts.length,
        referenceImageCount: this.referenceImages.length,
        createdAt: new Date().toISOString(),
        config: {
          imagesPerChat: this.config.imagesPerChat,
          generationTimeoutMs: this.config.generationTimeoutMs,
        },
      }, null, 2)
    );

    // Clear downloaded_images directory for fresh batch
    clearDownloadDir(this.config.downloadedImagesDir);

    logger.info('orchestrator', `Batch setup complete: ${this.prompts.length} prompts, ${this.referenceImages.length} references`);

    return { batchId, batchFolder: this.batchPaths.root };
  }

  /**
   * Resume an existing batch from disk.
   */
  async resumeBatch(batchFolder: string): Promise<void> {
    this.batchPaths = getBatchFolderPaths(batchFolder);
    initGlobalLogger(this.batchPaths.logs);

    this.queue = new QueueManager(batchFolder);
    this.queue.on('event', (event: OrchestratorEvent) => {
      this.emit('event', event);
    });
    const progress = this.queue.getProgress();

    // Load prompts
    const normalizedPath = path.join(batchFolder, 'prompts.normalized.json');
    if (fs.existsSync(normalizedPath)) {
      this.prompts = JSON.parse(fs.readFileSync(normalizedPath, 'utf-8'));
    }

    // Load reference images
    this.referenceImages = progress.referenceImages;

    // Load style bible if approved
    if (progress.styleApproved) {
      const bible = loadStyleBible(this.batchPaths.styleAnchor);
      if (bible) {
        this.styleAnchor.loadAndLock(bible);
      }
    }

    // Resume paused jobs
    this.queue.resume();

    getLogger().info('orchestrator', `Resumed batch: ${progress.batchName}, ${progress.completedCount}/${progress.totalPrompts} completed`);
  }

  /**
   * Launch the browser and verify ChatGPT is ready.
   * Waits up to 5 minutes for the user to log in manually.
   */
  async launchBrowser(): Promise<{ accountName: string }> {
    const logger = getLogger();
    logger.info('orchestrator', 'Launching browser...');

    this.browserSession = await launchBrowser(this.config);
    this.session = new SessionManager(this.browserSession, this.config);

    // Navigate to ChatGPT
    await this.session.navigateToChatGPT();

    // Wait for ready — gives user up to 5 minutes to log in
    const health = await waitUntilReady(this.session.getPage(), 300_000);

    if (!health.isLoggedIn) {
      throw new Error('Not logged in to ChatGPT after 5 minutes. Please run: npm run login');
    }

    logger.info('orchestrator', `Browser ready — logged in as: ${health.accountName}`);
    return { accountName: health.accountName };
  }

  /**
   * Check if the browser session is alive and ready.
   */
  isBrowserReady(): boolean {
    return !!this.session;
  }

  /**
   * Ensure the browser is launched and ready before processing.
   */
  private async ensureBrowserReady(): Promise<void> {
    if (!this.session) {
      await this.launchBrowser();
    } else if (!await this.session.isPageAlive()) {
      const recovered = await this.session.recoverPage();
      if (!recovered) {
        // Re-launch completely
        await this.launchBrowser();
      }
    }
  }

  /**
   * Run the batch processing loop.
   */
  async runBatch(): Promise<void> {
    const logger = getLogger();
    this.isRunning = true;

    try {
      // Ensure browser is launched and ready
      await this.ensureBrowserReady();

      const progress = this.queue.getProgress();

      // If style not yet approved, process prompt 1 with approval gate
      if (!progress.styleApproved) {
        await this.processFirstPromptWithApproval();
      }

      // Process remaining prompts
      await this.processRemainingPrompts();

      // Mark batch complete
      this.queue.completeBatch();

      // Archive downloaded images to batch folder
      archiveDownloadedImages(
        this.config.downloadedImagesDir,
        path.join(this.batchPaths.root, 'downloaded-archive')
      );

      logger.info('orchestrator', 'Batch processing complete!');

    } catch (err) {
      logger.error('orchestrator', `Batch failed: ${err}`);
      this.queue.emitEvent({ type: 'batch_failed', error: String(err) });
      throw err;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process the first prompt with the approval gate.
   *
   * Workflow:
   * 1. Start new chat
   * 2. Upload reference images + type prompt 1
   * 3. Submit and wait for generation to complete
   * 4. Click download button, watch downloaded_images/ for new file
   * 5. Show image in review page, wait for user approval
   * 6. If rejected: re-attach ALL reference images + revised prompt in SAME chat
   * 7. If approved: lock style, proceed
   */
  private async processFirstPromptWithApproval(): Promise<void> {
    const logger = getLogger();
    const page = this.session.getPage();
    const prompt = this.prompts[0];

    if (this.queue.isJobDone(prompt.index)) {
      logger.info('orchestrator', 'Prompt 1 already completed, skipping');
      return;
    }

    let approved = false;
    let revisionInstructions = '';
    let retryCount = 0;
    this.imagesInCurrentChat = 0;

    while (!approved) {
      // Check for pause/cancel
      if (this.queue.paused || this.queue.cancelled) return;

      logger.info('orchestrator', `Processing prompt 1 (attempt ${retryCount + 1})`);
      this.queue.startJob(prompt.index, 1);

      // On first attempt, start a new chat
      if (retryCount === 0) {
        await startNewChat(page);
        await page.waitForTimeout(2000);
      }

      // Build the prompt
      let preparedPrompt: string;
      if (retryCount === 0) {
        preparedPrompt = this.promptBuilder.buildFirstPrompt(prompt.originalText);
      } else {
        preparedPrompt = this.promptBuilder.buildRevisionPrompt(prompt.originalText, revisionInstructions);
      }

      this.queue.updateJobPrompts(prompt.index, preparedPrompt, preparedPrompt);

      // Set up network interceptor BEFORE submitting prompt
      const interceptor = createImageInterceptor(page);

      // Get reference image paths
      const refPaths = getReferenceFilePaths(this.referenceImages);

      // On rejection, re-attach ALL reference images in the SAME chat
      const preMessageCount = await countAssistantMessages(page);
      await sendGenerationRequest(page, preparedPrompt, refPaths);

      // Wait for generation to complete
      const result = await waitForGeneration(
        page, preMessageCount,
        this.config.generationTimeoutMs,
        this.config.pollIntervalMs,
        this.batchPaths.screenshots
      );

      if (!result.completed) {
        interceptor.dispose();
        // Check for errors
        const error = await detectError(page);
        if (error.errorType !== 'none') {
          if (error.requiresManualAction) {
            logger.warn('orchestrator', `Manual action required: ${error.message}`);
            this.queue.emitEvent({ type: 'captcha_detected', message: error.message });
            await waitForErrorResolution(page, error);
            continue; // Retry after manual resolution
          }
          if (error.errorType === 'rate_limit') {
            this.queue.pause(error.message);
            this.queue.emitEvent({ type: 'rate_limit_detected', message: error.message });
            return;
          }
        }
        retryCount++;
        if (retryCount >= this.config.maxRetries + 1) {
          this.queue.failJob(prompt.index, result.error);
          throw new Error(`First prompt failed after ${retryCount} attempts: ${result.error}`);
        }
        logger.warn('orchestrator', `Generation failed, retrying: ${result.error}`);
        continue;
      }

      // Generation complete — download the image using interceptor + fallbacks
      const imageFilename = makeImageFilename(prompt.index, prompt.title);
      const imagePath = path.join(this.batchPaths.images, imageFilename);

      const downloadResult = await downloadGeneratedImage(
        page,
        imagePath,
        this.config.downloadedImagesDir,
        interceptor,
        60_000
      );

      if (!downloadResult.success) {
        logger.error('orchestrator', `Download failed: ${downloadResult.error}`);
        retryCount++;
        if (retryCount >= this.config.maxRetries + 1) {
          this.queue.failJob(prompt.index, downloadResult.error);
          throw new Error(`Download failed after ${retryCount} attempts: ${downloadResult.error}`);
        }
        continue;
      }

      // Verify the image
      const verification = verifyImageFile(imagePath);
      if (!verification.valid) {
        logger.error('orchestrator', `Image verification failed: ${verification.errors.join(', ')}`);
        retryCount++;
        continue;
      }

      // Also save to style-anchor folder
      const styleImagePath = path.join(this.batchPaths.styleAnchor, 'approved_image.png');
      fs.copyFileSync(imagePath, styleImagePath);

      this.imagesInCurrentChat++;

      // Request review
      this.queue.awaitReview(prompt.index, imagePath);
      logger.info('orchestrator', 'Image generated — awaiting review');

      // Wait for the user's review decision
      const decision = await this.waitForReview(imagePath, prompt.index, prompt.originalText);

      if (decision.approved) {
        approved = true;

        // Generate Style Bible
        const bible = generateStyleBible({
          approvedImagePath: styleImagePath,
          referenceImages: this.referenceImages,
          originalPrompt: prompt.originalText,
          preparedPrompt,
          revisionInstructions,
          batchStyleDir: this.batchPaths.styleAnchor,
        });

        // Lock the style
        this.styleAnchor.lock(bible);

        // Mark approved in queue
        this.queue.approveStyle(
          prompt.index,
          imagePath,
          path.join(this.batchPaths.styleAnchor, 'style-bible.json')
        );
        this.queue.completeJob(prompt.index, imagePath, imageFilename, '');

        logger.info('orchestrator', '✅ Style approved and locked!');
      } else {
        // Rejected — store revision instructions and retry IN THE SAME CHAT
        revisionInstructions = decision.revisionInstructions || '';
        retryCount++;
        this.queue.rejectForRevision(prompt.index);
        logger.info('orchestrator', `Prompt 1 rejected. Revision: ${revisionInstructions}`);
        // Don't start a new chat — re-attach references in same chat
      }
    }
  }

  /**
   * Process remaining prompts (2..N) sequentially.
   */
  private async processRemainingPrompts(): Promise<void> {
    const logger = getLogger();
    const page = this.session.getPage();
    const bible = this.styleAnchor.getBible();

    if (!bible) {
      throw new Error('Style Bible not available — cannot process remaining prompts');
    }

    for (let i = 1; i < this.prompts.length; i++) {
      // Check for pause/cancel
      if (this.queue.paused || this.queue.cancelled) {
        logger.info('orchestrator', 'Batch paused or cancelled');
        return;
      }

      const prompt = this.prompts[i];

      // Skip if already completed
      if (this.queue.isJobDone(prompt.index)) {
        logger.info('orchestrator', `Prompt ${prompt.index} already completed, skipping`);
        continue;
      }

      // Check if we need a new chat (every 10 images)
      const needsNewChat = this.imagesInCurrentChat >= this.config.imagesPerChat;
      const chatNumber = this.queue.getChatNumber(prompt.index, this.config.imagesPerChat);

      if (needsNewChat) {
        logger.info('orchestrator', `Starting new chat #${chatNumber} for prompt ${prompt.index} (${this.imagesInCurrentChat} images in current chat)`);
        await startNewChat(page);
        await page.waitForTimeout(2000);
        this.imagesInCurrentChat = 0;
        this.queue.emitEvent({ type: 'new_chat_started', chatNumber });
      }

      // Process the prompt
      await this.processSinglePrompt(prompt, chatNumber, needsNewChat, bible);

      // Delay between prompts
      if (i < this.prompts.length - 1) {
        await page.waitForTimeout(this.config.delayBetweenPromptsMs);
      }
    }
  }

  /**
   * Process a single subsequent prompt.
   */
  private async processSinglePrompt(
    prompt: ParsedPrompt,
    chatNumber: number,
    isNewChat: boolean,
    bible: StyleBible
  ): Promise<void> {
    const logger = getLogger();
    const page = this.session.getPage();

    logger.info('orchestrator', `Processing prompt ${prompt.index}: "${prompt.title}"`);
    this.queue.startJob(prompt.index, chatNumber);

    let retries = 0;
    while (retries <= this.config.maxRetries) {
      try {
        // Check page health
        if (!await this.session.isPageAlive()) {
          logger.warn('orchestrator', 'Page disconnected, recovering...');
          const recovered = await this.session.recoverPage();
          if (!recovered) throw new Error('Browser page recovery failed');
        }

        // Check for errors
        const preError = await detectError(page);
        if (preError.errorType !== 'none') {
          if (preError.errorType === 'captcha') {
            this.queue.emitEvent({ type: 'captcha_detected', message: preError.message });
            await waitForErrorResolution(page, preError);
          } else if (preError.errorType === 'rate_limit') {
            this.queue.pause(preError.message);
            this.queue.emitEvent({ type: 'rate_limit_detected', message: preError.message });
            return;
          }
        }

        // Build the prompt
        let preparedPrompt: string;
        let uploadFiles: string[] = [];

        if (isNewChat) {
          // New chat — upload approved image 1 as reference + style bible instructions
          preparedPrompt = this.promptBuilder.buildNewChatFirstPrompt(prompt.originalText, bible);
          uploadFiles = [
            bible.approvedImagePath,
          ].filter(f => fs.existsSync(f));
        } else {
          // Same chat — shorter style reminder
          preparedPrompt = this.promptBuilder.buildSubsequentSameChatPrompt(prompt.originalText, bible);
        }

        this.queue.updateJobPrompts(prompt.index, preparedPrompt, preparedPrompt);

        // Set up interceptor BEFORE sending request
        const interceptor = createImageInterceptor(page);

        const preMessageCount = await countAssistantMessages(page);

        // Send the generation request
        await sendGenerationRequest(page, preparedPrompt, uploadFiles);

        // Wait for generation to complete
        const result = await waitForGeneration(
          page, preMessageCount,
          this.config.generationTimeoutMs,
          this.config.pollIntervalMs,
          this.batchPaths.screenshots
        );

        if (!result.completed) {
          interceptor.dispose();
          const error = await detectError(page);
          if (error.errorType === 'rate_limit') {
            this.queue.pause(error.message);
            this.queue.emitEvent({ type: 'rate_limit_detected', message: error.message });
            return;
          }
          if (error.errorType === 'content_policy') {
            logger.warn('orchestrator', `Content policy: prompt ${prompt.index} — skipping`);
            this.queue.failJob(prompt.index, `Content policy: ${error.message}`);
            return;
          }
          throw new Error(result.error || 'Generation failed');
        }

        // Download the generated image using interceptor + fallbacks
        const imageFilename = makeImageFilename(prompt.index, prompt.title);
        const imagePath = path.join(this.batchPaths.images, imageFilename);

        const downloadResult = await downloadGeneratedImage(
          page,
          imagePath,
          this.config.downloadedImagesDir,
          interceptor,
          60_000
        );

        if (!downloadResult.success) {
          throw new Error(`Download failed: ${downloadResult.error}`);
        }

        // Verify the image
        const verification = verifyImageFile(imagePath);
        if (!verification.valid) {
          throw new Error(`Verification failed: ${verification.errors.join(', ')}`);
        }

        this.imagesInCurrentChat++;

        // Success!
        this.queue.completeJob(prompt.index, imagePath, imageFilename, '');
        logger.info('orchestrator', `✅ Prompt ${prompt.index} completed: ${imageFilename}`);

        // Emit progress update
        this.queue.emitEvent({ type: 'progress_update', progress: this.queue.getProgress() });

        return; // Success — exit retry loop

      } catch (err) {
        retries++;
        logger.warn('orchestrator', `Prompt ${prompt.index} attempt ${retries} failed: ${err}`);

        if (retries > this.config.maxRetries) {
          this.queue.failJob(prompt.index, String(err));
          logger.error('orchestrator', `Prompt ${prompt.index} failed permanently after ${retries} attempts`);
          await captureScreenshot(page, this.batchPaths.screenshots, `failed_prompt_${prompt.index}`);
          return;
        }

        // Wait before retry
        await page.waitForTimeout(this.config.retryDelayMs);
      }
    }
  }

  /**
   * Wait for the user to review the first image.
   * Returns when the user approves or rejects.
   */
  private waitForReview(imagePath: string, promptIndex: number, promptText: string): Promise<ReviewDecision> {
    return new Promise((resolve) => {
      this.reviewResolve = resolve;
      if (this.onReviewRequest) {
        this.onReviewRequest(imagePath, promptIndex, promptText);
      }
    });
  }

  /**
   * Pause the batch.
   */
  pause(): void {
    this.queue.pause('User paused');
  }

  /**
   * Cancel the batch.
   */
  cancel(): void {
    this.queue.cancel();
  }

  /**
   * Close the browser.
   */
  async closeBrowser(): Promise<void> {
    if (this.browserSession) {
      await closeBrowser(this.browserSession);
    }
  }
}
