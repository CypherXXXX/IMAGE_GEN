# Setup Guide

## Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org/)
- **Windows 10/11**
- **ChatGPT account** (Plus or Pro recommended for higher limits)

## Step 1: Install dependencies

```bash
cd d:\Prog\IMAGE_GEN
npm install
```

## Step 2: Install Playwright Chromium

```bash
npx playwright install chromium
```

This downloads the Chromium browser binary that Playwright uses.

## Step 3: Log in to ChatGPT

```bash
npm run login
```

This opens a Chromium browser window. You need to:

1. Navigate to `chatgpt.com` (it should load automatically)
2. Click "Log in"
3. Enter your credentials
4. Complete any CAPTCHA or verification
5. Once you see the ChatGPT interface, **close the browser window**

Your login session is now saved in `browser-profiles/chatgpt-main/`. Future automation runs will reuse this session.

> **Important**: If your session expires, run `npm run login` again.

## Step 4: Prepare reference images

Place your style reference images in:

```
d:\Prog\IMAGE_GEN\reference-images\
```

Supported formats: PNG, JPG, JPEG, WebP, GIF, BMP

These images define the visual identity you want. They will be uploaded to ChatGPT with the first prompt.

## Step 5: Prepare your prompts

Create a text file with your prompts (or paste them in the dashboard). See `sample-prompts.txt` for the format.

## Step 6: Start the application

```bash
npm run dev
```

Open **http://localhost:3847** in your browser.

## Step 7: Configure and run

1. **Scan Reference Folder** — loads your reference images
2. **Paste or load prompts** — enter your prompt list
3. **Parse Prompts** — validates and previews the queue
4. **Launch Browser** — opens the automation browser with your saved session
5. **Set batch name** — give your batch a descriptive name
6. **Start Batch** — begins processing

## Browser Session Options

### Option 1: Persistent Profile (Default, Recommended)

The default approach. Creates a dedicated Chromium profile at `browser-profiles/chatgpt-main/`.

### Option 2: CDP Connection

If you want to use your existing Chrome browser:

1. Close all Chrome windows
2. Open Chrome with remote debugging:
   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
   ```
3. Log in to ChatGPT in this Chrome instance
4. In the dashboard, select "Connect via CDP"
5. Launch browser

## Folder Structure

After running, your output appears in:

```
d:\Prog\IMAGE_GEN\
├── reference-images/       ← Your style reference images (put them here)
├── browser-profiles/       ← Saved browser sessions (auto-managed)
├── batches/                ← Generated output (one folder per batch)
│   └── 2026-09-16_.../
│       ├── images/         ← Your generated images!
│       ├── style-anchor/   ← Approved first image + style bible
│       └── ...
└── ...
```
