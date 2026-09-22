import { loadConfig } from './config';
import fs from 'fs';
import { execSync, spawn } from 'child_process';

/**
 * Login helper — opens your real Chrome browser with a dedicated profile
 * so you can log in to ChatGPT manually.
 *
 * Usage: npm run login
 *
 * After logging in, close the browser. The session will persist for future automation runs.
 */
async function login() {
  const config = loadConfig();
  const profileDir = config.defaultProfileDir;
  const port = config.cdpPort || 9222;

  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  ChatGPT Login Setup                      ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');
  console.log(`Profile directory: ${profileDir}`);
  console.log('');
  console.log('A Chrome browser will open. Please:');
  console.log('  1. Navigate to https://chatgpt.com (if not already)');
  console.log('  2. Log in with your account');
  console.log('  3. Complete any verification if prompted');
  console.log('  4. Once logged in, close the browser window');
  console.log('');
  console.log('Your login session will be saved and reused for automation.');
  console.log('');

  fs.mkdirSync(profileDir, { recursive: true });

  // Find Chrome
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  ];

  let chromePath = '';
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      chromePath = p;
      break;
    }
  }

  if (!chromePath) {
    try {
      chromePath = execSync('where chrome.exe 2>nul', { encoding: 'utf-8' }).trim().split('\n')[0].trim();
    } catch { }
  }

  if (!chromePath) {
    console.error('❌ Chrome not found. Please install Google Chrome.');
    process.exit(1);
  }

  console.log(`🌐 Opening Chrome: ${chromePath}`);
  console.log(`   Profile: ${profileDir}`);
  console.log('');

  // Launch Chrome with the dedicated profile
  const chromeArgs = [
    `--user-data-dir="${profileDir}"`,
    '--no-first-run',
    '--no-default-browser-check',
    '--start-maximized',
    'https://chatgpt.com',
  ];

  if (process.platform === 'win32') {
    execSync(`start "" "${chromePath}" ${chromeArgs.join(' ')}`);
  } else {
    const child = spawn(chromePath, chromeArgs.map(arg => arg.replace(/"/g, '')), {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  }

  console.log('✅ Chrome opened! Log in to ChatGPT, then close the browser window.');
  console.log('   Your session will be saved automatically in the profile directory.');
  console.log('');
  console.log('   After login, you can start the studio with: npm run dev');
}

login().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
