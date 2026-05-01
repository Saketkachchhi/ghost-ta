# Ghost TA — Submission Cheat Sheet

> One-page reference for the team during the hackathon. Pin this open on a phone or second monitor.
> **Spy-Hacks 2026 · Stevens · April 30 – May 1, 2026**

---

## 1. Pre-flight checklist (do this before you walk on stage)

- [ ] `npm install` ran clean on the demo laptop
- [ ] `ffmpeg -version` returns a version (not "command not found")
- [ ] `.env.local` has both `OPENAI_API_KEY` and `OPENROUTER_API_KEY`
- [ ] `public/demo_lecture.mp3` exists (or you have a backup mp3 ready)
- [ ] `npm run dev` boots cleanly on http://localhost:3000
- [ ] You have **two phone hotspots** in case venue WiFi tanks
- [ ] Each teammate has $5 of credit on **both** OpenAI and OpenRouter (3 keys each = fail-over if rate-limited)
- [ ] Demo lecture pre-trimmed to 3-5 min (not 43 min — judges won't wait)
- [ ] Browser bookmarked to `http://localhost:3000`
- [ ] Audio output tested through the room speakers

---

## 2. Quick start (fresh laptop)

```bash
git clone https://github.com/Saketkachchhi/ghost-ta.git
cd ghost-ta
cp .env.example .env.local
# paste OPENAI_API_KEY and OPENROUTER_API_KEY into .env.local
npm install
npm run dev
# open http://localhost:3000
```

ffmpeg must be on PATH first:
- **Windows:** `winget install Gyan.FFmpeg`
- **macOS:** `brew install ffmpeg`

---

## 3. The 90-second demo flow

Click through this in order. Talk over each step.

| # | Click                                | Say                                                                                       |
| - | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| 1 | **"Use bundled demo"**               | _"Drop a 5-minute lecture clip from MIT 6.0001."_                                         |
| 2 | (wait 10s)                           | _"You can see the agent identifying definitions and ranking them by emphasis in real time."_ |
| 3 | Click **Transcript** in header       | _"This is the live transcript — Whisper is processing the audio in 60-second chunks, four in parallel."_ |
| 4 | Close the drawer                     |                                                                                           |
| 5 | Click any concept's **`▶ MM:SS`** chip | _"Click any concept's timestamp and the audio jumps to where it was said. Total traceability."_ |
| 6 | Expand a high-emphasis concept       | _"For high-emphasis concepts the agent generated practice exam questions automatically."_ |
| 7 | Point to **Lecture topic** card      | _"And it maintains a one-sentence summary of the entire lecture, refining as it learns."_ |
| 8 | (assignment appears) Click **+ Cal** | _"When the professor mentions an assignment, the agent extracts due date and requirements. One click, .ics file, opens in any calendar with a 24-hour reminder."_ |
| 9 | Click **Anki** in header             | _"Or download the whole study guide as Anki flashcards. Front of card is the concept, back is the definition. Practice questions become their own cards."_ |
| 10| Show language dropdown               | _"Sixteen languages on input and output. Spanish lecture, English study guide, or any combination."_ |
| 11| Click **PDF**                        | _"And a print-ready PDF for offline study."_                                              |

**Total wall time:** ~90 seconds for the full flow once concepts have started streaming.

---

## 4. Pitch script (3 minutes, memorize the structure)

### Hook (15s)
> "The average graduate student attends 250 hours of lectures a semester and retains less than 30 minutes of testable content from each one. We built an AI agent that fixes that."

### Problem (30s)
> "Otter transcribes. Notion summarizes. Neither of them tells you what's going to be on the exam. Lectures are not transcripts; the most important signal is what the professor emphasized — what they repeated, what they spent extra time on, what they explicitly said is on the test. No tool listens for that."

### Demo (90s) — _walk through Section 3 above_

### Why now / why us (30s)
> "We're three international graduate students at Stevens. We've all sat through lectures in our second language, trying to figure out what mattered. That's why we built it multilingual from the start. The agent architecture means it generalizes — this is a pattern for any AI that needs to reason about importance from streaming input."

### Close (15s)
> "Built in 24 hours. Imagine what it looks like with another month. Ghost TA — the TA you wish you had. Thank you."

---

## 5. Q&A — pre-prepared answers

| Question                                          | Answer                                                                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _Why don't you handle reminders yourself?_        | "Because students already have a calendar. Exporting `.ics` means we work with Google, Apple, and Outlook on day one with zero integration code. We do one thing well." |
| _How is this different from Otter?_               | "Otter is passive transcription. Ghost TA is an active agent — it has tools, it scores professor cues, it generates exam predictions. None of those products do that." |
| _Privacy / FERPA?_                                | "Audio is processed and discarded. Sessions are in-memory. In v2, local Whisper means audio never leaves the device." |
| _Why is this an agent, not a script?_             | "The agent decides which of five tools to call per chunk. A confusing passage gets `flag_unclear`; a formal definition gets `extract_concepts` plus `generate_practice_questions`. A script would treat every chunk identically." |
| _What if I just paste the transcript into ChatGPT?_ | "You can. You can't get real-time, structured, emphasis-weighted output that updates as the lecture progresses, plus calendar export, plus Anki, plus 16 languages. ChatGPT is a chatbot. Ghost TA is software." |
| _How accurate is emphasis scoring?_               | "It's a prototype — we haven't formally evaluated yet. The agent design lets us swap in better classifiers without rebuilding the system." |

---

## 6. Devpost submission fields (copy-paste ready)

**Project name:** Ghost TA

**Tagline:** The TA you wish you had — listens to your lecture and writes your study guide before class ends.

**Description (use the README content + this 2-sentence opener):**
> Ghost TA is an autonomous AI agent that joins your lecture, scores professor emphasis cues, and ships you a personalized study guide with predicted exam questions and assignment reminders before the lecture ends.
>
> It's not a transcription tool. It's an agent — Claude Sonnet 4.5 reasoning over each 60-second chunk with five tools, deciding what to extract, what to flag, and what to predict. Multilingual on day one (16 languages), with one-click calendar exports for assignments, Anki flashcards for studying, and click-to-jump audio playback so every concept is traceable back to the moment the professor said it.

**Built with tags:** `next.js` `react` `typescript` `tailwind` `shadcn-ui` `claude` `openrouter` `whisper` `openai` `framer-motion` `vercel` `server-sent-events`

**Try it out:** _add Vercel URL after deploying_ + GitHub repo: https://github.com/Saketkachchhi/ghost-ta

**Demo video:** _add YouTube unlisted link_

**AI disclosure (in the description):**
> We used Claude Code (Opus 4.7, 1M context) as a pair-programming assistant during the build. Specifically: it scaffolded the Next.js project structure, drafted the agent system prompt and tool schemas, and helped refactor from native Anthropic SDK to OpenRouter. All architecture decisions, scope decisions, and product trade-offs were made by the team. The Claude Sonnet 4.5 model running inside the product (the agent loop) is the product itself, not a development tool.

---

## 7. Deploy to Vercel

```bash
npm install -g vercel
cd ghost-ta
vercel
```

Follow prompts (link to GitHub repo, accept defaults). Then in Vercel dashboard:

- Project → Settings → Environment Variables → add:
  - `OPENAI_API_KEY` = `sk-proj-...`
  - `OPENROUTER_API_KEY` = `sk-or-v1-...`
  - `NODE_ENV` = `production`
- Redeploy.

ffmpeg is preinstalled on Vercel's Node runtime. The `runtime = 'nodejs'` and
`maxDuration = 300` exports on `/api/upload` give it 5 minutes per request,
which is plenty for the 5-min demo lecture.

**One caveat on the free tier:** function memory caps may interrupt longer
lectures. For the demo, use a 3-5 minute clip — it'll comfortably fit. For
production, upgrade to Pro for 800-second timeouts.

---

## 8. Things that will go wrong and quick fixes

| Symptom                                | Cause                       | Fix                                                                                 |
| -------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------- |
| `ffmpeg: command not found`            | ffmpeg not on PATH          | Install ffmpeg, **reopen the terminal**                                             |
| `OPENAI_API_KEY is not set`            | `.env.local` not loaded     | File must be `.env.local` (not `.env`); restart `npm run dev` after editing         |
| `OPENROUTER_API_KEY is not set`        | Same                        | Same                                                                                |
| 401 from OpenRouter                    | Wrong key or no credit      | Verify key starts with `sk-or-v1-` and billing is funded                            |
| 429 rate limit                         | Hit OpenAI/OpenRouter limit | Swap to teammate's keys in `.env.local`, restart dev server                         |
| Stream connects but nothing arrives    | Server crashed silently     | Watch the terminal running `npm run dev`                                            |
| Demo lecture too long, judge impatient | Lecture > 5 min             | Pre-trim with Audacity to 3-5 min, save to `public/demo_lecture.mp3`                |
| Concepts duplicate                     | LLM ignored dedupe          | Tighten the system prompt; concepts already deduped by name in `lib/agent.ts`       |
| WiFi at venue is bad                   | API calls time out          | Switch to phone hotspot; have two ready; worst case, run the demo locally         |

---

## 9. Repo state

- **Main:** all 9 feature commits + merge commit, fully shipped
- **PR #1:** merged
- **TypeScript:** clean (`npx tsc --noEmit` exits 0)
- **ESLint:** clean (`npm run lint` exits 0)
- **Production build:** clean (`npm run build` exits 0)
- **Routes:**
  - Static: `/`, `/_not-found`
  - Dynamic: `/api/anki`, `/api/calendar/[id]`, `/api/export`, `/api/status`, `/api/stream`, `/api/upload`

---

## 10. Quick pull-fresh checklist (for Saket / Jeel after merge)

```bash
git pull origin main
npm install                        # picks up new deps
cp .env.example .env.local         # if you don't have one
# paste your OPENAI_API_KEY + OPENROUTER_API_KEY into .env.local
npm run dev                        # http://localhost:3000
```

If you see TypeScript errors after the pull, run `rm -rf .next && npm run dev`
to bust the cache.

---

**Built by:** Aditya Patel · Jeel Patel · Saket Kachchhi
**Stevens Institute of Technology** — F-1 international grad students who got tired of trying to figure out what mattered in 250 hours of lectures.
