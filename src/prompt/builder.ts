import { StyleBible } from '../queue/types';
import { getLogger } from '../utils/logger';

/**
 * Build the final prompt text for different stages of the batch.
 */
export class PromptBuilder {

  /**
   * Build the FIRST prompt (with reference images).
   * This goes into a fresh chat with reference images attached.
   */
  buildFirstPrompt(originalPrompt: string): string {
    return [
      `I'm providing reference images that establish the visual identity and art direction I want for a series of images.`,
      ``,
      `Please study these reference images carefully and generate the following image matching their visual style:`,
      ``,
      `---`,
      ``,
      originalPrompt,
      ``,
      `---`,
      ``,
      `STYLE INSTRUCTIONS:`,
      `- Match the art style, color palette, line quality, shading approach, lighting direction, and rendering method of the reference images`,
      `- Match the character design language, proportions, and level of detail`,
      `- Match the background treatment and overall visual mood`,
      `- Do NOT copy the composition or layout of the reference images`,
      `- Follow this prompt's own subject, scene, action, camera angle, and composition`,
      `- This is the first in a series — establish a consistent visual identity that can be maintained across many images`,
    ].join('\n');
  }

  /**
   * Build a REVISION prompt (same prompt 1, with revision instructions).
   */
  buildRevisionPrompt(
    originalPrompt: string,
    revisionInstructions: string
  ): string {
    return [
      `Please regenerate the previous image with these changes:`,
      ``,
      revisionInstructions,
      ``,
      `Original prompt for reference:`,
      originalPrompt,
      ``,
      `Continue to match the style of the reference images I provided.`,
      `Do NOT copy composition from the references — follow the prompt's scene description.`,
    ].join('\n');
  }

  /**
   * Build a SUBSEQUENT prompt within the same chat (images 2-10, 12-20, etc.).
   * The chat already has context from previous images.
   */
  buildSubsequentSameChatPrompt(
    originalPrompt: string,
    styleBible: StyleBible
  ): string {
    return [
      `Generate the next image in this series:`,
      ``,
      `---`,
      ``,
      originalPrompt,
      ``,
      `---`,
      ``,
      `STYLE CONSISTENCY REMINDER:`,
      `- Maintain the EXACT same art style, color palette, character design, line quality, and rendering approach as all previous images in this series`,
      `- Match: ${styleBible.structured.artStyle}`,
      `- Colors: ${styleBible.structured.colorPalette}`,
      `- Rendering: ${styleBible.structured.renderingMethod}`,
      `- Do NOT copy composition from previous images`,
      `- Follow THIS prompt's own subject, scene, action, and composition`,
    ].join('\n');
  }

  /**
   * Build the FIRST prompt of a NEW CHAT (images 11, 21, 31, etc.).
   * Style anchor image and references will be re-uploaded.
   */
  buildNewChatFirstPrompt(
    originalPrompt: string,
    styleBible: StyleBible
  ): string {
    return [
      `I'm continuing a batch image generation series. The attached images are:`,
      `1. My original reference images (style references)`,
      `2. The approved style anchor image from the first batch`,
      ``,
      `APPROVED STYLE BIBLE:`,
      styleBible.stylePrefix,
      ``,
      `---`,
      ``,
      `Generate this image maintaining EXACT style consistency with the approved direction:`,
      ``,
      originalPrompt,
      ``,
      `---`,
      ``,
      `CRITICAL REQUIREMENTS:`,
      `- Art style, color palette, character design, line quality, shading, lighting, and rendering MUST match the approved style`,
      `- Do NOT copy composition from the reference or anchor images`,
      `- Follow THIS prompt's own subject, scene, action, camera angle, and spatial relationships`,
    ].join('\n');
  }
}
