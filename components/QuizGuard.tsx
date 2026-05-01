"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Eye, ShieldAlert, Timer } from "lucide-react";

export type QuizPhase = "off" | "consent" | "active" | "terminated";

type Props = {
  phase: QuizPhase;
  totalConcepts: number;
  revealedCount: number;
  // Timestamp at which the quiz started — drives the live timer.
  startedAt: number | null;
  // Timestamp at which the quiz ended (terminated or otherwise) — used to
  // freeze the timer at the moment it ended.
  endedAt: number | null;
  terminationReason: string | null;

  // Phase transition callbacks. Parent owns the phase state.
  onAccept: () => void;
  onDecline: () => void;
  onTerminate: (reason: string) => void;
  onAcknowledge: () => void;
};

function formatMmSs(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function QuizGuard({
  phase,
  totalConcepts,
  revealedCount,
  startedAt,
  endedAt,
  terminationReason,
  onAccept,
  onDecline,
  onTerminate,
  onAcknowledge,
}: Props) {
  const [elapsed, setElapsed] = useState(0);

  // Live timer while quiz is active.
  useEffect(() => {
    if (phase !== "active" || startedAt === null) return;
    const t = window.setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, 250);
    return () => window.clearInterval(t);
  }, [phase, startedAt]);

  // Anti-cheat: visibility + blur. Active only while phase === 'active'.
  useEffect(() => {
    if (phase !== "active") return;

    // Listeners are scoped to phase === 'active' by the early return above
    // and the useEffect dep array, so we can call onTerminate unconditionally.
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

  // Frozen elapsed at termination.
  const displayedElapsed =
    phase === "active"
      ? elapsed
      : startedAt && endedAt
        ? endedAt - startedAt
        : 0;

  return (
    <AnimatePresence>
      {/* Consent dialog */}
      {phase === "consent" && (
        <motion.div
          key="consent"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mx-6 w-full max-w-md rounded-xl border border-emerald-500/30 bg-card p-6 shadow-[0_0_60px_-12px] shadow-emerald-500/20"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex size-9 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                <ShieldAlert className="size-4" />
              </span>
              <div>
                <h2 className="font-mono text-sm uppercase tracking-wider text-emerald-400">
                  Proctored quiz mode
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Treat this like a real exam.
                </p>
              </div>
            </div>
            <p className="mb-3 text-sm text-foreground">
              Ghost TA will hide every concept&apos;s definition and quiz you on
              the practice questions. Reveal each definition only after you
              answer.
            </p>
            <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/90">
              <div className="mb-1 flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="size-3.5" />
                Integrity rules
              </div>
              <ul className="ml-5 list-disc space-y-0.5">
                <li>Don&apos;t switch tabs or windows.</li>
                <li>Don&apos;t minimize the browser.</li>
                <li>Don&apos;t open dev tools or another app.</li>
              </ul>
              <p className="mt-2 text-amber-100/70">
                Any of these ends the quiz instantly.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onDecline}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onAccept}
                className="rounded-md border border-emerald-500/60 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25"
              >
                I understand — start quiz
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Live progress bar while active */}
      {phase === "active" && (
        <motion.div
          key="progress"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="mb-3 overflow-hidden rounded-md border border-emerald-500/40 bg-card"
          data-print-hide
        >
          <div className="flex items-center justify-between border-b border-border bg-emerald-500/5 px-3 py-1.5">
            <div className="flex items-center gap-2 text-[11px] font-medium text-emerald-300">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
              </span>
              QUIZ IN PROGRESS · proctored
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="size-3" />
                <span className="font-mono">
                  {revealedCount} / {totalConcepts}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <Timer className="size-3" />
                <span className="font-mono text-foreground">
                  {formatMmSs(displayedElapsed)}
                </span>
              </span>
            </div>
          </div>
          <div className="h-1 w-full bg-muted">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{
                width: `${
                  totalConcepts > 0
                    ? (revealedCount / totalConcepts) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </motion.div>
      )}

      {/* Termination overlay */}
      {phase === "terminated" && (
        <motion.div
          key="terminated"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-6 w-full max-w-md rounded-xl border border-destructive/40 bg-card p-6 shadow-[0_0_80px_-12px] shadow-destructive/30"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex size-10 items-center justify-center rounded-full border border-destructive/50 bg-destructive/10 text-destructive">
                <ShieldAlert className="size-5" />
              </span>
              <div>
                <h2 className="font-mono text-sm uppercase tracking-wider text-destructive">
                  Quiz terminated
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Integrity violation detected.
                </p>
              </div>
            </div>
            <p className="mb-3 text-sm text-foreground">
              We detected:{" "}
              <span className="font-medium text-destructive">
                {terminationReason ?? "unknown"}
              </span>
            </p>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border bg-card/50 p-2.5">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  Revealed
                </div>
                <div className="mt-0.5 font-mono text-base text-foreground">
                  {revealedCount} / {totalConcepts}
                </div>
              </div>
              <div className="rounded-md border border-border bg-card/50 p-2.5">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                  Time before exit
                </div>
                <div className="mt-0.5 font-mono text-base text-foreground">
                  {formatMmSs(displayedElapsed)}
                </div>
              </div>
            </div>
            <p className="mb-4 text-[11px] text-muted-foreground">
              All definitions are hidden again. Restart the quiz from the
              &quot;Quiz me&quot; toggle when you&apos;re ready to commit.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onAcknowledge}
                className="rounded-md border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-muted"
              >
                Acknowledge
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
