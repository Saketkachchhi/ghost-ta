# Ghost TA — Project Documentation

> **The TA you wish you had** — an autonomous AI agent that listens to your lecture and writes your study guide before class ends.

**Spy-Hacks 2026 · Stevens Institute of Technology · April 30 – May 1, 2026**
**Track:** Project Track · **Theme:** Agentic AI for Campus Life
**Repo:** https://github.com/Saketkachchhi/ghost-ta
**Status:** Submission ready · 17 commits on `main`

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [The team](#2-the-team)
3. [Problem statement](#3-problem-statement)
4. [Solution overview](#4-solution-overview)
5. [Architecture](#5-architecture)
6. [Tech stack](#6-tech-stack)
7. [Feature inventory (everything we built)](#7-feature-inventory-everything-we-built)
8. [API surface](#8-api-surface)
9. [Project structure](#9-project-structure)
10. [Code highlights](#10-code-highlights)
11. [Performance](#11-performance)
12. [Setup and running locally](#12-setup-and-running-locally)
13. [Deployment](#13-deployment)
14. [Out of scope (intentional decisions)](#14-out-of-scope-intentional-decisions)
15. [Future roadmap](#15-future-roadmap)
16. [Development timeline (commit history)](#16-development-timeline-commit-history)
17. [Demo flow for the pitch](#17-demo-flow-for-the-pitch)
18. [Pitch script](#18-pitch-script)
19. [Q&A — pre-prepared answers](#19-qa--pre-prepared-answers)
20. [AI disclosure](#20-ai-disclosure)
21. [License and credits](#21-license-and-credits)

---

## 1. Executive summary

Ghost TA is a real-time AI agent that ingests a lecture audio or video file and produces a structured study guide while the lecture is still being processed. It transcribes the audio in 30-second windows via OpenAI Whisper, feeds the transcripts into a Claude Sonnet 4.5 agent loop with five typed tools, and streams every output as a Server-Sent Event to a React UI that visibly writes itself.

The product spans a multilingual transcription pipeline (16 input + 16 output languages), an embedded media player with click-to-jump from any concept's timestamp, four export formats (Anki flashcards, Markdown, PDF, calendar `.ics` files for assignments), a slide-in transcript drawer, and a proctored "Quiz me" mode with anti-cheat detection that ends the quiz if the student switches tabs or windows.

It was built in 24 hours by three F-1 international graduate students at Stevens Institute of Technology for Spy-Hacks 2026. The architecture is intentionally minimal — Next.js 16 with API routes, in-memory session state, no database — but the surface area is broad: 30+ source files, 8 API routes, 12+ React components, 5 agent tools, 3 export formats, and a complete print stylesheet for paper/PDF.

---

## 2. The team

| Name              | Lane             | Background                                  |
| ----------------- | ---------------- | ------------------------------------------- |
| Aditya Patel      | Backend + Agent  | LLM tooling, agent loops, system design     |
| Jeel Patel        | Frontend + UX    | Next.js, React, real-time UIs               |
| Saket Kachchhi    | Demo + Pitch     | Storytelling, screen recording, judge Q&A   |

All three are F-1 international graduate students at Stevens. We've all sat through lectures in our second language trying to figure out what mattered. Ghost TA is built from real frustration with that experience.

---

## 3. Problem statement

The average graduate student attends approximately 250 hours of lectures per semester and retains less than 30 minutes of testable content from each one. Existing tools fail in specific, repeatable ways:

| Tool         | What it does            | What's missing                                                   |
| ------------ | ----------------------- | ---------------------------------------------------------------- |
| Otter        | Passive transcription   | No emphasis scoring, no exam prediction                          |
| Fireflies    | Meeting transcription   | Designed for sales calls, not academic emphasis cues             |
| Notion AI    | Post-hoc summarization  | Runs after class — too late to ask the professor a clarifying Q  |
| ChatGPT      | Chat over a transcript  | No real-time streaming, no structured tool use, no calendar/Anki |

The most important signal in a lecture is **what the professor emphasized** — what they repeated, what they slowed down for, what they said is "on the exam," what they wrote on the board. None of the existing tools listen for that signal.

Additionally, no tool extracts assignments mentioned mid-lecture and pushes them to a calendar. Students miss deadlines because they were trying to keep up with the lecture content and didn't write down the homework in time.

---

## 4. Solution overview

Ghost TA is an **active agent**, not a transcription tool. As the lecture audio plays, Claude Sonnet 4.5 runs five typed tools per chunk and decides which to call:

1. `extract_concepts` — pull new concepts with definition + emphasis score
2. `update_concept` — refine an existing concept's definition or bump emphasis
3. `flag_assignment` — extract title, due date, requirements, and source quote
4. `flag_unclear` — mark passages that were rushed or ambiguous
5. `set_topic_summary` — maintain a one-sentence summary of the lecture

The output streams to the UI in real time over Server-Sent Events. Concepts are scored 0–1 on emphasis, sorted with the highest at the top, and rendered as cards with their predicted exam questions. Assignments materialize as cards with a one-click `.ics` download that imports cleanly into Google Calendar, Apple Calendar, or Outlook with a 24-hour reminder pre-set.

Multilingual is built in: Whisper auto-detects the source language; the agent's system prompt dynamically rewrites itself to emit output in the student's chosen target language. A Spanish lecture can produce an English study guide. A Hindi lecture can produce a Japanese one. Formulas, code, and proper nouns stay in their original form.

---

## 5. Architecture

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
       │              ffmpeg (60s segments)         │
       │   Strips audio out of any container —      │
       │   MP3/WAV/M4A/MP4/MOV/WebM all supported   │
       └────────────┬───────────────────────────────┘
                    ▼
        ╭─── Parallel Whisper workers (×4) ────╮
        │   OpenAI whisper-1                   │
        │   source_language=auto/en/es/...     │
        ╰────────────┬─────────────────────────╯
                     ▼ in-order pipeline
       ┌──────────────────────────────────────────┐
       │   Claude Sonnet 4.5 via OpenRouter       │
       │   - 5 typed tools, OpenAI-compat format  │
       │   - target_language inlined in prompt    │
       │   - 4 max iterations per chunk           │
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

### Architectural decisions

**Server-Sent Events over WebSockets** — one-way data flow, works through Vercel's edge runtime, no protocol negotiation overhead. SSE is automatically reconnecting and handles back-pressure naturally.

**OpenRouter for Claude instead of the native Anthropic SDK** — single billing relationship for the team across providers, reuses the same OpenAI SDK we already need for Whisper, identical tool-use semantics. Trade-off: one more network hop adds ~50ms latency per agent call. Acceptable for a 3–5 minute end-to-end pipeline.

**In-memory session store** — no database schema decisions, no migrations, no leaks. Sessions reset on server restart. Appropriate for a hackathon demo where each session is a one-off and persistence is out of scope.

**ffmpeg server-side, not browser-side** — battle-tested chunking, handles every container format (MP3/WAV/M4A/MP4/MOV/WebM) with zero codec-specific code. The alternative — streaming raw audio chunks from the browser via `getUserMedia` and the Web Audio API — is a four-hour rabbit hole on its own and was explicitly out of scope.

**Pipelined Whisper transcription, sequential agent loop** — Whisper calls are independent per chunk so we run 4 in parallel; the agent must process chunks in order because each call references the running guide state, so the agent is sequential. Using a producer-consumer pipeline, transcription and agent work overlap: the first concepts appear ~10 seconds after upload even though the full 60-minute lecture takes 5–8 minutes to fully process.

---

## 6. Tech stack

| Layer            | Technology                                                              | Version       |
| ---------------- | ----------------------------------------------------------------------- | ------------- |
| Framework        | Next.js (App Router) + Turbopack                                         | 16.2.4        |
| Runtime          | Node.js (server) / React 19 (client)                                     | Node 20+      |
| UI               | Tailwind CSS v4 + shadcn/ui (radix-nova) + framer-motion + lucide-react  | various       |
| Transcription    | OpenAI Whisper (`whisper-1`)                                             | API           |
| Agent            | Claude Sonnet 4.5 via OpenRouter (OpenAI-compatible API)                 | model 4.5     |
| Audio chunking   | `ffmpeg` (system binary on PATH)                                         | 7.x or newer  |
| Streaming        | Server-Sent Events (native fetch + EventSource)                          | spec          |
| Calendar export  | `ics` npm package (RFC 5545)                                             | ^3.8.1        |
| State            | In-memory `Map` + tiny event bus, scoped by `session_id`                 | n/a           |
| Hosting          | Vercel (free tier)                                                        | n/a           |

### NPM dependencies

```json
{
  "dependencies": {
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "framer-motion": "^11.11.17",
    "ics": "^3.8.1",
    "lucide-react": "^1.14.0",
    "next": "16.2.4",
    "openai": "^4.73.1",
    "radix-ui": "^1.4.3",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "shadcn": "^4.6.0",
    "tailwind-merge": "^3.5.0",
    "tw-animate-css": "^1.4.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.4",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

The native Anthropic SDK was removed during development — we run Claude via the OpenAI SDK pointed at OpenRouter's compatible endpoint instead.

---

## 7. Feature inventory (everything we built)

### 7.1 Listening pipeline

- **ffmpeg segment muxer** chunks any audio or video file into 60-second pieces. Single command handles MP3, WAV, M4A, MP4, MOV, WebM, MKV, AVI, OGG, FLAC, AAC, OPUS.
- **4-worker parallel Whisper transcription**. A simple semaphore loop pulls chunks off a shared counter. Effective speedup is 4× for long lectures.
- **Single sequential agent loop** walks chunks in order, polling for transcripts. This is the producer-consumer pipeline.
- **First concept appears at ~10 seconds** after upload because chunk 1 finishes Whisper before chunks 2–N do.

### 7.2 Multilingual support

| Language               | ISO code | Source ✓ | Target ✓ |
| ---------------------- | -------- | -------- | -------- |
| Auto-detect            | `auto`   | ✓        | —        |
| English                | `en`     | ✓        | ✓        |
| Spanish (Español)      | `es`     | ✓        | ✓        |
| French (Français)      | `fr`     | ✓        | ✓        |
| German (Deutsch)       | `de`     | ✓        | ✓        |
| Italian (Italiano)     | `it`     | ✓        | ✓        |
| Portuguese (Português) | `pt`     | ✓        | ✓        |
| Dutch (Nederlands)     | `nl`     | ✓        | ✓        |
| Russian (Русский)      | `ru`     | ✓        | ✓        |
| Polish (Polski)        | `pl`     | ✓        | ✓        |
| Turkish (Türkçe)       | `tr`     | ✓        | ✓        |
| Arabic (العربية)       | `ar`     | ✓        | ✓        |
| Hindi (हिन्दी)         | `hi`     | ✓        | ✓        |
| Japanese (日本語)       | `ja`     | ✓        | ✓        |
| Korean (한국어)          | `ko`     | ✓        | ✓        |
| Chinese (中文)          | `zh`     | ✓        | ✓        |
| Vietnamese (Tiếng Việt) | `vi`    | ✓        | ✓        |

The agent's system prompt dynamically includes a `LANGUAGE INSTRUCTION` block per session: it tells Claude to emit all output in the target language while preserving formulas, code identifiers, and proper nouns in their original form. Assignment source quotes are intentionally kept in the lecture's original language so the student can find them in the audio.

### 7.3 The agent

**Five typed tools, OpenAI-compatible function format:**

#### `extract_concepts`
Adds new concepts not yet in the running guide. Each concept must include `name`, `definition`, and `emphasis` (0–1 score). Concepts with `emphasis >= 0.6` should include 1–3 practice questions.

#### `update_concept`
Refines an existing concept's definition, bumps its emphasis score, or adds practice questions when the lecture re-emphasizes a concept. Names must match exactly.

#### `flag_assignment`
Records an assignment, project, or problem set explicitly mentioned by the professor. Required fields: `title`, `due_date` (ISO YYYY-MM-DD), `source_quote` (verbatim from the lecture, in the original language). Optional: `requirements` array.

#### `flag_unclear`
Marks a passage that was rushed or ambiguous as a question to ask in office hours. Required: `passage`, `drafted_question`.

#### `set_topic_summary`
Updates the one-sentence topic summary for the entire lecture. Called sparingly — only when there's new evidence the topic differs from the current summary.

**Tool-use loop:** capped at 4 iterations per chunk to bound latency. Concept dedupe by case-insensitive name match. 10-concept cap with a replace-the-lowest heuristic when emphasis outranks an existing low-scored concept.

### 7.4 UI surfaces

| Surface              | Component                       | What it does                                                                                                  |
| -------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Header               | `app/page.tsx`                  | Gradient brand wordmark, subtitle, animated "LISTENING/COMPLETE" status pill, transcript + export buttons    |
| Welcome state        | inline in `page.tsx`            | Glowing icon, gradient headline, value prop, 3-up stats grid (16 langs / 5 tools / 4× parallel)              |
| Language selector    | `components/LanguageSelector`   | Two shadcn Selects (source + target)                                                                          |
| Audio uploader       | `components/AudioUploader`      | Drag-drop zone, accepts audio + video MIME types and extensions, "Use bundled demo" link                      |
| Lecture progress     | `components/LectureProgress`    | Custom progress bar with shimmer animation while processing, chunk counter row                               |
| Lecture topic card   | inline in `page.tsx`            | Emerald-bordered card with sun icon and glow orb showing the agent's running topic summary                    |
| Media player         | `components/MediaPlayer`        | Conditionally renders `<audio>` or `<video>` based on file kind, exposes ref for click-to-jump                |
| Concept card         | `components/ConceptCard`        | Definition, emphasis bar, timestamp chip, expandable practice questions, hover lift, glow on high-emphasis   |
| Stats banner         | `components/StatsBanner`        | Appears when status is `done`. Shows concepts / questions / actions / wall time / source→target language    |
| Assignment card      | `components/AssignmentCard`     | Title, due date countdown, "+ Cal" download button, expandable requirements + source quote                    |
| Question list        | `components/QuestionList`       | Office-hours follow-up questions with copy-to-clipboard                                                       |
| Transcript drawer    | `components/TranscriptSheet`    | Slide-in Sheet from the right showing every chunk in order, clickable timestamps, auto-scroll while live    |
| Quiz guard           | `components/QuizGuard`          | Phase-driven proctor: consent dialog, live progress bar, anti-cheat listeners, termination overlay          |
| Export bar           | `components/ExportBar`          | Anki / Markdown / PDF buttons in the header                                                                  |
| Footer               | `app/page.tsx`                  | "Spy-Hacks 2026 · Stevens · Built by Aditya · Jeel · Saket"                                                  |
| Background ambience  | `globals.css` + `page.tsx`      | Dot-grid backdrop pattern + two large gradient orbs (emerald + teal) at fixed -z-10                          |

### 7.5 Click-to-jump audio

Every concept card carries a clickable `▶ MM:SS` chip showing where the concept was first detected. Clicking jumps the embedded media player's `currentTime` to that second and starts playback. The chip is emerald-tinted at rest (large, readable text-xs size) and brightens further on hover.

### 7.6 Live transcript drawer

A slide-in Sheet from the right edge, triggered from the header. Shows every Whisper chunk in order with clickable MM:SS timestamps. Header shows live counters (N chunks · M words) and a pulsing emerald "Live" pill while processing. Auto-scrolls to the latest chunk. Stays accessible after processing completes for review.

### 7.7 Exports

#### Anki CSV
`/api/anki?session_id=...` — emits a 3-column CSV (Front, Back, Tags). One card per concept (front = name, back = definition, tag = `ghost-ta concept emphasis-0.X`) plus one card per practice question (front = question, back = "Tests: <concept>\n\n<definition>", tag = `ghost-ta practice <concept>`). Imports cleanly into Anki desktop via File > Import > Comma-separated.

#### Markdown
`/api/export?session_id=...` — full study guide as Markdown. Concepts ranked by emphasis with text-progress bars, practice questions, assignments, source quotes, office-hours questions.

#### PDF (via print stylesheet)
The PDF button:
1. Sets a `printing` state that forces every concept and assignment card to expand (via a `forceOpen` prop)
2. Calls `window.print()` — user picks "Save as PDF" as the destination
3. Print stylesheet (`@media print` in `globals.css`) hides the upload zone, audio player, status bar, header, all buttons; reflows the 3-column grid into a single full-width column; forces black-on-white; adds `page-break-inside: avoid` to every concept/assignment card; adds a print-only header with the project title and topic summary.

#### Calendar (.ics)
`/api/calendar/[id]?session_id=...` — emits a single RFC 5545 `.ics` file per assignment with a 24-hour-before reminder pre-set. Filename is derived from the assignment title. Opens cleanly in Google Calendar, Apple Calendar, or Outlook.

### 7.8 Proctored Quiz Me mode

Treats the browser as the test environment. Students cannot leave the browser without ending the quiz.

**Phase machine:**
- `off` — idle, no quiz UI
- `consent` — integrity contract dialog open, awaiting accept/decline
- `active` — quiz running, anti-cheat listeners armed, timer ticking
- `terminated` — debrief overlay showing what was detected and stats

**Anti-cheat detection:**
- `document.visibilitychange` (when `document.hidden`) → "Tab switched or window minimized"
- `window.blur` → "Browser window lost focus" (catches alt-tab, clicking another app, dev tools popout)

When detected, all definitions hide back, the phase becomes `terminated`, and a destructive-themed modal locks the page with the violation reason, revealed count, and time before exit. The Acknowledge button is the only way out.

**Live progress bar (active):** emerald banner above the concept list with a pulsing dot, live timer (mm:ss), revealed/total counter, and a thin progress bar that fills as the user reveals each definition.

**Reveal pattern:** in quiz mode, ConceptCard hides the definition behind italic placeholder text. Practice questions remain visible. A green "Reveal definition" button at the bottom of each card flips the definition back on. Reveal state is lifted to `page.tsx` as a `Set<conceptId>` so progress can be counted across all cards.

**Forced open in print:** the `forceOpen` prop overrides quiz mode so PDFs always show full content regardless of toggle state.

### 7.9 Visual presentation polish

- **Brand wordmark** uses an emerald → teal gradient with a blurred glow behind it
- **Hero welcome state** with 80px glowing icon, gradient headline, value prop, and stats grid
- **High-emphasis concept cards** glow emerald and lift on hover (subtle `-translate-y-0.5`)
- **Lecture topic card** has emerald gradient border + sun icon + corner glow
- **Ambient gradient orbs** (emerald + teal) sit fixed at -z-10 behind the page
- **Dot-grid backdrop** (24px pitch, 4% opacity) gives the dark theme depth
- **Shimmering progress bar** — moving gradient sweep across the emerald fill while processing
- **Footer** with hackathon attribution
- **Bigger timestamp chips** (text-xs / size-3.5 icon / emerald-tinted at rest)
- **Animated card fade-ins** via framer-motion

### 7.10 Smart media-kind detection

Files with audio extensions in their name (`.mp3`, `.wav`, `.m4a`, `.flac`, `.ogg`, `.aac`, `.opus`) — even compound names like `demo.mp3.mpeg` — render in an `<audio>` element. Files ending in known video extensions (`.mp4`, `.mov`, `.webm`, `.mkv`, `.avi`) or with a `video/*` MIME type render in a `<video>` element so judges can watch the professor while concepts stream in. Audio-extension match always wins over MIME type to avoid Windows' tendency to tag `.mpeg` as `video/mpeg`.

---

## 8. API surface

| Route                                | Method | Purpose                                                    |
| ------------------------------------ | ------ | ---------------------------------------------------------- |
| `/api/upload`                        | POST   | Accept audio/video + language fields, kick the pipeline, return `session_id` |
| `/api/stream?session_id=...`         | GET    | Server-Sent Events stream of agent events                  |
| `/api/status?session_id=...`         | GET    | Polling fallback if SSE is blocked by a corporate proxy    |
| `/api/export?session_id=...`         | GET    | Download study guide as Markdown                           |
| `/api/anki?session_id=...`           | GET    | Download Anki-compatible flashcard CSV                     |
| `/api/calendar/[id]?session_id=...`  | GET    | Download a single assignment as a `.ics` file              |

### `/api/upload` request

```
POST /api/upload
Content-Type: multipart/form-data

audio:           File          (required — audio or video container)
source_language: string        (optional — default 'auto')
target_language: string        (optional — default 'en')
```

Response:
```json
{ "session_id": "uuid-v4" }
```

The handler returns immediately after kicking off `runPipeline()` as an unawaited promise. The client opens `/api/stream` immediately to receive events.

### Stream event types

```typescript
type StreamEvent =
  | { type: 'status'; status: SessionStatus; chunks_done: number; chunks_total: number }
  | { type: 'transcript'; chunk_index: number; text: string }
  | { type: 'concept'; concept: Concept }
  | { type: 'concept_update'; concept: Concept }
  | { type: 'assignment'; assignment: Assignment }
  | { type: 'question'; question: FlaggedQuestion }
  | { type: 'topic_summary'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };
```

---

## 9. Project structure

```
app/
  api/
    upload/route.ts          ─ pipeline kickoff (parallel Whisper + sequential agent)
    stream/route.ts          ─ SSE with heartbeat
    status/route.ts          ─ polling fallback
    export/route.ts          ─ Markdown export
    anki/route.ts            ─ Anki CSV export
    calendar/[id]/route.ts   ─ .ics export (Next 16 async params)
  layout.tsx                 ─ root layout, dark theme, Geist fonts
  page.tsx                   ─ entire UI (3-column layout, state, SSE consumer)
  globals.css                ─ Tailwind v4 + shadcn theme + print stylesheet + dot grid + shimmer keyframe

components/
  AudioUploader.tsx          ─ drag-drop file picker
  LanguageSelector.tsx       ─ source + target language dropdowns
  LectureProgress.tsx        ─ animated progress bar + chunk counter
  MediaPlayer.tsx            ─ audio or video element with ref
  ConceptCard.tsx            ─ concept tile (name, definition, emphasis, timestamp, practice qs)
  AssignmentCard.tsx         ─ assignment tile (+ Cal download)
  QuestionList.tsx           ─ office-hours questions with copy
  TranscriptSheet.tsx        ─ slide-in live transcript drawer
  StatsBanner.tsx            ─ completion stats banner
  QuizGuard.tsx              ─ proctored quiz phase machine + anti-cheat
  ExportBar.tsx              ─ Anki / Markdown / PDF buttons

components/ui/               ─ shadcn primitives
  button.tsx · card.tsx · progress.tsx · badge.tsx · separator.tsx ·
  scroll-area.tsx · select.tsx · sheet.tsx

lib/
  agent.ts                   ─ Claude agent loop + 5 tool definitions
  whisper.ts                 ─ OpenAI Whisper wrapper (language optional)
  ffmpeg.ts                  ─ chunking helper
  ics.ts                     ─ assignment → .ics with reminder
  state.ts                   ─ in-memory session + event bus
  types.ts                   ─ shared types + LANGUAGES list + CHUNK_SECONDS
  utils.ts                   ─ shadcn cn() helper

public/
  demo_lecture.mp3           ─ git-ignored, drop your demo file here

Top level:
  README.md                  ─ hackathon-grade README
  SUBMISSION.md              ─ pin-it-during-pitch cheat sheet
  PROJECT_DOC.md             ─ this file
  package.json · tsconfig.json · next.config.mjs · tailwind.config.ts ·
  postcss.config.mjs · components.json · .env.example · .gitignore
```

---

## 10. Code highlights

### 10.1 Agent system prompt

```
You are Ghost TA, an AI agent listening to a university lecture in real time.
Your job is to build a study guide that maximizes the student's exam performance.

On every transcript chunk, you must:
  1. Identify new concepts introduced or expanded.
  2. Score how strongly the professor emphasized each concept (0..1).
     Cues: explicit ("this is important", "on the exam"), repetition,
     slow pacing, board work, formal definitions.
  3. For high-emphasis concepts (>= 0.6), generate 1-3 practice questions.
  4. Flag any passage that was confusing or rushed for office-hours follow-up.
  5. Detect any assignment, project, or problem set the professor mentions.
     Extract due_date (ISO format YYYY-MM-DD), requirements, and a verbatim
     source quote (this quote should remain in the LECTURE'S original
     language, NOT translated).
     Be conservative: only flag clear assignment statements.
  6. Maintain a concise topic_summary (one sentence) describing the lecture's
     overall topic, refining as new evidence arrives.

Be RUTHLESS about emphasis. Most lecture content is fluff. Your value is
finding the 20% the student must master.

LANGUAGE INSTRUCTION:
All output (concept names, definitions, practice questions, assignment
titles, topic summary, drafted office-hours questions) must be written
in {TARGET_LANGUAGE}. The lecture audio may be in a different language —
translate naturally and idiomatically into {TARGET_LANGUAGE}. Keep proper
nouns, formulas, mathematical notation, and code identifiers in their
original form. Use the script native to {TARGET_LANGUAGE}.

Output rules:
- Use the provided tools. Do not write prose responses.
- Avoid duplicates: if a concept already exists, only call update_concept.
- Cap at 10 concepts per lecture; replace the lowest-emphasis only if the
  new concept clearly outranks it.
```

### 10.2 Pipelined Whisper + agent loop

```typescript
async function runPipeline(sessionId: string, audioPath: string, workDir: string) {
  // Chunk into 60-second pieces.
  const chunks = await chunkAudio(audioPath, join(workDir, 'chunks'), CHUNK_SECONDS);

  const transcripts: (string | undefined)[] = new Array(chunks.length);
  const sourceLang = getSession(sessionId)?.source_language ?? 'auto';

  // 4 parallel Whisper workers pulling from a shared cursor.
  let nextToTranscribe = 0;
  const transcribeWorkers = Array.from(
    { length: Math.min(TRANSCRIPTION_CONCURRENCY, chunks.length) },
    async () => {
      while (true) {
        const i = nextToTranscribe++;
        if (i >= chunks.length) return;
        const text = await transcribeChunk(chunks[i], sourceLang);
        transcripts[i] = text;
        emit(sessionId, { type: 'transcript', chunk_index: i, text });
      }
    },
  );

  // Single agent loop walks chunks in order, polling for transcripts.
  const agentLoop = (async () => {
    for (let i = 0; i < chunks.length; i++) {
      while (transcripts[i] === undefined) {
        await new Promise((r) => setTimeout(r, 100));
      }
      await processChunk(sessionId, i, transcripts[i]!);
      // ... emit status ...
    }
  })();

  await Promise.all([...transcribeWorkers, agentLoop]);
}
```

### 10.3 Anti-cheat in QuizGuard

```typescript
useEffect(() => {
  if (phase !== "active") return;

  const onVis = () => {
    if (document.hidden) {
      onTerminate("Tab switched or window minimized");
    }
  };
  const onBlur = () => {
    onTerminate("Browser window lost focus");
  };

  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("blur", onBlur);
  return () => {
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("blur", onBlur);
  };
}, [phase, onTerminate]);
```

### 10.4 Smart media-kind detection

```typescript
const name = file.name.toLowerCase();
const knownAudio = /\.(mp3|wav|m4a|flac|ogg|aac|opus)(\.|$)/i.test(name);
const knownVideoExt = /\.(mp4|mov|webm|mkv|avi)$/i.test(name);
const videoMime = file.type.startsWith("video/");
const isVideo = !knownAudio && (knownVideoExt || videoMime);
```

The compound-extension regex `(\.|$)` is what catches `demo_lecture.mp3.mpeg` as audio — it matches `mp3` followed by either another `.` or end-of-string, so `.mp3.` (mid-name) and `.mp3` (suffix) both work. Audio always wins over MIME type because Windows over-aggressively tags `.mpeg` files as video.

### 10.5 Assignment .ics generation

```typescript
const event: EventAttributes = {
  title: a.title,
  start: parseDateToArray(a.due_date),
  duration: { hours: 0, minutes: 30 },
  description:
    (a.requirements?.length ? a.requirements.map(r => `- ${r}`).join('\n') : '') +
    (a.source_quote ? `\n\nFrom lecture:\n"${a.source_quote}"` : ''),
  categories: ['Ghost TA', 'Assignment'],
  alarms: [
    { action: 'display', description: `Reminder: ${a.title}`,
      trigger: { hours: 24, before: true } },
  ],
  productId: 'ghost-ta/ics',
  uid: `${a.id}@ghost-ta`,
};
```

The 24-hour-before alarm fires automatically in any RFC 5545 compliant calendar — Google Calendar, Apple Calendar, Outlook all honor it.

---

## 11. Performance

| Metric                                    | Sequential         | Pipelined (current) |
| ----------------------------------------- | ------------------ | ------------------- |
| 30s chunks for 43-min lecture             | 87                 | 44 (60s chunks)     |
| Avg Whisper latency per chunk             | ~5s                | ~5s × 4 in parallel |
| Avg Claude latency per chunk              | ~3-5s (sequential) | ~3-5s (sequential)  |
| End-to-end wall time (43 min lecture)     | ~14 min            | **~3-4 min**        |
| End-to-end wall time (60 min lecture)     | ~20 min            | **~5-8 min**        |
| First concept visible after upload        | ~10s               | **~10s**            |

The first concept appears in ~10 seconds because chunk 1's transcript completes and feeds the agent before later chunks finish. This is the demo magic — judges see output streaming long before the full lecture is processed.

### Quality observations

On the MIT 6.0001 demo lecture (Introduction to Computer Science and Programming in Python, Lecture 1):

- 15 concepts surfaced, deduped, ranked by emphasis
- Top concept ("Course learning objectives") scored 0.80 — the agent correctly identified the professor's explicit framing of the course goals
- Active learning, problem sets, code style, declarative knowledge all surfaced at 0.75
- Topic summary correctly identified as "Introduction to computation and Python programming basics for EECS course (6.0001/600)"
- Multiple practice questions generated for each high-emphasis concept

---

## 12. Setup and running locally

### Prerequisites
- Node.js 20 or newer
- `ffmpeg` on PATH:
  - **Windows:** `winget install Gyan.FFmpeg`
  - **macOS:** `brew install ffmpeg`
  - **Linux:** `apt install ffmpeg`
- An **OpenAI API key** for Whisper — https://platform.openai.com
- An **OpenRouter API key** for Claude — https://openrouter.ai/keys

### Clone and run

```bash
git clone https://github.com/Saketkachchhi/ghost-ta.git
cd ghost-ta
cp .env.example .env.local
# Edit .env.local — paste your OPENAI_API_KEY and OPENROUTER_API_KEY
npm install
npm run dev
```

Open http://localhost:3000 → select languages → drop a lecture audio or video file → watch concepts stream in.

### `.env.local` template

```
OPENAI_API_KEY=sk-proj-...
OPENROUTER_API_KEY=sk-or-v1-...
NODE_ENV=development
```

---

## 13. Deployment

### Vercel (free tier)

```bash
npm install -g vercel
vercel
```

Follow prompts (link to GitHub repo, accept defaults). Then in the Vercel dashboard:

1. Project → Settings → Environment Variables
2. Add `OPENAI_API_KEY` (Whisper) and `OPENROUTER_API_KEY` (Claude)
3. Set `NODE_ENV` to `production`
4. Redeploy

ffmpeg is preinstalled on Vercel's Node runtime. The `runtime = 'nodejs'` and `maxDuration = 300` exports on `/api/upload` give it 5 minutes per request, which is sufficient for a 5–10 minute demo lecture.

### Free-tier caveats

- **API route body limit is 4.5MB on Hobby tier.** This affects MP3 and MP4 equally — long lectures (>4.5MB) would need streaming uploads or presigned URLs to Vercel Blob to work in production. For the live demo URL, use a 3–5 minute trimmed clip. Local dev (`npm run dev`) has no such limit; full Zoom recordings work fine.
- **Function timeout caps at 300 seconds on Hobby**, 800 on Pro. Long lectures may need Pro.

---

## 14. Out of scope (intentional decisions)

These were debated and explicitly cut to keep the demo tight:

| Out of scope                          | Why                                                                              |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| User accounts / login / persistence   | Value prop is the agent, not user mgmt. Sessions are in-memory and ephemeral.    |
| Live mic capture in browser           | 4-hour rabbit hole. File upload is more controllable for the demo.               |
| Canvas / Google Classroom integration | Defer to v2. The Canvas API is its own integration project.                      |
| Push notifications / email reminders  | We export `.ics`; the user's calendar app handles reminders.                     |
| Mobile-responsive layout              | Desktop demo only. Mobile breakpoints would have eaten 4 hours.                  |
| Webcam-based proctoring               | Real proctoring infrastructure is out of hackathon scope. Tab-switch detection is honest. |
| Speaker diarization                   | Whisper doesn't do this natively; would need a separate model.                  |

---

## 15. Future roadmap

Next features in priority order if we keep building:

1. **Browser microphone capture** for in-room real-time use — drop the file-upload requirement
2. **Local Whisper** (whisper.cpp) so audio never leaves the device — privacy story for university accessibility offices
3. **Canvas / Google Classroom integration** to auto-attach study guides to courses and pre-fill assignment due dates
4. **Per-class persistent study guides** with cross-lecture concept linking (a real database, finally)
5. **Speaker diarization** (TA vs professor vs student questions) — separate models or finetuning
6. **Better emphasis classifiers** — currently relies entirely on Claude. A small specialized classifier could improve cost + latency per chunk
7. **Webcam proctoring for Quiz Me** — turn the existing tab-switch detection into a real exam-mode tool
8. **Vercel Blob / S3 streaming uploads** to lift the 4.5MB body limit
9. **More language UI translations** — currently the agent OUTPUT is multilingual but the UI chrome is English only
10. **Dark/light theme toggle** with system preference detection

---

## 16. Development timeline (commit history)

The full development arc, from `git log --oneline`:

| # | Commit hash | Title                                                              |
| - | ----------- | ------------------------------------------------------------------ |
| 1 | `37d522c`   | Initial commit from Create Next App                                |
| 2 | `1b32233`   | Initial commit: Next.js + shadcn skeleton                          |
| 3 | `15ff74c`   | feat: agent pipeline (Whisper -> Claude tool loop -> SSE)          |
| 4 | `196fd8d`   | refactor(agent): call Claude via OpenRouter                        |
| 5 | `e199377`   | feat(ui): timestamps + audio player + Anki export + speed-ups      |
| 6 | `2ff4da8`   | chore: untrack 25MB demo MP3 + ignore data/ dir                    |
| 7 | `0f04621`   | feat: multilingual support (16 languages)                          |
| 8 | `c2447f9`   | feat: real PDF export via expand-all + print stylesheet            |
| 9 | `18756db`   | feat(ui): polish header, empty states, listening indicator         |
| 10| `70755cd`   | feat: live transcript drawer (slide-in sheet from the right)       |
| 11| `da714de`   | docs: hackathon-grade README                                       |
| 12| `bb46290`   | Merge pull request #1 from Saketkachchhi/feat/agent-pipeline       |
| 13| `29bbdb2`   | docs: add SUBMISSION.md cheat sheet                                |
| 14| `45ccbf7`   | feat: accept MP4 / MOV / WebM (Zoom recordings) + video preview    |
| 15| `6886a92`   | feat(ui): presentation-grade visual polish                         |
| 16| `54b5d3f`   | feat(ui): dot-grid backdrop + shimmering progress bar              |
| 17| `1ea32ab`   | fix(ui): scrollable left sidebar + smarter media detection         |
| 18| `6963b5f`   | feat: bigger timestamp chip + completion stats banner + Quiz Me    |
| 19| `c014bcf`   | feat: proctored Quiz Me mode (anti-cheat + live progress bar)      |

19 commits in 24 hours. Average ~1.25 hr per commit.

---

## 17. Demo flow for the pitch

90-second click sequence. Talk over each step.

| # | Click                                | Say                                                                                       |
| - | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| 1 | "Use bundled demo"                   | "Drop a 5-minute lecture clip from MIT 6.0001."                                           |
| 2 | (wait 10s)                           | "You can see the agent identifying definitions and ranking them by emphasis in real time." |
| 3 | Click Transcript in header           | "This is the live transcript — Whisper is processing the audio in 60-second chunks, four in parallel." |
| 4 | Close drawer                         |                                                                                           |
| 5 | Click any concept's `▶ MM:SS` chip   | "Click any concept's timestamp and the audio jumps to where it was said. Total traceability." |
| 6 | Expand a high-emphasis concept       | "For high-emphasis concepts the agent generated practice exam questions automatically." |
| 7 | Point to Lecture topic card          | "And it maintains a one-sentence summary of the entire lecture, refining as it learns." |
| 8 | Wait for assignment, click + Cal     | "When the professor mentions an assignment, the agent extracts due date and requirements. One click, .ics file, opens in any calendar with a 24-hour reminder." |
| 9 | Click Anki                           | "Or download the whole study guide as Anki flashcards. Concepts and practice questions become flashcards instantly." |
| 10| Show language dropdown               | "Sixteen languages on input and output. Spanish lecture, English study guide. Or any combination." |
| 11| Click Quiz me, accept consent        | "And there's a proctored quiz mode. Treat it like a real exam — switch tabs and the quiz ends." |
| 12| Click PDF                            | "And a print-ready PDF for offline study."                                              |

---

## 18. Pitch script

Three minutes. Memorize the structure.

### Hook (15 seconds)
> "The average graduate student attends 250 hours of lectures a semester and retains less than 30 minutes of testable content from each one. We built an AI agent that fixes that."

### Problem (30 seconds)
> "Otter transcribes. Notion summarizes. Neither of them tells you what's going to be on the exam. Lectures are not transcripts; the most important signal is what the professor emphasized — what they repeated, what they spent extra time on, what they explicitly said is on the test. No tool listens for that. And no tool catches the assignment they mentioned mid-lecture and gets it onto your calendar before you forget."

### Demo (90 seconds)
*Walk through Section 17.*

### Why now / why us (30 seconds)
> "We're three international graduate students at Stevens. We've all sat through lectures in our second language, trying to figure out what mattered. That's why we built it multilingual from day one. The agent architecture means it generalizes — this is a pattern for any AI that needs to reason about importance from streaming input."

### Close (15 seconds)
> "Built in 24 hours. Imagine what it looks like with another month. Ghost TA — the TA you wish you had. Thank you."

---

## 19. Q&A — pre-prepared answers

| Question                                          | Answer                                                                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Why don't you handle reminders yourself?          | "Because students already have a calendar. Exporting `.ics` means we work with Google, Apple, and Outlook on day one with zero integration code. We do one thing well." |
| How is this different from Otter / Fireflies?     | "Those are passive transcription. Ghost TA is an active agent — it has tools, it scores professor cues, it generates exam predictions, it catches assignments." |
| Privacy / FERPA?                                  | "Audio is processed and discarded. Sessions are in-memory. In v2, local Whisper means audio never leaves the device." |
| Why is this an agent, not a script?               | "The agent decides which of five tools to call per chunk. A confusing passage gets `flag_unclear`; a formal definition gets `extract_concepts` plus practice questions. A script would treat every chunk identically." |
| What if I just paste the transcript into ChatGPT? | "You can. You can't get real-time, structured, emphasis-weighted output that updates as the lecture progresses, plus calendar export, plus Anki, plus 16 languages, plus proctored quiz mode. ChatGPT is a chatbot. Ghost TA is software." |
| How accurate is the emphasis scoring?             | "It's a prototype — we haven't formally evaluated yet. The agent design lets us swap in better classifiers without rebuilding the system." |
| How does the proctored quiz catch cheating?       | "Page Visibility API plus window blur. Two browser-native events that fire when you switch tabs or alt-tab. We don't pretend to be real proctoring infrastructure — that needs webcam access and a backend. This is honest exam mode for self-study." |
| What about long Zoom recordings?                  | "Locally — fine. ffmpeg handles any length. A 60-minute Zoom MP4 takes ~5–8 minutes to fully process and the first concept appears in 10 seconds. The Vercel free tier has a 4.5MB body limit which affects long files in production, but that's a deployment infrastructure concern, not a product limitation." |

---

## 20. AI disclosure

Per Spy-Hacks club rules:

- **Claude Code (Anthropic, Opus 4.7 with 1M context window)** was used as a pair-programming assistant for the entire build. Specifically:
  - Drafted the initial Next.js scaffolding and project structure
  - Wrote the agent system prompt, tool schemas, and the OpenAI SDK ↔ OpenRouter integration from scratch
  - Refactored from the native Anthropic SDK to OpenRouter when the team decided on a single billing relationship across providers
  - Implemented multilingual support, Anki export, PDF print stylesheet, the live transcript drawer, the proctored quiz, and the anti-cheat detection
  - All architecture decisions, scope decisions, and product trade-offs were made by the team — Claude Code executed against our judgment calls
- **No code was written by an LLM without human review and editing.**
- The Claude Sonnet 4.5 model running inside the product (the agent loop) is the product itself, not a development tool.
- Whisper (`whisper-1`) is a third-party transcription service used at runtime.

---

## 21. License and credits

**License:** MIT — use it, fork it, ship it. Just don't pretend you wrote it.

**Credits:**
- **OpenAI Whisper** — speech-to-text
- **Anthropic Claude Sonnet 4.5** — the agent reasoning
- **OpenRouter** — model routing
- **Vercel** — hosting + edge runtime
- **shadcn/ui** — UI primitives
- **Radix UI** — accessibility primitives under shadcn
- **MIT OpenCourseWare** — demo lecture material (CC-BY-NC-SA)
- **Stevens Institute of Technology** — the educational context
- **Anthropic** for Claude Code — the development pair-programming assistant

---

**Document version:** 1.0 · **Last updated:** 2026-05-01
**Built in 24 hours by Aditya Patel · Jeel Patel · Saket Kachchhi.**
**Imagine what it looks like with another month.**
