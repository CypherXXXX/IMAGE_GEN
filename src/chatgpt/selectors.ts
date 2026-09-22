/**
 * Centralized CSS selectors for ChatGPT web UI.
 *
 * ALL selectors used to interact with ChatGPT are defined here.
 * When ChatGPT updates their UI, only this file needs to change.
 *
 * Last verified: September 2026 via live browser inspection.
 */

export const SELECTORS = {
  // ─── Composer / Input Area ───
  COMPOSER: {
    /** The main text input area (ProseMirror contenteditable div) */
    TEXTAREA: '#prompt-textarea',
    /** The "+" button that opens attachment/tools menu */
    PLUS_BUTTON: 'button[aria-label="Attach files"]',
    /** Fallback selector for plus button */
    PLUS_BUTTON_ALT: '#composer-plus-btn',
    /** The send/submit button */
    SUBMIT_BUTTON: 'button[data-testid="send-button"]',
    /** Fallback submit button */
    SUBMIT_BUTTON_ALT: '#composer-submit-button',
    /** The stop button that appears during generation */
    STOP_BUTTON: 'button[aria-label="Stop generating"]',
    /** Fallback stop button */
    STOP_BUTTON_ALT: 'button[data-testid="stop-button"]',
    /** Hidden file input for uploads */
    FILE_INPUT: 'input[type="file"]',
  },

  // ─── Attachment Menu ───
  ATTACHMENT: {
    /** Menu item for uploading files */
    UPLOAD_OPTION: '[data-testid="upload-file"]',
    /** Fallback: menu item containing "Upload" text */
    UPLOAD_OPTION_TEXT: 'menuitem:has-text("Upload")',
    /** Menu item for upload from computer */
    FROM_COMPUTER: 'menuitem:has-text("Upload from computer")',
  },

  // ─── Chat / Messages ───
  CHAT: {
    /** Container for all messages */
    MESSAGES_CONTAINER: '[role="presentation"]',
    /** Individual assistant message blocks */
    ASSISTANT_MESSAGE: '[data-message-author-role="assistant"]',
    /** User message blocks */
    USER_MESSAGE: '[data-message-author-role="user"]',
    /** The "New chat" button in sidebar */
    NEW_CHAT_BUTTON: 'a[href="/"]',
    /** Fallback new chat */
    NEW_CHAT_BUTTON_ALT: 'nav a:has-text("New chat")',
  },

  // ─── Image Elements ───
  IMAGE: {
    /** Generated image within an assistant message (the card) */
    GENERATED_IMAGE: '[data-message-author-role="assistant"] img[alt]',
    /** Image card container (clickable to open lightbox) */
    IMAGE_CARD: '[data-message-author-role="assistant"] [role="button"]:has(img)',
    /** All images in chat (for counting/tracking) */
    ALL_IMAGES: '[data-message-author-role="assistant"] img',
    /** Image with specific src pattern (OpenAI CDN) */
    CDN_IMAGE: '[data-message-author-role="assistant"] img[src*="oaidalleapiprodscus"]',
    /** Fallback: any image in assistant message */
    ANY_ASSISTANT_IMAGE: '[data-message-author-role="assistant"] img[src]',
    /** Download icon button on the generated image (hover-revealed) */
    DOWNLOAD_ICON_BUTTON: '[data-message-author-role="assistant"] button[aria-label="Download"]',
    /** Fallback: download button with download icon SVG */
    DOWNLOAD_ICON_BUTTON_ALT: '[data-message-author-role="assistant"] a[download]',
    /** Another fallback: any button near images with download semantics */
    DOWNLOAD_ICON_BUTTON_ALT2: '[data-message-author-role="assistant"] button[aria-label="download"]',
  },

  // ─── Image Lightbox / Fullscreen ───
  LIGHTBOX: {
    /** The fullscreen/lightbox overlay */
    OVERLAY: '[role="dialog"]',
    /** Download/Save button in lightbox */
    DOWNLOAD_BUTTON: 'button[aria-label="Download"]',
    /** Save button variant */
    SAVE_BUTTON: 'a[download]',
    /** Fallback: link with download attribute */
    DOWNLOAD_LINK: 'a[download][href]',
    /** Close button */
    CLOSE_BUTTON: 'button[aria-label="Close"]',
    /** Fullscreen image element */
    FULLSCREEN_IMAGE: '[role="dialog"] img',
  },

  // ─── Action buttons on messages ───
  ACTIONS: {
    /** Copy button on message */
    COPY_BUTTON: 'button[aria-label="Copy"]',
    /** Share/upload button on image */
    SHARE_BUTTON: 'button[aria-label="Share"]',
    /** Edit button on image */
    EDIT_BUTTON: 'button:has-text("Edit")',
    /** Three-dot menu button */
    MORE_BUTTON: 'button[aria-label="More"]',
  },

  // ─── Generation Progress ───
  PROGRESS: {
    /** Progress indicator during image generation */
    PROGRESS_BAR: '[role="progressbar"]',
    /** Loading/thinking indicator */
    THINKING_INDICATOR: '[data-testid="thinking-indicator"]',
    /** Status text during generation */
    STATUS_TEXT: '.result-streaming',
    /** Assistant message that is still being generated */
    STREAMING_MESSAGE: '[data-message-author-role="assistant"].result-streaming',
    /** Any element indicating active generation */
    GENERATING_INDICATOR: '[data-testid="generating"]',
  },

  // ─── Error/Limit/Verification ───
  ERRORS: {
    /** Rate limit banner */
    RATE_LIMIT: 'div:has-text("limit")',
    /** Content policy refusal */
    CONTENT_POLICY: 'div:has-text("content policy")',
    /** Error message container */
    ERROR_MESSAGE: '[data-testid="error-message"]',
    /** Cloudflare turnstile challenge */
    CAPTCHA_TURNSTILE: 'iframe[src*="challenges.cloudflare.com"]',
    /** Generic CAPTCHA frame */
    CAPTCHA_FRAME: 'iframe[src*="captcha"]',
    /** "Something went wrong" error */
    GENERIC_ERROR: 'div:has-text("Something went wrong")',
    /** Network error */
    NETWORK_ERROR: 'div:has-text("network error")',
  },

  // ─── Sidebar / Navigation ───
  SIDEBAR: {
    /** User profile button/area */
    USER_PROFILE: 'nav [data-testid="profile-button"]',
    /** User name display */
    USER_NAME: 'nav button:has(img[alt])',
    /** Sidebar container */
    CONTAINER: 'nav',
    /** Chat history items */
    CHAT_HISTORY_ITEM: 'nav li a',
  },

  // ─── Login / Authentication ───
  AUTH: {
    /** Login button on landing page */
    LOGIN_BUTTON: 'button:has-text("Log in")',
    /** Sign up button */
    SIGNUP_BUTTON: 'button:has-text("Sign up")',
    /** Main page content (indicates logged in) */
    LOGGED_IN_INDICATOR: '#prompt-textarea',
  },
} as const;

/**
 * Attempt to find an element using primary and fallback selectors.
 */
export function getSelectorWithFallbacks(...selectors: string[]): string {
  return selectors.join(', ');
}
