"use client";

import { motion } from "framer-motion";
import { Copy } from "lucide-react";
import type { FlaggedQuestion } from "@/lib/types";

export default function QuestionList({
  questions,
}: {
  questions: FlaggedQuestion[];
}) {
  if (questions.length === 0) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        Passages the agent found rushed or ambiguous will appear here as questions
        you can take to office hours.
      </p>
    );
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
  }

  return (
    <ul className="space-y-2">
      {questions.map((q) => (
        <motion.li
          key={q.id}
          initial={{ opacity: 0, x: 6 }}
          animate={{ opacity: 1, x: 0 }}
          className="rounded-lg border border-border bg-card p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="flex-1 text-sm text-foreground">{q.drafted_question}</p>
            <button
              type="button"
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => copy(q.drafted_question)}
              title="Copy question"
            >
              <Copy className="size-3.5" />
            </button>
          </div>
          <p className="mt-2 text-xs italic text-muted-foreground">
            &ldquo;{q.passage}&rdquo;
          </p>
        </motion.li>
      ))}
    </ul>
  );
}
