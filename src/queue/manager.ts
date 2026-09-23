import { EventEmitter } from 'events';
import { QueuePersistence } from './persistence';
import { BatchProgress, JobMetadata, JobState, BatchState, OrchestratorEvent } from './types';
import { getLogger } from '../utils/logger';

/**
 * Queue Manager: state machine for batch processing.
 * Emits events for real-time UI updates via WebSocket.
 */
export class QueueManager extends EventEmitter {
  private persistence: QueuePersistence;
  private _paused: boolean = false;
  private _cancelled: boolean = false;

  constructor(batchFolder: string) {
    super();
    this.persistence = new QueuePersistence(batchFolder);
  }

  get paused(): boolean { return this._paused; }
  get cancelled(): boolean { return this._cancelled; }

  getProgress(): BatchProgress {
    return this.persistence.getProgress();
  }

  getPersistence(): QueuePersistence {
    return this.persistence;
  }

  /**
   * Emit an event and log it.
   */
  emitEvent(event: OrchestratorEvent): void {
    this.emit('event', event);
    getLogger().info('queue', `Event: ${event.type}`, event);
  }

  /**
   * Initialize the queue with prompts.
   */
  initialize(batchId: string, batchName: string, batchFolder: string,
    prompts: { index: number; originalText: string; imageId?: string }[]): void {
    this.persistence.setProgress({
      batchId,
      batchName,
      batchFolder,
      state: 'running',
    });
    this.persistence.initializeJobs(prompts.length, prompts);
    this.emitEvent({ type: 'batch_started', batchId });
  }

  /**
   * Start a job.
   */
  startJob(promptIndex: number, chatNumber: number): void {
    this.persistence.updateJob(promptIndex, {
      state: 'generating',
      startedAt: new Date().toISOString(),
      chatNumber,
    });
    this.persistence.setProgress({ currentPromptIndex: promptIndex, currentChatNumber: chatNumber });
    this.emitEvent({ type: 'job_started', promptIndex });
  }

  /**
   * Mark job as awaiting review.
   */
  awaitReview(promptIndex: number, imagePath: string): void {
    this.persistence.updateJob(promptIndex, {
      state: 'awaiting_review',
      imagePath,
    });
    this.emitEvent({ type: 'awaiting_review', promptIndex, imagePath });
  }

  /**
   * Mark style as approved.
   */
  approveStyle(promptIndex: number, imagePath: string, styleBiblePath: string): void {
    this.persistence.updateJob(promptIndex, {
      state: 'approved',
    });
    this.persistence.setProgress({
      styleApproved: true,
      styleBiblePath,
    });
    this.emitEvent({ type: 'style_approved', styleBiblePath });
  }

  /**
   * Mark job as rejected for revision.
   */
  rejectForRevision(promptIndex: number): void {
    this.persistence.updateJob(promptIndex, {
      state: 'rejected',
    });
    this.emitEvent({ type: 'style_rejected', promptIndex });
  }

  /**
   * Complete a job successfully.
   */
  completeJob(promptIndex: number, imagePath: string, imageFilename: string, imageUrl: string): void {
    this.persistence.updateJob(promptIndex, {
      state: 'completed',
      imagePath,
      imageFilename,
      imageUrl,
      completedAt: new Date().toISOString(),
      downloadVerified: true,
    });
    this.emitEvent({ type: 'job_completed', promptIndex, imagePath });
  }

  /**
   * Mark a job as failed.
   */
  failJob(promptIndex: number, error: string): void {
    this.persistence.updateJob(promptIndex, {
      state: 'failed',
      error,
    });
    this.emitEvent({ type: 'job_failed', promptIndex, error });
  }

  /**
   * Update prepared/final prompt text for a job.
   */
  updateJobPrompts(promptIndex: number, prepared: string, final: string): void {
    this.persistence.updateJob(promptIndex, {
      preparedPrompt: prepared,
      finalPrompt: final,
    });
  }

  /**
   * Check if job was already completed with verified file.
   */
  isJobDone(promptIndex: number): boolean {
    return this.persistence.isJobCompletedOnDisk(promptIndex);
  }

  /**
   * Get next job to process.
   */
  getNextJob(): JobMetadata | undefined {
    return this.persistence.getNextPendingJob();
  }

  /**
   * Pause the queue.
   */
  pause(reason: string = 'User paused'): void {
    this._paused = true;
    this.persistence.pauseAllPending();
    this.emitEvent({ type: 'batch_paused', reason });
  }

  /**
   * Resume the queue.
   */
  resume(): void {
    this._paused = false;
    this.persistence.resumePaused();
  }

  /**
   * Cancel the queue.
   */
  cancel(): void {
    this._cancelled = true;
    this.persistence.setProgress({ state: 'cancelled' });
  }

  /**
   * Retry a specific failed job.
   */
  retryJob(promptIndex: number): boolean {
    const job = this.persistence.getJob(promptIndex);
    if (job && (job.state === 'failed' || job.state === 'cancelled')) {
      this.persistence.updateJob(promptIndex, {
        state: 'pending',
        error: '',
        retryCount: job.retryCount + 1,
      });
      this.emitEvent({ type: 'job_retry_requested', promptIndex });
      return true;
    }
    return false;
  }

  /**
   * Skip a specific job.
   */
  skipJob(promptIndex: number): void {
    this.persistence.updateJob(promptIndex, {
      state: 'skipped',
    });
  }

  /**
   * Regenerate a specific job — works on any state (completed, failed, etc.).
   * Resets the job to 'generating' state for re-generation.
   */
  regenerateJob(promptIndex: number): boolean {
    const job = this.persistence.getJob(promptIndex);
    if (!job) return false;

    this.persistence.updateJob(promptIndex, {
      state: 'generating',
      error: '',
      imagePath: '',
      imageFilename: '',
      imageUrl: '',
      retryCount: job.retryCount + 1,
      startedAt: new Date().toISOString(),
      completedAt: '',
      downloadVerified: false,
    });
    this.emitEvent({ type: 'job_started', promptIndex });
    return true;
  }

  /**
   * Mark batch complete.
   */
  completeBatch(): void {
    const progress = this.persistence.getProgress();
    this.persistence.markBatchComplete();
    this.emitEvent({
      type: 'batch_completed',
      totalCompleted: progress.completedCount,
      totalFailed: progress.failedCount,
    });
  }

  /**
   * Calculate which chat number a prompt belongs to (10 images per chat).
   */
  getChatNumber(promptIndex: number, imagesPerChat: number): number {
    return Math.ceil(promptIndex / imagesPerChat);
  }

  /**
   * Check if we need to start a new chat for this prompt.
   */
  needsNewChat(promptIndex: number, imagesPerChat: number): boolean {
    if (promptIndex === 1) return true; // Always start fresh for first image
    return (promptIndex - 1) % imagesPerChat === 0; // 11, 21, 31, etc.
  }
}
