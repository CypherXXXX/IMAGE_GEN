# Troubleshooting

## Common Issues

### "Not logged in to ChatGPT"

**Cause**: Your browser session has expired.

**Fix**:
```bash
npm run login
```
Log in again in the browser window, then close it and restart the app.

### CAPTCHA / Verification Loop

**Cause**: ChatGPT detects automation and shows a CAPTCHA.

**Fix**:
1. The app will automatically pause and show a notification
2. Go to the automation browser window
3. Complete the CAPTCHA/verification manually
4. The app will detect completion and resume

**Prevention**:
- Don't run in headless mode
- Use the persistent profile (keeps session "warm")
- Don't run batches too rapidly

### Rate Limit Reached

**Cause**: You've hit ChatGPT's generation limit for your account/plan.

**Fix**:
1. The app pauses automatically
2. Wait for the limit to reset (usually 3 hours for Plus)
3. Resume via the dashboard or restart the app
4. Progress is saved — it will resume from where it stopped

### Browser Disconnected

**Cause**: The browser window was closed or crashed.

**Fix**:
1. Restart the application: `npm run dev`
2. Click "Resume" on the batch in the History tab
3. The app will relaunch the browser and resume from the last completed prompt

### Image Download Fails

**Cause**: ChatGPT's image URL expired or the UI changed.

**Fix**:
- The app retries up to 2 times automatically
- If all retries fail, the prompt is marked as "failed"
- You can retry individual failed prompts from the dashboard
- Check `logs/screenshots/` for diagnostic screenshots

### Selectors Not Working (UI Changed)

**Cause**: ChatGPT updated their web UI, breaking CSS selectors.

**Fix**:
1. Open `src/chatgpt/selectors.ts`
2. Use browser DevTools to inspect the current ChatGPT UI
3. Update the affected selectors
4. Rebuild: `npm run build`

### Port Already in Use

**Cause**: Another application is using port 3847.

**Fix**: Change the port in `config.json`:
```json
{ "serverPort": 3850 }
```

### Empty Reference Images Gallery

**Cause**: No images in the `reference-images/` folder.

**Fix**:
1. Place your reference images in `d:\Prog\IMAGE_GEN\reference-images\`
2. Supported formats: PNG, JPG, JPEG, WebP, GIF, BMP
3. Click "Scan Reference Folder" in the dashboard

## Debug Mode

For more detailed logging, create a `config.json`:

```json
{
  "logLevel": "DEBUG",
  "slowMo": 200
}
```

This slows down browser actions and produces verbose logs.

## Getting Help

1. Check `batches/<your-batch>/logs/events.jsonl` for detailed event logs
2. Check `batches/<your-batch>/logs/errors/` for error details
3. Check `batches/<your-batch>/logs/screenshots/` for diagnostic screenshots
