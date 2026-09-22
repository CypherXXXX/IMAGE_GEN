import fs from 'fs';
import path from 'path';
import { BatchProgress, JobMetadata, JobState, BatchState } from './types';
import { getLogger } from '../utils/logger';

/**
 * Manages persistent queue state with atomic file writes.
 * All state is saved to progress.json and individual job metadata files.
 */
export class QueuePersistence {
  private progressPath: string;
  private metadataDir: string;
  private progress: BatchProgress;

  constructor(batchFolder: string) {
    this.progressPath = path.join(batchFolder, 'progress.json');
    this.metadataDir = path.join(batchFolder, 'metadata');
    fs.mkdirSync(this.metadataDir, { recursive: true });

    // Load existing progress or create new
    if (fs.existsSync(this.progressPath)) {
      this.progress = JSON.parse(fs.readFileSync(this.progressPath, 'utf-8'));
    } else {
      this.progress = this.createEmptyProgress();
    }
  }

  private createEmptyProgress(): BatchProgress {
    return {
      batchId: '',
      batchName: '',
      batchFolder: '',
      state: 'setup',
      totalPrompts: 0,
      completedCount: 0,
      failedCount: 0,
      currentPromptIndex: 0,
      currentChatNumber: 1,
      styleApproved: false,
      styleBiblePath: '',
      referenceImages: [],
      jobs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: '',
    };
  }

  /**
   * Atomic write: write to temp file, then rename.
   */
  private atomicWrite(filepath: string, data: any): void {
    const tmpPath = filepath + '.tmp';
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(tmpPath, content, 'utf-8');
    fs.renameSync(tmpPath, filepath);
  }

  getProgress(): BatchProgress {
    return { ...this.progress };
  }

  setProgress(updates: Partial<BatchProgress>): void {
    this.progress = {
      ...this.progress,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveProgress();
  }

  saveProgress(): void {
    this.atomicWrite(this.progressPath, this.progress);
  }

  /**
   * Initialize jobs array from parsed prompts.
   */
  initializeJobs(promptCount: number, prompts: { index: number; originalText: string }[]): void {
    this.progress.totalPrompts = promptCount;
    this.progress.jobs = prompts.map((p) => ({
      promptIndex: p.index,
      state: 'pending' as JobState,
      originalPrompt: p.originalText,
      preparedPrompt: '',
      finalPrompt: '',
      imagePath: '',
      imageFilename: '',
      imageUrl: '',
      chatNumber: 0,
      retryCount: 0,
      error: '',
      startedAt: '',
      completedAt: '',
      downloadVerified: false,
    }));
    this.saveProgress();
  }

  /**
   * Update a specific job's state and metadata.
   */
  updateJob(promptIndex: number, updates: Partial<JobMetadata>): void {
    const job = this.progress.jobs.find((j) => j.promptIndex === promptIndex);
    if (!job) {
      getLogger().error('persistence', `Job not found for prompt index ${promptIndex}`);
      return;
    }

    Object.assign(job, updates);

    // Update aggregate counts
    this.progress.completedCount = this.progress.jobs.filter(
      (j) => j.state === 'completed'
    ).length;
    this.progress.failedCount = this.progress.jobs.filter(
      (j) => j.state === 'failed'
    ).length;

    this.progress.updatedAt = new Date().toISOString();
    this.saveProgress();

    // Also save individual metadata file
    this.saveJobMetadata(promptIndex, job);
  }

  /**
   * Save individual job metadata to its own file.
   */
  private saveJobMetadata(promptIndex: number, job: JobMetadata): void {
    const filename = `${String(promptIndex).padStart(3, '0')}.json`;
    const filepath = path.join(this.metadataDir, filename);
    this.atomicWrite(filepath, job);
  }

  /**
   * Get a specific job.
   */
  getJob(promptIndex: number): JobMetadata | undefined {
    return this.progress.jobs.find((j) => j.promptIndex === promptIndex);
  }

  /**
   * Find the next pending job.
   */
  getNextPendingJob(): JobMetadata | undefined {
    return this.progress.jobs.find((j) => j.state === 'pending');
  }

  /**
   * Check if a job was already completed with a verified image on disk.
   */
  isJobCompletedOnDisk(promptIndex: number): boolean {
    const job = this.getJob(promptIndex);
    if (!job || job.state !== 'completed' || !job.downloadVerified) {
      return false;
    }
    // Verify the file actually exists
    return job.imagePath ? fs.existsSync(job.imagePath) : false;
  }

  /**
   * Get all jobs that need processing.
   */
  getJobsToProcess(): JobMetadata[] {
    return this.progress.jobs.filter(
      (j) => j.state === 'pending' || j.state === 'failed' || j.state === 'paused'
    );
  }

  /**
   * Mark all remaining pending jobs as paused.
   */
  pauseAllPending(): void {
    for (const job of this.progress.jobs) {
      if (job.state === 'pending' || job.state === 'generating') {
        job.state = 'paused';
      }
    }
    this.progress.state = 'paused';
    this.saveProgress();
  }

  /**
   * Resume paused jobs back to pending.
   */
  resumePaused(): void {
    for (const job of this.progress.jobs) {
      if (job.state === 'paused') {
        job.state = 'pending';
      }
    }
    this.progress.state = 'running';
    this.saveProgress();
  }

  /**
   * Mark batch as complete.
   */
  markBatchComplete(): void {
    this.progress.state = 'completed';
    this.progress.completedAt = new Date().toISOString();
    this.saveProgress();
  }
}
