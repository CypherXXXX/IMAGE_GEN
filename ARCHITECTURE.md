# Architecture

## Chosen Architecture: Hybrid (Antigravity develop + Playwright runtime + Persistent Profile)

### Why this architecture?

| Criteria | Direct Playwright | MCP | AI Browser Agent |
|----------|-------------------|-----|------------------|
| **Reliability** | ★★★★★ | ★★★ | ★★ |
| **Determinism** | ★★★★★ | ★★★ | ★★ |
| **Session stability** | ★★★★★ | ★★★★ | ★★ |
| **Recovery** | ★★★★★ | ★★★ | ★ |
| **Simplicity** | ★★★★ | ★★★ | ★ |

**Decision**: For a long-running batch job processing 30+ images, direct Playwright scripting is far more reliable than having an AI agent interpret the UI through natural language on each action.

### System Diagram

```
┌─────────────────────────────────────────────────────┐
│  User's Browser (Dashboard)                         │
│  http://localhost:3847                               │
│  ┌──────┬────────┬───────┬─────────┐                │
│  │Setup │ Review │ Queue │ History │                │
│  └──────┴────────┴───────┴─────────┘                │
│                    ↕ WebSocket + REST                │
└─────────────────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │  Express Server         │
        │  (API + WebSocket)      │
        └────────────┬────────────┘
                     │
        ┌────────────┴────────────┐
        │  Batch Orchestrator     │
        │  ┌─────────────────┐    │
        │  │ Queue Manager   │    │
        │  │ Style Anchor    │    │
        │  │ Prompt Builder  │    │
        │  └─────────────────┘    │
        └────────────┬────────────┘
                     │
        ┌────────────┴────────────┐
        │  Playwright (Direct)    │
        │  ┌─────────────────┐    │
        │  │ Persistent      │    │
        │  │ Chromium Profile │   │
        │  └─────────────────┘    │
        └────────────┬────────────┘
                     │
        ┌────────────┴────────────┐
        │  ChatGPT Web UI         │
        │  chatgpt.com            │
        └─────────────────────────┘
```

### Key Components

#### Browser Session Management
- **Primary**: `launchPersistentContext()` — Chromium profile saved at `browser-profiles/chatgpt-main/`
- **Secondary**: `connectOverCDP()` — attach to existing Chrome with `--remote-debugging-port=9222`
- Anti-detection measures (disable automation flags, custom user agent)

#### Image Generation Detection
Multi-signal approach (not fixed timeouts):
1. Count assistant messages before submission
2. Wait for new assistant message to appear
3. Monitor stop button disappearance
4. Check for image elements in new message
5. Verify image URL is valid (not placeholder)

#### Chat Rotation (10 per chat)
```
Chat 1: prompts 1-10 (prompt 1 is the approval gate)
Chat 2: prompts 11-20 (new chat, re-uploads style anchor)
Chat 3: prompts 21-30
...
```

#### Style Consistency System
```
Reference Images + First Prompt → Generate → User Review
                                              │
                           ┌──────────────────┴──────────────────┐
                           │ Approve                              │ Reject
                           ↓                                      ↓
                   Style Bible Generated              Revision Instructions
                   Style Prefix Locked                Re-generate Prompt 1
                           │
              ┌────────────┴────────────┐
              │ Same Chat (prompts 2-10)│
              │ Short style reminder    │
              └────────────┬────────────┘
                           │
              ┌────────────┴────────────┐
              │ New Chat (prompts 11+)  │
              │ Full style bible        │
              │ Re-upload references    │
              └─────────────────────────┘
```

#### File Persistence
- All state in JSON files with atomic writes (write `.tmp` → rename)
- `progress.json` — batch state machine
- `metadata/NNN.json` — per-image metadata
- Never overwrites existing successful files
- Resume-safe: checks disk for completed images before re-generating

### Technology Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Runtime | Node.js 20+ | Playwright's native environment |
| Language | TypeScript | Type safety for complex state machines |
| Browser | Playwright (direct) | Deterministic, persistent contexts |
| Web Server | Express.js | Lightweight, proven |
| Real-time | WebSocket (ws) | Native, no framework overhead |
| Frontend | Vanilla HTML/CSS/JS | No build step, maximum simplicity |
| Storage | JSON/JSONL files | No database dependency |
