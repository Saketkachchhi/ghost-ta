"use client";

import { useEffect, useRef, useState } from "react";
import AudioUploader from "@/components/AudioUploader";
import LectureProgress from "@/components/LectureProgress";
import ConceptCard from "@/components/ConceptCard";
import AssignmentCard from "@/components/AssignmentCard";
import QuestionList from "@/components/QuestionList";
import ExportBar from "@/components/ExportBar";
import AudioPlayer from "@/components/AudioPlayer";
import LanguageSelector from "@/components/LanguageSelector";
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
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [sourceLanguage, setSourceLanguage] = useState<string>("auto");
  const [targetLanguage, setTargetLanguage] = useState<string>("en");
  const [printing, setPrinting] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

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
        setStatus(event.status === "done" ? "done" : "processing");
        setChunksDone(event.chunks_done);
        setChunksTotal(event.chunks_total);
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
  }, [sessionId]);

  async function handleUpload(file: File) {
    resetState();
    setStatus("uploading");
    // Build a playable URL for the audio player. Bundled-demo files come in
    // with name "demo_lecture.mp3" — we can serve them straight from /public
    // so the <audio> tag streams a real file. Anything else we wrap in a
    // Blob URL so the browser plays it back from memory.
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
    if (audioUrl?.startsWith("blob:")) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
  }

  const sortedConcepts = [...concepts].sort((a, b) => b.emphasis - a.emphasis);

  return (
    <main className="mx-auto flex h-screen w-full max-w-[1600px] flex-col">
      <header
        className="flex items-center justify-between border-b border-border px-6 py-4"
        data-print-hide
      >
        <div className="flex items-baseline gap-3">
          <h1 className="font-mono text-xl tracking-tight text-emerald-500">
            ghost<span className="text-foreground">/ta</span>
          </h1>
          <span className="text-xs text-muted-foreground">
            the TA you wish you had
          </span>
        </div>
        <ExportBar
          sessionId={sessionId}
          canExport={status === "done"}
          onPrintPdf={exportPdf}
        />
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
        {/* LEFT: controls — hidden in print */}
        <aside
          className="col-span-3 flex flex-col gap-4 border-r border-border p-6"
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
          <AudioPlayer ref={audioRef} src={audioUrl} />
          {topicSummary && (
            <div className="rounded-lg border border-border bg-card p-3 text-sm text-foreground">
              <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                Lecture topic
              </div>
              {topicSummary}
            </div>
          )}
        </aside>

        {/* CENTER: study guide */}
        <section className="col-span-6 flex flex-col overflow-hidden border-r border-border">
          <div className="flex items-center justify-between border-b border-border px-6 py-3">
            <h2 className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
              Study guide
            </h2>
            <span className="text-xs text-muted-foreground">
              {sortedConcepts.length} concept
              {sortedConcepts.length === 1 ? "" : "s"}
            </span>
          </div>
          <ScrollArea className="min-h-0 flex-1 px-6 py-4">
            {sortedConcepts.length === 0 && status !== "processing" && (
              <p className="mt-12 text-center text-sm text-muted-foreground">
                Upload a lecture to begin. Concepts and exam predictions will
                appear here as the agent listens.
              </p>
            )}
            {sortedConcepts.length === 0 && status === "processing" && (
              <p className="mt-12 text-center text-sm text-muted-foreground">
                Listening
                <span className="inline-block w-6 text-left">
                  {".".repeat((chunksDone % 3) + 1)}
                </span>
              </p>
            )}
            <div className="space-y-3">
              {sortedConcepts.map((c) => (
                <ConceptCard
                  key={c.id}
                  concept={c}
                  onJumpTo={audioUrl ? jumpTo : undefined}
                  forceOpen={printing}
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
    </main>
  );
}
