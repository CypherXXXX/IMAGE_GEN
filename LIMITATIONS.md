# Known Limitations

## Style Consistency

- **Not pixel-perfect**: ChatGPT's image model cannot guarantee identical styles across separate generations. The Style Bible provides the strongest practical consistency through careful prompt engineering, but visual drift may occur.
- **New chats lose some context**: When a new chat starts (every 10 images), style consistency relies on re-uploaded references and text descriptions rather than conversation memory.
- **No image-to-image transfer**: The app uses text-based style descriptions, not image-to-image transfer. ChatGPT's web UI does not support explicit style transfer.

## ChatGPT Limits

- **Usage caps are dynamic**: ChatGPT's image generation limits vary by plan and server load. The app cannot predict when you'll hit a limit.
- **No reliable limit indicator**: The app cannot read your remaining generation quota from the UI. It stops when ChatGPT shows a limit message.
- **Free tier**: 2-3 images per 24 hours — not practical for batch generation.
- **Plus tier**: ~50 prompts per 3 hours — supports batches of 30+ but may require pauses.
- **Pro tier**: Highest limits — best for large batches.

## Browser Automation

- **Selectors are fragile**: ChatGPT's DOM structure changes frequently. Selectors in `src/chatgpt/selectors.ts` may need updating when the UI changes.
- **No headless mode**: Running headless increases bot detection risk. The app runs in headed mode by default.
- **Session expiry**: Browser sessions expire after some time. You may need to re-run `npm run login`.
- **One instance at a time**: Only one automation instance should run per browser profile to avoid conflicts.

## Image Detection & Download

- **Preview vs. original**: The detected preview image URL may differ from the full-resolution download URL. The app tries multiple download strategies.
- **WebP format**: ChatGPT often serves images in WebP format rather than PNG. The app saves whatever format is provided.
- **CDN expiry**: Image URLs from ChatGPT's CDN may expire. Download happens immediately after detection.

## Queue & Resume

- **Not real-time synced**: If ChatGPT generated an image during a crash, the app cannot detect it after restart. It will regenerate the prompt.
- **Manual verification required**: After resume, verify that no duplicate images were created.
- **File-based persistence**: Uses JSON files on disk, not a database. Suitable for single-user local use.

## Concurrency

- **Sequential only**: The app processes one prompt at a time. No parallel generation.
- **No multi-account**: One browser profile per session. No automatic account switching.

## Platform

- **Windows only tested**: Designed for Windows. May work on macOS/Linux with path adjustments.
- **Local only**: Runs on localhost. No remote/cloud deployment support.
