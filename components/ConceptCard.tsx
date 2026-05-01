"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronRight, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHUNK_SECONDS, type Concept } from "@/lib/types";

type Props = {
  concept: Concept;
  onJumpTo?: (seconds: number) => void;
  forceOpen?: boolean;
};

function formatMmSs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function ConceptCard({ concept, onJumpTo, forceOpen }: Props) {
  const [openState, setOpen] = useState(false);
  const open = forceOpen || openState;
  const pct = Math.round(concept.emphasis * 100);
  const high = concept.emphasis >= 0.75;
  const med = concept.emphasis >= 0.5 && !high;
  const timestamp = concept.first_seen_chunk * CHUNK_SECONDS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      data-print-section
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:bg-card/80",
        high &&
          "border-emerald-500/50 shadow-[0_0_24px_-12px] shadow-emerald-500/40 hover:shadow-emerald-500/60",
        med && "border-amber-500/40 hover:border-amber-500/60",
        !high && !med && "border-border hover:border-border/80",
      )}
    >
      {/* Subtle gradient accent on high-emphasis cards */}
      {high && (
        <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />
      )}
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {open ? (
              <ChevronDown className="size-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 text-muted-foreground" />
            )}
            <h3 className="font-semibold text-foreground">{concept.name}</h3>
            {onJumpTo && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onJumpTo(timestamp);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onJumpTo(timestamp);
                  }
                }}
                className="ml-1 inline-flex cursor-pointer items-center gap-1 rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-emerald-500/60 hover:text-emerald-500"
                title="Jump to this moment in the lecture"
              >
                <PlayCircle className="size-2.5" />
                {formatMmSs(timestamp)}
              </span>
            )}
          </div>
          <p className="mt-1 pl-6 text-sm text-muted-foreground">
            {concept.definition}
          </p>
        </div>
        <div className="flex w-28 flex-shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              "font-mono text-xs",
              high && "text-emerald-500",
              med && "text-amber-500",
              !high && !med && "text-muted-foreground",
            )}
          >
            {concept.emphasis.toFixed(2)}
          </span>
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full",
                high && "bg-emerald-500",
                med && "bg-amber-500",
                !high && !med && "bg-muted-foreground/40",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </button>

      {open && concept.practice_questions.length > 0 && (
        <div className="mt-3 border-l-2 border-border pl-4">
          <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
            Predicted exam questions
          </div>
          <ul className="space-y-1.5 text-sm text-foreground">
            {concept.practice_questions.map((q, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground">{i + 1}.</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {open && concept.practice_questions.length === 0 && (
        <p className="mt-3 pl-6 text-xs text-muted-foreground">
          No practice questions yet — emphasis is below the threshold.
        </p>
      )}
    </motion.div>
  );
}
