# Ghost TA

> The TA you wish you had — listens to your lecture and writes your study guide before class ends.

Submission for **Spy-Hacks 2026 at Stevens** (April 30 – May 1, 2026).
Project track. Built by Aditya Patel, Jeel Patel, and Saket Kachchhi.

## What it does

Ghost TA is an autonomous agent that ingests lecture audio in real time and
produces a structured study guide as the lecture progresses:

- Transcribes lecture audio in 30-second chunks via OpenAI Whisper.
- A Claude Sonnet 4.5 agent loop reasons over each chunk with five tools:
  `extract_concepts`, `update_concept`, `flag_assignment`, `flag_unclear`,
  `set_topic_summary`.
- Scores professor emphasis (repetition, "this will be on the exam,"
  formal definitions, board work) and generates exam-style practice questions
  for the highest-scored concepts.
- Detects assignments mentioned in the lecture, parses due dates and
  requirements, and exports each as an `.ics` calendar file with a 24-hour
  reminder.
- Streams every update to the UI over Server-Sent Events so the study guide
  visibly writes itself while the lecture plays.

## Demo

| Resource    | Link                          |
| ----------- | ----------------------------- |
| 2-min video | _add YouTube unlisted link_   |
| Live URL    | _add Vercel deployment_       |
| Source      | this repo                     |

## Tech stack

- **Next.js 16** (App Router) — UI + API routes in one project.
- **React 19** + **Tailwind CSS v4** + **shadcn/ui** + **framer-motion** + **lucide-react**.
- **Anthropic Claude Sonnet 4.5** — agent loop with tool use.
- **OpenAI Whisper (`whisper-1`)** — transcription.
- **ffmpeg** — server-side 30-second chunking (must be on PATH).
- **Server-Sent Events** — streaming agent output to the browser.
- **`ics` npm package** — RFC 5545 calendar file generation.
- **In-memory session store** — no DB. Resets on server restart; demo-appropriate.

## Architecture

```
[upload .mp3]
    -> /api/upload
    -> ffmpeg splits to 30s chunks
    -> Whisper transcribes each chunk
    -> Claude agent runs tools per chunk (extract_concepts, flag_assignment, ...)
    -> emit() pushes events to in-memory bus
    -> /api/stream (SSE) -> browser updates UI live
```

## Run locally

Prerequisites:

- Node.js 20+
- `ffmpeg` on PATH (`winget install Gyan.FFmpeg` on Windows, `brew install ffmpeg` on macOS)
- An OpenAI API key (Whisper) and an Anthropic API key (Claude)

```bash
git clone https://github.com/Saketkachchhi/ghost-ta.git
cd ghost-ta
cp .env.example .env.local
# fill in OPENAI_API_KEY and ANTHROPIC_API_KEY in .env.local
npm install
npm run dev
# open http://localhost:3000 and drop a lecture .mp3 onto the upload zone
```

For the demo, drop a 5–10 minute MIT OCW clip into `public/demo_lecture.mp3`
and the bundled-demo button will use it. (`public/demo_lecture.mp3` is
git-ignored — host it elsewhere or add via Git LFS for team sharing.)

## Routes

| Route                                | Method | Purpose                                              |
| ------------------------------------ | ------ | ---------------------------------------------------- |
| `/api/upload`                        | POST   | Accept audio file, return `session_id`, kick pipeline |
| `/api/stream?session_id=...`         | GET    | SSE stream of agent events                           |
| `/api/status?session_id=...`         | GET    | Polling fallback if SSE is blocked                   |
| `/api/export?session_id=...`         | GET    | Download study guide as Markdown                     |
| `/api/calendar/[id]?session_id=...`  | GET    | Download a single assignment as `.ics`              |

## Files

```
app/
  api/upload/route.ts         pipeline kickoff
  api/stream/route.ts         SSE
  api/status/route.ts         polling fallback
  api/export/route.ts         markdown export
  api/calendar/[id]/route.ts  .ics export (Next 16 async params)
  layout.tsx · page.tsx · globals.css
components/
  AudioUploader · LectureProgress · ConceptCard ·
  AssignmentCard · QuestionList · ExportBar
components/ui/                shadcn primitives (button, card, progress, …)
lib/
  agent.ts     Claude agent loop + tool definitions
  whisper.ts   OpenAI Whisper wrapper
  ffmpeg.ts    chunking helper
  ics.ts       assignment -> .ics
  state.ts     in-memory session + event bus
  types.ts     shared types
  utils.ts     shadcn cn() helper
```

## What we'd build next

- Browser-side live mic capture (currently file upload only)
- Local Whisper for full audio privacy
- Canvas / Google Classroom integration
- Multi-language support
- Per-class persistent study guides

## AI disclosure

We used Claude (via Claude Code) to scaffold the project structure, draft the
agent system prompt, and write the tool schemas. We used Cursor / Copilot for
autocomplete during coding. All architecture decisions were made by the team.

## Team

- Aditya Patel
- Jeel Patel
- Saket Kachchhi

Stevens Institute of Technology · F-1 international graduate students.
