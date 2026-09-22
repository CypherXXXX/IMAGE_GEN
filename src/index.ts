import { BatchOrchestrator } from './batch/orchestrator';
import { startServer } from './server/app';
import { loadConfig } from './config';

/**
 * Main entry point for the ChatGPT Image Batch Studio.
 */
async function main() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  ChatGPT Image Batch Automation Studio    ║');
  console.log('║  Version 1.0.0                            ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');

  const config = loadConfig();
  const orchestrator = new BatchOrchestrator();

  // Set up review callback for WebSocket broadcasting
  orchestrator.setReviewCallback((imagePath, promptIndex, prompt) => {
    console.log(`\n🖼️  First image generated for review!`);
    console.log(`   Prompt ${promptIndex}: ${prompt.substring(0, 80)}...`);
    console.log(`   Image: ${imagePath}`);
    console.log(`   → Approve or reject in the dashboard\n`);
  });

  // Start the web server
  await startServer(config, orchestrator);

  console.log('📋 Steps:');
  console.log('   1. Open the dashboard in your browser');
  console.log('   2. Upload reference images to reference-images/ folder');
  console.log('   3. Paste your prompts or load a prompt file');
  console.log('   4. Configure batch settings');
  console.log('   5. Launch browser and start the batch');
  console.log('');
  console.log(`📁 Reference images: ${config.referenceImagesDir}`);
  console.log(`📁 Browser profile: ${config.defaultProfileDir}`);
  console.log(`📁 Output batches: ${config.batchesDir}`);
  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
