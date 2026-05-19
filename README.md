# Ghost TA

> **The TA you wish you had** — an autonomous AI agent that listens to your lecture and writes your study guide before class ends.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Claude](https://img.shields.io/badge/Claude-Sonnet%204.5-orange?logo=anthropic)
![License](https://img.shields.io/badge/license-MIT-green)

**Spy-Hacks 2026 · Stevens Institute of Technology · April 30 – May 1, 2026**  
Track: Project Track · Theme: "Agentic AI for Campus Life"  
Team: Aditya Patel · Jeel Patel · Saket Kachchhi

---

## The 30-second pitch

The average graduate student attends ~250 hours of lectures per semester and
retains less than 30 minutes of testable content from each one. **Otter
transcribes. Notion summarizes. Neither tells you what's on the exam.**

Ghost TA is different — it's a live, agentic system. As the lecture plays, a
Claude Sonnet 4.5 agent loop scores professor emphasis cues, generates
predicted exam questions, captures assignments mentioned in passing, and
emits all of it as a study guide that writes itself in real-time.

Multilingual out of the box: Spanish lecture → English study guide. Hindi
lecture → French study guide. Whisper auto-detects the source language;
Claude translates the output into your chosen target language while keeping
formulas, code, and proper nouns intact.

---

## Demo

| Resource    | Link                                                              |
| ----------- | ----------------------------------------------------------------- |
| Live URL    | _Deploy to Vercel — add `OPENAI_API_KEY` + `OPENROUTER_API_KEY`_ |
| Source      | https://github.com/Saketkachchhi/ghost-ta                         |

---

## What sets it apart

1. **Genuinely agentic — not a chatbot, not a transcript tool.**
   Claude Sonnet 4.5 with tool use. Five tools the agent reasons over per
   60-second chunk: `extract_concepts`, `update_concept`, `flag_assignment`,
   `flag_unclear`, `set_topic_summary`. A confusing passage gets a different
   tool path than a formal definition. A chatbot wouldn't make these decisions.

2. **The `.ics` calendar export.**
   When the professor mentions "this is due next Friday," the agent extracts
   title, due date, and requirements as a structured assignment. One click
   downloads a valid RFC 5545 `.ics` file with a 24-hour reminder — imports
   into Google Calendar, Apple Calendar, and Outlook.

3. **Click-to-jump audio playback.**
   Every concept card carries the timestamp where it was first detected.
   Click `▶ 4:32` and the lecture audio jumps and plays from that moment.
   Pairs with the live transcript drawer for full traceability.

4. **Multilingual without complexity.**
   16 input/output languages. Auto-detect on the input side, dropdown on the
   output side. The agent's system prompt dynamically rewrites itself per
   target language; assignment source quotes intentionally stay in the
   lecture's original language so students can find them in the audio.

5. **Proctored "Quiz me" mode.**
   Hides all concept definitions and lets the student work through practice
   questions. Anti-cheat detection watches for tab switches and window focus
   loss — violations terminate the quiz and show a debrief overlay.

6. **Three export formats.**
   - **Anki CSV** — concepts and practice questions become flashcards
   - **Markdown** — write-up form for notes and review
   - **PDF** — paper-ready study guide via the print stylesheet

---

## Architecture

```
                   ┌──────────────────────────┐
                   │  Browser (Next.js + SSE) │
                   └────────────┬─────────────┘
                                │ POST /api/upload
                                ▼
              ┌──────────────────────────────────┐
              │   Next.js Route Handler (Node)   │
              │   - persists session             │
              │   - kicks runPipeline()          │
              └────────────┬─────────────────────┘
                           ▼
       ┌────────────────────────────────────────────┐
       │         ffmpeg (60-second segments)        │
       └────────────┬───────────────────────────────┘
                    ▼
        ╭─── Parallel Whisper workers (×4) ────╮
        │   OpenAI whisper-1                   │
        │   source_language = auto / en / ...  │
        ╰────────────┬─────────────────────────╯
                     ▼  in-order pipeline
       ┌──────────────────────────────────────────┐
       │   Claude Sonnet 4.5 via OpenRouter       │
       │   - 5 tools, OpenAI-compat tool_calls    │
       │   - target_language inlined in prompt    │
       └────────────┬─────────────────────────────┘
                    ▼
            ┌────────────────┐
            │  In-memory     │
            │  session state │
            │  + event bus   │
            └────────┬───────┘
                     ▼
           ┌────────────────────┐
           │  GET /api/stream   │   Server-Sent Events
           │  (SSE, heartbeat)  │   transcript / concept /
           └─────────┬──────────┘   assignment / question /
                     ▼               topic_summary / done
          ┌──────────────────────┐
          │ React UI updates     │
          │ live as events fire  │
          └──────────────────────┘
```

**Why these choices?**

- **Server-Sent Events over WebSockets** — one-way data flow, works through
  Vercel's edge runtime, no protocol negotiation.
- **OpenRouter for Claude** — single billing relationship for the team,
  reuses the same OpenAI SDK we already need for Whisper, identical
  tool-use semantics.
- **In-memory session store** — no DB schema decisions, no migrations,
  no leaks. Resets on server restart; appropriate for a hackathon demo.
- **ffmpeg server-side** — battle-tested chunking; browser-side streaming
  audio is a multi-hour rabbit hole with inconsistent codec support.

---

## Feature inventory

### Listening pipeline
- ffmpeg segment-muxer chunks audio into 60-second pieces
- 4-worker parallel Whisper transcription (≥4× faster than sequential)
- Single sequential agent loop walks chunks in order, polls for transcripts
- 16 source languages (auto-detect default)
- 16 target languages for the study guide output

### Agent (Claude Sonnet 4.5 via OpenRouter)
- 5 typed tools, capped at 4 tool-call iterations per chunk
- Concept dedupe + 10-concept cap with replace-the-lowest heuristic
- Conservative assignment detection (clear deliverable + due date or skip)
- Verbatim source quotes stay in the lecture's original language
- Dynamic system prompt: target-language instruction injected per session

### UI / UX
- Three-column layout: controls / study guide / assignments + office hours
- Audio and video file support (.mp3, .wav, .m4a, .mp4, .mov, .webm)
- Audio player with click-to-jump from any concept's timestamp
- Live "Listening" status pill with pulsing indicator
- Live transcript drawer (slide-in Sheet) with auto-scroll and clickable timestamps
- Proctored Quiz Me mode with anti-cheat tab/window detection
- Completion stats banner with processing time and language summary
- Empty states with clear onboarding copy
- Animated card fade-ins (framer-motion)
- Dark theme, shadcn token-based color system

### Exports
- **Markdown** — `/api/export?session_id=...` returns `.md`
- **Anki CSV** — `/api/anki?session_id=...` returns flashcards
  (one per concept + one per practice question, tagged for filtering in Anki)
- **PDF** — expand-all + print stylesheet, print-only header with topic summary
- **Calendar (.ics)** — per assignment, RFC 5545, 24h reminder, opens in
  Google / Apple / Outlook

---

## Tech stack

| Layer            | Technology                                                                           |
| ---------------- | ------------------------------------------------------------------------------------ |
| Framework        | Next.js 16 (App Router) + Turbopack                                                  |
| UI library       | React 19 + Tailwind v4 + shadcn/ui (radix-nova) + framer-motion + lucide-react       |
| Transcription    | OpenAI Whisper (`whisper-1`)                                                         |
| Agent            | Claude Sonnet 4.5 via OpenRouter (OpenAI-compatible API)                             |
| Audio chunking   | `ffmpeg` (system binary on PATH)                                                     |
| Streaming        | Server-Sent Events (native fetch + EventSource)                                      |
| Calendar export  | `ics` npm package (RFC 5545)                                                         |
| State            | In-memory `Map` + tiny event bus, scoped by `session_id`                             |
| Hosting          | Vercel (free tier)                                                                   |

---

## Setup

### Prerequisites
- Node.js 20 or newer
- `ffmpeg` on PATH:
  - **macOS:** `brew install ffmpeg`
  - **Windows:** `winget install Gyan.FFmpeg`
  - **Linux:** `apt install ffmpeg`
- An **OpenAI API key** (for Whisper transcription) — https://platform.openai.com
- An **OpenRouter API key** (for Claude via OpenRouter) — https://openrouter.ai/keys

### Run locally

```bash
git clone https://github.com/Saketkachchhi/ghost-ta.git
cd ghost-ta
cp .env.example .env.local
# edit .env.local — paste your OPENAI_API_KEY and OPENROUTER_API_KEY
npm install
npm run dev
```

Open http://localhost:3000 → select languages → drop a lecture audio or video file.

### Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Then in the Vercel dashboard → Project → Settings → Environment Variables:

| Name                   | Value                                 |
| ---------------------- | ------------------------------------- |
| `OPENAI_API_KEY`       | `sk-proj-...` (Whisper)               |
| `OPENROUTER_API_KEY`   | `sk-or-v1-...` (Claude via OpenRouter) |
| `NODE_ENV`             | `production`                          |

Redeploy. ffmpeg is preinstalled on Vercel's Node runtime.

---

## API routes

| Route                                | Method | Purpose                                                               |
| ------------------------------------ | ------ | --------------------------------------------------------------------- |
| `/api/upload`                        | POST   | Accept audio + language fields, kick the pipeline, return `session_id` |
| `/api/stream?session_id=...`         | GET    | Server-Sent Events stream of agent events                             |
| `/api/status?session_id=...`         | GET    | Polling fallback if SSE is blocked by a proxy                         |
| `/api/export?session_id=...`         | GET    | Download the study guide as Markdown                                  |
| `/api/anki?session_id=...`           | GET    | Download Anki-compatible flashcard CSV                                |
| `/api/calendar/[id]?session_id=...`  | GET    | Download a single assignment as a `.ics` calendar file                |

---

## Project layout

```
app/
  api/
    upload/route.ts          ─ pipeline kickoff (parallel Whisper + sequential agent)
    stream/route.ts          ─ SSE with heartbeat
    status/route.ts          ─ polling fallback
    export/route.ts          ─ Markdown export
    anki/route.ts            ─ Anki CSV export
    calendar/[id]/route.ts   ─ .ics export
  layout.tsx · page.tsx · globals.css

components/
  AudioUploader · MediaPlayer · LectureProgress · LanguageSelector ·
  ConceptCard · AssignmentCard · QuestionList · TranscriptSheet ·
  ExportBar · StatsBanner · QuizGuard
components/ui/              ─ shadcn primitives (button, card, progress,
                              badge, separator, scroll-area, select, sheet)

lib/
  agent.ts                   ─ Claude agent loop + 5 tool definitions
  whisper.ts                 ─ OpenAI Whisper wrapper (language optional)
  ffmpeg.ts                  ─ 60-second audio chunking helper
  ics.ts                     ─ assignment → .ics with 24h reminder
  state.ts                   ─ in-memory session + event bus
  types.ts                   ─ shared types + LANGUAGES list + CHUNK_SECONDS
  utils.ts                   ─ shadcn `cn()` helper
```

---

## Performance

| Metric                                | Sequential            | Pipelined (current)   |
| ------------------------------------- | --------------------- | --------------------- |
| Chunk size                            | 30s                   | 60s                   |
| Chunks for a 43-min lecture           | 87                    | 44                    |
| Avg Whisper latency per chunk         | ~5s                   | ~5s × 4 in parallel   |
| Avg Claude latency per chunk          | ~3–5s (sequential)    | ~3–5s (sequential)    |
| End-to-end wall time (43-min lecture) | ~14 min               | **~3–4 min**          |
| First concept visible after upload    | ~15s                  | **~15s**              |

The first concept appears within ~15 seconds of upload because chunk 1's
transcript completes and feeds the agent before later chunks finish.

---

## Out of scope (intentional)

These were debated and explicitly cut to keep the demo tight:

- **User accounts / login / persistence** — the value prop is the agent
  output, not a user table. Each session is in-memory and ephemeral.
- **Live mic capture in browser** — we use file upload. Browser audio is a
  4-hour rabbit hole and the demo file is more controllable.
- **LMS integrations** (Canvas, Google Classroom, Blackboard) — defer to v2.
- **Push notifications / email reminders** — `.ics` export hands off to the
  user's existing calendar; we don't build a fourth notification source.
- **Mobile-responsive layout** — desktop demo only.

---

## What we'd build next

- **Browser microphone capture** for in-room real-time use
- **Local Whisper** (whisper.cpp) so audio never leaves the device — a
  privacy story for university accessibility offices
- **Canvas / Google Classroom** integration to auto-attach study guides to courses
- **"Quiz me" deepening** — spaced repetition scheduling for concept cards
- **Per-class persistent study guides** with cross-lecture concept linking
- **Speaker diarization** (TA vs professor vs student questions)

---

## AI disclosure *(per Spy-Hacks rules)*

- **Claude Code (Opus 4.7, 1M context window)** was used as a pair-programming
  assistant for the entire build:
  - Drafted the initial Next.js scaffolding and project structure
  - Wrote the agent system prompt, tool schemas, and the OpenAI SDK ↔ OpenRouter
    integration from scratch
  - Refactored from the native Anthropic SDK to OpenRouter when we decided on
    a single billing relationship
  - Implemented multilingual support, Anki export, PDF print stylesheet, and
    the live transcript drawer
  - All architecture decisions, scope decisions, and product trade-offs were
    made by the team — Claude Code executed against our judgment calls
- **No code was written by an LLM without human review and editing.**
- The Claude Sonnet 4.5 model running inside the product (the agent loop) is
  the product itself, not a development tool.
- Whisper (`whisper-1`) is a third-party transcription service used at runtime.

---

## Team

| Name              | Lane             | Background                                       |
| ----------------- | ---------------- | ------------------------------------------------ |
| Aditya Patel      | Backend + Agent  | LLM tooling, agent loops, system design          |
| Jeel Patel        | Frontend + UX    | Next.js, React, real-time UIs                    |
| Saket Kachchhi    | Project lead     | Storytelling, screen recording, judge Q&A        |

All three are F-1 international graduate students at Stevens Institute of
Technology. We've all sat through lectures in our second language trying to
figure out what mattered. Ghost TA is built from real frustration.

---

## License

MIT — see [LICENSE](LICENSE) for full text. Use it, fork it, ship it.

---

## Credits

- **OpenAI Whisper** — speech-to-text
- **Anthropic Claude Sonnet 4.5** — the agent reasoning
- **OpenRouter** — model routing
- **Vercel** — hosting + edge runtime
- **shadcn/ui** — UI primitives
- **Radix UI** — accessibility primitives under shadcn
- **MIT OpenCourseWare** — demo lecture material (CC-BY-NC-SA)

Built in 24 hours. Imagine what it looks like with another month.
