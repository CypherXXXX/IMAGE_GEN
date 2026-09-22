import fs from 'fs';
import path from 'path';
import { StyleBible, StyleAttributes, ReferenceImage } from '../queue/types';
import { getLogger } from '../utils/logger';

/**
 * Generate the Style Bible from the approved first image.
 *
 * Since we cannot programmatically analyze the image content,
 * we construct the Style Bible from the context of the approval:
 * - The reference images that were provided
 * - The approved prompt
 * - Any revision instructions
 * - The generated image path
 *
 * The user approving the image implicitly confirms these style attributes.
 */
export function generateStyleBible(params: {
  approvedImagePath: string;
  referenceImages: ReferenceImage[];
  originalPrompt: string;
  preparedPrompt: string;
  revisionInstructions: string;
  batchStyleDir: string;
}): StyleBible {
  const logger = getLogger();
  fs.mkdirSync(params.batchStyleDir, { recursive: true });

  // Create structured style attributes
  // These are descriptive placeholders — the actual style is conveyed
  // through the images themselves and the style prefix text
  const structured: StyleAttributes = {
    artStyle: 'As established by the approved reference and anchor images',
    colorPalette: 'Match the exact color palette of the approved anchor image',
    lineQuality: 'Consistent with the anchor image line work',
    shadingApproach: 'Match the shading style of the anchor image',
    lightingDirection: 'Consistent with the anchor image lighting',
    backgroundTreatment: 'Match the background style of the anchor image',
    renderingMethod: 'Same rendering approach as the anchor image',
    levelOfDetail: 'Same detail level as the anchor image',
    overallMood: 'Maintain the visual mood of the anchor image',
    characterDesign: 'Same character design language as the anchor image',
  };

  // Build the style prefix that gets prepended to subsequent prompts
  const stylePrefix = buildStylePrefix(params.revisionInstructions);

  const bible: StyleBible = {
    description: buildHumanDescription(params),
    structured,
    approvedImagePath: params.approvedImagePath,
    referenceImagePaths: params.referenceImages.map(r => r.batchPath),
    approvedPromptOriginal: params.originalPrompt,
    approvedPromptPrepared: params.preparedPrompt,
    revisionInstructions: params.revisionInstructions,
    stylePrefix,
    createdAt: new Date().toISOString(),
  };

  // Save markdown version
  const mdPath = path.join(params.batchStyleDir, 'style-bible.md');
  fs.writeFileSync(mdPath, buildMarkdownBible(bible));

  // Save JSON version
  const jsonPath = path.join(params.batchStyleDir, 'style-bible.json');
  fs.writeFileSync(jsonPath, JSON.stringify(bible, null, 2));

  logger.info('style-bible', `Style Bible generated at: ${params.batchStyleDir}`);
  return bible;
}

/**
 * Load an existing Style Bible from disk.
 */
export function loadStyleBible(batchStyleDir: string): StyleBible | null {
  const jsonPath = path.join(batchStyleDir, 'style-bible.json');
  if (!fs.existsSync(jsonPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Build the style prefix text that's prepended to subsequent prompts.
 */
function buildStylePrefix(revisionInstructions: string): string {
  const parts = [
    `VISUAL STYLE REQUIREMENTS (from approved style anchor):`,
    `- Maintain the EXACT same art style as the approved first image`,
    `- Use the same color palette, gradients, and color relationships`,
    `- Use the same line quality, thickness, and stroke style`,
    `- Use the same shading approach and shadow rendering`,
    `- Use the same lighting direction and intensity`,
    `- Use the same background treatment and atmospheric effects`,
    `- Use the same rendering method and texture quality`,
    `- Use the same level of detail and visual complexity`,
    `- Use the same character proportions and design language`,
    `- Maintain the same overall visual mood and tone`,
  ];

  if (revisionInstructions) {
    parts.push('');
    parts.push(`ADDITIONAL STYLE NOTES FROM APPROVAL:`);
    parts.push(revisionInstructions);
  }

  return parts.join('\n');
}

/**
 * Build human-readable description.
 */
function buildHumanDescription(params: {
  referenceImages: ReferenceImage[];
  originalPrompt: string;
  revisionInstructions: string;
}): string {
  let desc = `This Style Bible was generated from ${params.referenceImages.length} reference image(s) `;
  desc += `and the approved first generation.\n\n`;
  desc += `The approved art direction should be maintained across all subsequent images in this batch.\n\n`;
  desc += `Original first prompt: "${params.originalPrompt.substring(0, 100)}..."\n`;

  if (params.revisionInstructions) {
    desc += `\nRevision instructions applied: "${params.revisionInstructions}"\n`;
  }

  desc += `\nIMPORTANT: Each subsequent image must follow its own prompt's subject, scene, `;
  desc += `action, and composition while maintaining the approved visual identity.`;

  return desc;
}

/**
 * Build markdown version of the Style Bible.
 */
function buildMarkdownBible(bible: StyleBible): string {
  return `# Style Bible

## Description
${bible.description}

## Approved Image
- Path: \`${bible.approvedImagePath}\`
- Created: ${bible.createdAt}

## Reference Images
${bible.referenceImagePaths.map((p, i) => `${i + 1}. \`${p}\``).join('\n')}

## Style Attributes
| Attribute | Value |
|-----------|-------|
${Object.entries(bible.structured).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

## Style Prefix (prepended to subsequent prompts)
\`\`\`
${bible.stylePrefix}
\`\`\`

## Original Approved Prompt
\`\`\`
${bible.approvedPromptOriginal}
\`\`\`

## Revision Instructions
${bible.revisionInstructions || '(none)'}
`;
}
