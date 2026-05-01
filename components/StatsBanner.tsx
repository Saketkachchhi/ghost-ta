"use client";

import { motion } from "framer-motion";
import { BookOpen, Clock, FileQuestion, Globe2, ListTodo } from "lucide-react";
import { languageLabel, type Concept, type Assignment, type FlaggedQuestion } from "@/lib/types";

type Props = {
  concepts: Concept[];
  assignments: Assignment[];
  questions: FlaggedQuestion[];
  processingMs: number;
  sourceLanguage: string;
  targetLanguage: string;
};

function formatDuration(ms: number): string {
  const sec = Math.round(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function shortLang(code: string): string {
  if (code === "auto") return "Auto";
  return languageLabel(code).split(" ")[0]; // "English (English)" -> "English"
}

export default function StatsBanner({
  concepts,
  assignments,
  questions,
  processingMs,
  sourceLanguage,
  targetLanguage,
}: Props) {
  const totalQuestions = concepts.reduce(
    (n, c) => n + c.practice_questions.length,
    0,
  );

  const stats = [
    {
      icon: BookOpen,
      value: concepts.length,
      label: "concepts",
      color: "text-emerald-400",
    },
    {
      icon: FileQuestion,
      value: totalQuestions,
      label: "practice qs",
      color: "text-emerald-400",
    },
    {
      icon: ListTodo,
      value: assignments.length + questions.length,
      label: "actions",
      color: "text-amber-400",
    },
    {
      icon: Clock,
      value: formatDuration(processingMs),
      label: "wall time",
      color: "text-foreground",
      isString: true,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative mb-4 overflow-hidden rounded-lg border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-card to-card p-4"
    >
      {/* Background accents */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-12 -bottom-12 h-32 w-32 rounded-full bg-teal-500/10 blur-3xl" />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <div>
            <div className="font-mono text-xs uppercase tracking-wider text-emerald-400">
              Lecture processed
            </div>
            <div className="text-[11px] text-muted-foreground">
              Study guide ready · download Anki, Markdown, PDF, or calendar
            </div>
          </div>
        </div>
        <div className="hidden items-center gap-1.5 rounded-md border border-border bg-card/60 px-2 py-1 text-[10px] text-muted-foreground sm:flex">
          <Globe2 className="size-3" />
          <span className="font-mono">
            {shortLang(sourceLanguage)} <span className="text-muted-foreground/50">→</span>{" "}
            <span className="text-emerald-400">{shortLang(targetLanguage)}</span>
          </span>
        </div>
      </div>

      <div className="relative mt-3 grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-md border border-border bg-card/40 px-2.5 py-2"
          >
            <div className="flex items-center gap-1.5">
              <s.icon className={`size-3 ${s.color}`} />
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                {s.label}
              </span>
            </div>
            <div
              className={`mt-0.5 font-mono text-lg font-semibold ${s.color}`}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
