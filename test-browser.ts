// Quick test: can Playwright open a VISIBLE browser window?
import { chromium } from 'playwright';

async function test() {
  console.log('Launching Chromium with maximum visibility flags...');
  
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--start-maximized',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-position=100,100',
      '--window-size=1200,800',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1200, height: 800 },
  });

  const page = await context.newPage();
  console.log('Browser launched! Navigating to google.com...');
  
  await page.goto('https://www.google.com', { timeout: 30000 });
  console.log('Page loaded! Title:', await page.title());
  console.log('');
  console.log('If you can see a browser window, Playwright is working.');
  console.log('Closing in 10 seconds...');
  
  await page.waitForTimeout(10000);
  await browser.close();
  console.log('Done!');
}

test().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
