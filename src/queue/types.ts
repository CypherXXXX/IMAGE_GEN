/**
 * Queue and batch type definitions.
 */

export type JobState =
  | 'pending'
  | 'generating'
  | 'awaiting_review'
  | 'rejected'
  | 'approved'
  | 'downloading'
  | 'completed'
  | 'failed'
  | 'paused'
  | 'cancelled'
  | 'skipped';

export type BatchState =
  | 'setup'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ParsedPrompt {
  index: number;           // 1-based prompt number
  title: string;           // Short extracted title
  originalText: string;    // Exact user text
  preparedText?: string;   // Text with style instructions added
  revisionText?: string;   // Revision instructions (for prompt 1 rejections)
  finalText?: string;      // The final text actually sent to ChatGPT
}

export interface ReferenceImage {
  originalPath: string;    // Path in reference-images/ folder
  batchPath: string;       // Path copied into batch/references/
  filename: string;
  sizeBytes: number;
  order: number;           // Display/upload order
}

export interface StyleBible {
  description: string;           // Human-readable style description
  structured: StyleAttributes;   // Structured JSON representation
  approvedImagePath: string;     // Path to the approved first image
  referenceImagePaths: string[]; // Original reference image paths
  approvedPromptOriginal: string;
  approvedPromptPrepared: string;
  revisionInstructions: string;
  stylePrefix: string;           // The text to prepend to subsequent prompts
  createdAt: string;
}

export interface StyleAttributes {
  artStyle: string;
  colorPalette: string;
  lineQuality: string;
  shadingApproach: string;
  lightingDirection: string;
  backgroundTreatment: string;
  renderingMethod: string;
  levelOfDetail: string;
  overallMood: string;
  characterDesign: string;
}

export interface JobMetadata {
  promptIndex: number;
  state: JobState;
  originalPrompt: string;
  preparedPrompt: string;
  finalPrompt: string;
  imagePath: string;
  imageFilename: string;
  imageUrl: string;
  chatNumber: number;
  retryCount: number;
  error: string;
  startedAt: string;
  completedAt: string;
  downloadVerified: boolean;
}

export interface BatchProgress {
  batchId: string;
  batchName: string;
  batchFolder: string;
  state: BatchState;
  totalPrompts: number;
  completedCount: number;
  failedCount: number;
  currentPromptIndex: number;
  currentChatNumber: number;
  styleApproved: boolean;
  styleBiblePath: string;
  referenceImages: ReferenceImage[];
  jobs: JobMetadata[];
  createdAt: string;
  updatedAt: string;
  completedAt: string;
}

export interface BatchSetupOptions {
  batchName: string;
  promptsText: string;
  promptsFilePath?: string;
  referenceImagePaths: string[];
  browserType: 'persistent' | 'cdp' | 'existing-chrome';
  outputFolder?: string;
}

export interface ReviewDecision {
  approved: boolean;
  revisionInstructions?: string;
}

// Events emitted by the orchestrator
export type OrchestratorEvent =
  | { type: 'batch_started'; batchId: string }
  | { type: 'job_started'; promptIndex: number }
  | { type: 'job_generating'; promptIndex: number; progress?: number }
  | { type: 'job_completed'; promptIndex: number; imagePath: string }
  | { type: 'job_failed'; promptIndex: number; error: string }
  | { type: 'awaiting_review'; promptIndex: number; imagePath: string }
  | { type: 'style_approved'; styleBiblePath: string }
  | { type: 'style_rejected'; promptIndex: number }
  | { type: 'new_chat_started'; chatNumber: number }
  | { type: 'batch_paused'; reason: string }
  | { type: 'batch_completed'; totalCompleted: number; totalFailed: number }
  | { type: 'batch_failed'; error: string }
  | { type: 'rate_limit_detected'; message: string }
  | { type: 'captcha_detected'; message: string }
  | { type: 'error'; error: string; promptIndex?: number }
  | { type: 'progress_update'; progress: BatchProgress };
