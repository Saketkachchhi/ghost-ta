"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Assignment } from "@/lib/types";

type Props = {
  assignment: Assignment;
  sessionId: string | null;
  forceOpen?: boolean;
};

function daysUntil(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const ms = d.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export default function AssignmentCard({
  assignment,
  sessionId,
  forceOpen,
}: Props) {
  const [openState, setOpen] = useState(false);
  const open = forceOpen || openState;
  const days = daysUntil(assignment.due_date);
  const soon = days !== null && days <= 7;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      data-print-section
      className={cn(
        "rounded-lg border bg-card p-3",
        soon ? "border-amber-500/50" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Calendar className="size-3.5 text-emerald-500" />
            <h3 className="text-sm font-semibold text-foreground">
              {assignment.title}
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Due {assignment.due_date}
            {days !== null && (
              <span className={cn("ml-1", soon && "text-amber-500")}>
                · {days >= 0 ? `in ${days}d` : `${Math.abs(days)}d ago`}
              </span>
            )}
          </p>
        </div>
        <Button
          asChild
          size="xs"
          variant="outline"
          disabled={!sessionId}
          className="border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
        >
          <a
            href={
              sessionId
                ? `/api/calendar/${assignment.id}?session_id=${sessionId}`
                : undefined
            }
            download
            aria-disabled={!sessionId}
          >
            + Cal
          </a>
        </Button>
      </div>

      {assignment.requirements.length > 0 && (
        <button
          type="button"
          className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
          {assignment.requirements.length} requirement
          {assignment.requirements.length === 1 ? "" : "s"}
        </button>
      )}
      {open && (
        <ul className="mt-2 space-y-1 border-l-2 border-border pl-3 text-xs text-foreground">
          {assignment.requirements.map((r, i) => (
            <li key={i}>· {r}</li>
          ))}
          {assignment.source_quote && (
            <li className="mt-2 italic text-muted-foreground">
              &ldquo;{assignment.source_quote}&rdquo;
            </li>
          )}
        </ul>
      )}
    </motion.div>
  );
}
