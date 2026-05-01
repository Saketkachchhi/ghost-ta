"use client";

import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

type Props = {
  status: "idle" | "uploading" | "processing" | "done" | "error";
  chunksDone: number;
  chunksTotal: number;
  error: string | null;
};

export default function LectureProgress({
  status,
  chunksDone,
  chunksTotal,
  error,
}: Props) {
  const pct = chunksTotal > 0 ? Math.round((chunksDone / chunksTotal) * 100) : 0;
  const label =
    status === "idle"
      ? "Idle"
      : status === "uploading"
        ? "Uploading…"
        : status === "processing"
          ? `Processing chunk ${chunksDone}/${chunksTotal || "?"}`
          : status === "done"
            ? "Complete"
            : "Error";

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Status
        </span>
        <span
          className={cn(
            "text-xs",
            status === "done" && "text-primary",
            status === "processing" && "text-amber-500",
            status === "error" && "text-destructive",
            status === "idle" && "text-muted-foreground",
          )}
        >
          {label}
        </span>
      </div>
      <Progress value={status === "done" ? 100 : pct} className="h-1.5" />
      {error && (
        <p className="mt-2 break-words text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
