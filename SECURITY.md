# Security

## Principles

1. **No credentials stored**: The app never asks for or stores your ChatGPT password.
2. **No cookie export**: Authentication is handled by a persistent Chromium browser profile, not by extracting cookies.
3. **No API key required**: The app uses the ChatGPT web UI, not the OpenAI API.
4. **No bypass attempts**: The app never attempts to bypass CAPTCHA, human verification, rate limits, or content policy.
5. **No private API usage**: No reverse-engineered or undocumented ChatGPT endpoints are used.

## Browser Profile Security

- The persistent browser profile is stored locally at `browser-profiles/chatgpt-main/`
- This directory contains your ChatGPT session data (cookies, local storage)
- **Do not share this directory** — it grants access to your ChatGPT account
- Add `browser-profiles/` to `.gitignore` (already excluded in the project)

## Data Storage

- All generated images and metadata are stored locally in `batches/`
- Logs are stored locally in each batch's `logs/` directory
- No data is sent to external servers (besides the normal ChatGPT interaction)

## Best Practices

1. **Use a dedicated ChatGPT account** for automation if you have one
2. **Don't run on shared computers** without securing the browser profile directory
3. **Review generated images** before using them commercially
4. **Respect ChatGPT's Terms of Service** — automated interactions may violate OpenAI's terms
5. **Don't circumvent limits** — if you hit a limit, wait for the reset

## File Permissions

The following directories contain sensitive data:
```
browser-profiles/     ← ChatGPT session data
batches/              ← Generated images and metadata
```

Ensure these directories are not accessible to other users on shared systems.
