"use client";

import { useEffect, useRef, useState } from "react";
import AudioUploader from "@/components/AudioUploader";
import LectureProgress from "@/components/LectureProgress";
import ConceptCard from "@/components/ConceptCard";
import AssignmentCard from "@/components/AssignmentCard";
import QuestionList from "@/components/QuestionList";
import ExportBar from "@/components/ExportBar";
import MediaPlayer from "@/components/MediaPlayer";
import LanguageSelector from "@/components/LanguageSelector";
import TranscriptSheet from "@/components/TranscriptSheet";
import StatsBanner from "@/components/StatsBanner";
import QuizGuard from "@/components/QuizGuard";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  Assignment,
  Concept,
  FlaggedQuestion,
  StreamEvent,
} from "@/lib/types";

type Status = "idle" | "uploading" | "processing" | "done" | "error";

export default function HomePage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [chunksDone, setChunksDone] = useState(0);
  const [chunksTotal, setChunksTotal] = useState(0);
  const [topicSummary, setTopicSummary] = useState("");
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [questions, setQuestions] = useState<FlaggedQuestion[]>([]);
  const [transcriptChunks, setTranscriptChunks] = useState<
    { chunk_index: number; text: string }[]
  >([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [mediaKind, setMediaKind] = useState<"audio" | "video">("audio");
  const [sourceLanguage, setSourceLanguage] = useState<string>("auto");
  const [targetLanguage, setTargetLanguage] = useState<string>("en");
  const [printing, setPrinting] = useState(false);
  // Quiz state — single source of truth in page.tsx, QuizGuard renders.
  // 'off'        idle, no quiz UI
  // 'consent'    showing the integrity contract dialog
  // 'active'     quiz running, anti-cheat listeners armed
  // 'terminated' user violated integrity rules; show debrief overlay
  const [quizPhase, setQuizPhase] = useState<
    "off" | "consent" | "active" | "terminated"
  >("off");
  const [quizStartedAt, setQuizStartedAt] = useState<number | null>(null);
  const [quizEndedAt, setQuizEndedAt] = useState<number | null>(null);
  const [quizTerminationReason, setQuizTerminationReason] = useState<
    string | null
  >(null);
  const [revealedConceptIds, setRevealedConceptIds] = useState<Set<string>>(
    () => new Set(),
  );
  const quizActive = quizPhase === "active";
  const [processingStartedAt, setProcessingStartedAt] = useState<number | null>(null);
  const [processingEndedAt, setProcessingEndedAt] = useState<number | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const audioRef = useRef<HTMLMediaElement>(null);

  // Expand all cards, wait a frame for the DOM to update, open the print
  // dialog, then collapse back to the user's prior state.
  function exportPdf() {
    setPrinting(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        setTimeout(() => setPrinting(false), 100);
      });
    });
  }

  function jumpTo(seconds: number) {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = seconds;
    void a.play().catch(() => {
      /* user gesture missing — ignore */
    });
  }

  function handleEvent(event: StreamEvent) {
    switch (event.type) {
      case "status":
        if (event.status === "processing" && processingStartedAt === null) {
          setProcessingStartedAt(Date.now());
        }
        setStatus(event.status === "done" ? "done" : "processing");
        setChunksDone(event.chunks_done);
        setChunksTotal(event.chunks_total);
        break;
      case "transcript":
        setTranscriptChunks((prev) => {
          // Replace if we somehow get a duplicate chunk_index (shouldn't, but
          // guards against double-mounted EventSource in React StrictMode dev).
          const existing = prev.findIndex(
            (c) => c.chunk_index === event.chunk_index,
          );
          if (existing !== -1) {
            const copy = prev.slice();
            copy[existing] = { chunk_index: event.chunk_index, text: event.text };
            return copy;
          }
          return [...prev, { chunk_index: event.chunk_index, text: event.text }];
        });
        break;
      case "concept":
        setConcepts((prev) => [...prev, event.concept]);
        break;
      case "concept_update":
        setConcepts((prev) => {
          const idx = prev.findIndex((c) => c.id === event.concept.id);
          if (idx === -1) return [...prev, event.concept];
          const copy = prev.slice();
          copy[idx] = event.concept;
          return copy;
        });
        break;
      case "assignment":
        setAssignments((prev) => [...prev, event.assignment]);
        break;
      case "question":
        setQuestions((prev) => [...prev, event.question]);
        break;
      case "topic_summary":
        setTopicSummary(event.text);
        break;
      case "done":
        setStatus("done");
        setProcessingEndedAt(Date.now());
        break;
      case "error":
        setStatus("error");
        setError(event.message);
        break;
    }
  }

  useEffect(() => {
    if (!sessionId) return;
    const es = new EventSource(`/api/stream?session_id=${sessionId}`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const event: StreamEvent = JSON.parse(e.data);
        handleEvent(event);
      } catch {
        // ignore parse errors (heartbeats etc.)
      }
    };

    return () => {
      es.close();
      esRef.current = null;
    };
    // handleEvent closes over setState updaters which are stable, so we
    // intentionally don't list it as a dep — re-running this effect on every
    // render would tear down and reopen the EventSource on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function handleUpload(file: File) {
    resetState();
    setStatus("uploading");
    // Build a playable URL for the player. Bundled-demo files come in
    // with name "demo_lecture.mp3" — we can serve them straight from /public
    // so the player streams a real file. Anything else we wrap in a
    // Blob URL so the browser plays it back from memory.
    //
    // Detect media kind. Order matters: AUDIO extensions win over MIME type
    // because Windows tags ".mpeg" as video/mpeg even though many MP3 files
    // get saved as ".mp3.mpeg" (Zoom does this on some configs). The
    // compound-extension regex catches "demo_lecture.mp3.mpeg" -> audio.
    const name = file.name.toLowerCase();
    const knownAudio = /\.(mp3|wav|m4a|flac|ogg|aac|opus)(\.|$)/i.test(name);
    const knownVideoExt = /\.(mp4|mov|webm|mkv|avi)$/i.test(name);
    const videoMime = file.type.startsWith("video/");
    const isVideo = !knownAudio && (knownVideoExt || videoMime);
    setMediaKind(isVideo ? "video" : "audio");
    if (file.name === "demo_lecture.mp3") {
      setAudioUrl("/demo_lecture.mp3");
    } else {
      setAudioUrl(URL.createObjectURL(file));
    }
    const fd = new FormData();
    fd.append("audio", file);
    fd.append("source_language", sourceLanguage);
    fd.append("target_language", targetLanguage);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`upload failed: ${res.status}`);
      const json = (await res.json()) as { session_id: string };
      setSessionId(json.session_id);
    } catch (e) {
      setStatus("error");
      setError((e as Error).message);
    }
  }

  function resetState() {
    setError(null);
    setChunksDone(0);
    setChunksTotal(0);
    setTopicSummary("");
    setConcepts([]);
    setAssignments([]);
    setQuestions([]);
    setTranscriptChunks([]);
    setProcessingStartedAt(null);
    setProcessingEndedAt(null);
    setQuizPhase("off");
    setQuizStartedAt(null);
    setQuizEndedAt(null);
    setQuizTerminationReason(null);
    setRevealedConceptIds(new Set());
    if (audioUrl?.startsWith("blob:")) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setMediaKind("audio");
  }

  const sortedConcepts = [...concepts].sort((a, b) => b.emphasis - a.emphasis);

  return (
    <main className="relative mx-auto flex h-screen w-full max-w-[1600px] flex-col">
      {/* Ambient page-level gradient orbs — sit behind everything, screen blend */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -left-40 top-0 h-[400px] w-[400px] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute -right-40 bottom-0 h-[400px] w-[400px] rounded-full bg-teal-500/8 blur-[120px]" />
      </div>
      <header
        className="relative flex items-center justify-between border-b border-border bg-gradient-to-b from-background via-background to-card/30 px-6 py-4"
        data-print-hide
      >
        {/* Subtle emerald glow behind the brand */}
        <div className="pointer-events-none absolute -left-12 top-0 h-32 w-64 bg-emerald-500/10 blur-3xl" />
        <div className="relative flex items-baseline gap-3">
          <div className="flex items-baseline gap-2">
            <h1 className="font-mono text-xl tracking-tight">
              <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-300 bg-clip-text text-transparent">
                ghost
              </span>
              <span className="text-foreground/90">/ta</span>
            </h1>
            <span className="hidden font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:inline">
              v1.0
            </span>
          </div>
          <span className="hidden text-xs text-muted-foreground md:inline">
            the TA you wish you had
          </span>
          {status === "processing" && (
            <span className="ml-2 flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
              </span>
              Listening
            </span>
          )}
          {status === "done" && (
            <span className="ml-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
              Complete
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TranscriptSheet
            chunks={transcriptChunks}
            isLive={status === "processing"}
            onJumpTo={audioUrl ? jumpTo : undefined}
          />
          <ExportBar
            sessionId={sessionId}
            canExport={status === "done"}
            onPrintPdf={exportPdf}
          />
        </div>
      </header>

      {/* Print-only header — hidden on screen, visible in PDF. */}
      <div className="hidden print:block">
        <h1 className="font-mono text-2xl">Ghost TA — Study Guide</h1>
        {topicSummary && (
          <p className="mt-1 italic text-muted-foreground">{topicSummary}</p>
        )}
        <hr className="my-4 border-foreground/30" />
      </div>

      <section className="grid flex-1 grid-cols-12 overflow-hidden">
        {/* LEFT: controls — hidden in print. min-h-0 + overflow-y-auto so the
            sidebar scrolls when content (uploader + video preview + topic card)
            exceeds the viewport height. */}
        <aside
          className="col-span-3 flex min-h-0 flex-col gap-4 overflow-y-auto border-r border-border p-6"
          data-print-hide
        >
          <LanguageSelector
            sourceLanguage={sourceLanguage}
            targetLanguage={targetLanguage}
            onSourceChange={setSourceLanguage}
            onTargetChange={setTargetLanguage}
            disabled={status === "uploading" || status === "processing"}
          />
          <AudioUploader
            onSelect={handleUpload}
            disabled={status === "uploading" || status === "processing"}
          />
          <LectureProgress
            status={status}
            chunksDone={chunksDone}
            chunksTotal={chunksTotal}
            error={error}
          />
          <MediaPlayer ref={audioRef} src={audioUrl} kind={mediaKind} />
          {topicSummary && (
            <div className="relative overflow-hidden rounded-lg border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent p-3 text-sm text-foreground">
              <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-emerald-500/10 blur-2xl" />
              <div className="relative mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-emerald-400">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2v4M4.93 4.93l2.83 2.83M2 12h4M4.93 19.07l2.83-2.83M12 18v4M19.07 19.07l-2.83-2.83M22 12h-4M19.07 4.93l-2.83 2.83" />
                </svg>
                Lecture topic
              </div>
              <div className="relative">{topicSummary}</div>
            </div>
          )}
        </aside>

        {/* CENTER: study guide */}
        <section className="col-span-6 flex flex-col overflow-hidden border-r border-border">
          <div className="flex items-center justify-between border-b border-border px-6 py-3">
            <h2 className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
              Study guide
            </h2>
            <div className="flex items-center gap-3">
              {sortedConcepts.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (quizPhase === "active") {
                      // End cleanly (no termination overlay).
                      setQuizPhase("off");
                      setQuizStartedAt(null);
                      setQuizEndedAt(null);
                      setRevealedConceptIds(new Set());
                    } else if (quizPhase === "off") {
                      // Open the consent dialog.
                      setQuizPhase("consent");
                    }
                    // If 'consent' or 'terminated', the dialog handles itself.
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    quizActive
                      ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                      : "border-border bg-card text-muted-foreground hover:border-emerald-500/40 hover:text-foreground",
                  )}
                  title={
                    quizActive
                      ? "End quiz — show all definitions"
                      : "Proctored: hide definitions and quiz yourself on the practice questions. Leaving the tab ends the quiz."
                  }
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                  {quizActive ? "End quiz" : "Quiz me"}
                </button>
              )}
              <span className="text-xs text-muted-foreground">
                {sortedConcepts.length} concept
                {sortedConcepts.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1 px-6 py-4">
            {sortedConcepts.length === 0 && status !== "processing" && (
              <div className="relative mx-auto mt-12 flex max-w-md flex-col items-center text-center">
                {/* Big radial glow behind the hero */}
                <div className="pointer-events-none absolute -inset-x-32 -top-12 h-72 bg-gradient-to-b from-emerald-500/15 via-emerald-500/5 to-transparent blur-3xl" />
                <div className="relative mb-6 flex size-20 items-center justify-center rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/0 shadow-[0_0_60px_-12px] shadow-emerald-500/30">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-emerald-400"
                  >
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                </div>
                <h2 className="relative mb-2 bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text font-mono text-3xl tracking-tight text-transparent">
                  Drop a lecture in.
                </h2>
                <p className="relative mb-6 text-sm text-muted-foreground">
                  Ghost TA listens, scores professor emphasis, and writes a
                  predictive study guide before the lecture ends.
                </p>
                <div className="relative grid w-full grid-cols-3 gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <div className="rounded-md border border-border bg-card/60 px-2 py-2 text-center">
                    <div className="font-mono text-base text-emerald-400">16</div>
                    <div>languages</div>
                  </div>
                  <div className="rounded-md border border-border bg-card/60 px-2 py-2 text-center">
                    <div className="font-mono text-base text-emerald-400">5</div>
                    <div>tools</div>
                  </div>
                  <div className="rounded-md border border-border bg-card/60 px-2 py-2 text-center">
                    <div className="font-mono text-base text-emerald-400">4×</div>
                    <div>parallel</div>
                  </div>
                </div>
                <p className="relative mt-6 text-[11px] text-muted-foreground/70">
                  Drag any audio (.mp3, .wav, .m4a) or video (.mp4, .mov)
                  file into the upload zone on the left.
                </p>
              </div>
            )}
            {sortedConcepts.length === 0 && status === "processing" && (
              <div className="mt-16 flex flex-col items-center text-center">
                <div className="relative mb-4 flex size-14 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/5">
                  <span className="absolute size-14 animate-ping rounded-full bg-emerald-500/20" />
                  <span className="relative size-2 rounded-full bg-emerald-500" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Listening to chunk {chunksDone + 1} of {chunksTotal || "?"}…
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  First concepts appear within ~15 seconds.
                </p>
              </div>
            )}
            {status === "done" && sortedConcepts.length > 0 && (
              <StatsBanner
                concepts={concepts}
                assignments={assignments}
                questions={questions}
                processingMs={
                  processingStartedAt && processingEndedAt
                    ? processingEndedAt - processingStartedAt
                    : 0
                }
                sourceLanguage={sourceLanguage}
                targetLanguage={targetLanguage}
              />
            )}
            <QuizGuard
              phase={quizPhase}
              totalConcepts={sortedConcepts.length}
              revealedCount={revealedConceptIds.size}
              startedAt={quizStartedAt}
              endedAt={quizEndedAt}
              terminationReason={quizTerminationReason}
              onAccept={() => {
                setRevealedConceptIds(new Set());
                setQuizStartedAt(Date.now());
                setQuizEndedAt(null);
                setQuizPhase("active");
              }}
              onDecline={() => {
                setQuizPhase("off");
              }}
              onTerminate={(reason) => {
                setQuizPhase("terminated");
                setQuizEndedAt(Date.now());
                setQuizTerminationReason(reason);
                setRevealedConceptIds(new Set());
              }}
              onAcknowledge={() => {
                setQuizPhase("off");
                setQuizStartedAt(null);
                setQuizEndedAt(null);
                setQuizTerminationReason(null);
              }}
            />
            <div className="space-y-3">
              {sortedConcepts.map((c) => (
                <ConceptCard
                  key={c.id}
                  concept={c}
                  onJumpTo={audioUrl ? jumpTo : undefined}
                  forceOpen={printing}
                  quizMode={quizActive}
                  isRevealed={revealedConceptIds.has(c.id)}
                  onReveal={(id) =>
                    setRevealedConceptIds((prev) => new Set(prev).add(id))
                  }
                />
              ))}
            </div>
          </ScrollArea>
        </section>

        {/* RIGHT: assignments + office hours */}
        <aside className="col-span-3 flex flex-col overflow-hidden">
          <div className="flex max-h-[55%] flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3">
              <h2 className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
                Assignments
              </h2>
              <span className="text-xs text-muted-foreground">
                {assignments.length}
              </span>
            </div>
            <ScrollArea className="min-h-0 flex-1 px-5 pb-4">
              <div className="space-y-2">
                {assignments.length === 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Assignments mentioned by the professor will appear here with
                    a one-click calendar export.
                  </p>
                )}
                {assignments.map((a) => (
                  <AssignmentCard
                    key={a.id}
                    assignment={a}
                    sessionId={sessionId}
                    forceOpen={printing}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
          <Separator />
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3">
              <h2 className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
                Office hours
              </h2>
              <span className="text-xs text-muted-foreground">
                {questions.length}
              </span>
            </div>
            <ScrollArea className="min-h-0 flex-1 px-5 pb-4">
              <QuestionList questions={questions} />
            </ScrollArea>
          </div>
        </aside>
      </section>

      {/* Footer — small team credit, hidden in print */}
      <footer
        className="flex items-center justify-between border-t border-border bg-gradient-to-t from-card/30 to-background px-6 py-2 text-[10px] text-muted-foreground"
        data-print-hide
      >
        <div className="flex items-center gap-2">
          <span className="font-mono uppercase tracking-widest">
            Spy-Hacks 2026
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span>Stevens Institute of Technology</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Built by</span>
          <span className="font-medium text-foreground/80">Aditya</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="font-medium text-foreground/80">Jeel</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="font-medium text-foreground/80">Saket</span>
        </div>
      </footer>
    </main>
  );
}
