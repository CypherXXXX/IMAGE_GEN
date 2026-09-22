import { StyleBible } from '../queue/types';
import { getLogger } from '../utils/logger';

/**
 * Manages the style anchor/lock state for a batch.
 */
export class StyleAnchor {
  private locked: boolean = false;
  private bible: StyleBible | null = null;

  isLocked(): boolean {
    return this.locked;
  }

  getBible(): StyleBible | null {
    return this.bible;
  }

  /**
   * Lock the style with the given bible.
   */
  lock(bible: StyleBible): void {
    this.bible = bible;
    this.locked = true;
    getLogger().info('style-anchor', 'Style direction LOCKED');
  }

  /**
   * Load an existing bible and lock.
   */
  loadAndLock(bible: StyleBible): void {
    this.lock(bible);
    getLogger().info('style-anchor', 'Style direction loaded and locked from existing bible');
  }

  /**
   * Get the style prefix text to prepend to prompts.
   */
  getStylePrefix(): string {
    if (!this.bible) return '';
    return this.bible.stylePrefix;
  }

  /**
   * Get the approved image path.
   */
  getApprovedImagePath(): string {
    return this.bible?.approvedImagePath || '';
  }

  /**
   * Get reference image paths.
   */
  getReferenceImagePaths(): string[] {
    return this.bible?.referenceImagePaths || [];
  }
}
