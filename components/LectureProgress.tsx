"use client";

import { cn } from "@/lib/utils";

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

  // Custom progress bar so we can layer a shimmer animation on top of the fill
  // when status === processing. The shimmer is a moving gradient sweep — judges
  // immediately read it as "the system is working."
  const fillWidth = status === "done" ? 100 : pct;

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Status
        </span>
        <span
          className={cn(
            "text-xs",
            status === "done" && "text-emerald-400",
            status === "processing" && "text-amber-400",
            status === "error" && "text-destructive",
            status === "idle" && "text-muted-foreground",
            status === "uploading" && "text-foreground",
          )}
        >
          {label}
        </span>
      </div>

      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "relative h-full overflow-hidden rounded-full transition-all duration-500",
            status === "error" ? "bg-destructive" : "bg-emerald-500",
          )}
          style={{ width: `${fillWidth}%` }}
        >
          {status === "processing" && (
            <span
              className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.45)_50%,transparent_100%)] bg-[length:200%_100%]"
              style={{ animation: "ghost-ta-shimmer 1.6s linear infinite" }}
            />
          )}
        </div>
      </div>

      {chunksTotal > 0 && status === "processing" && (
        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>
            <span className="font-mono text-emerald-400">{chunksDone}</span> /{" "}
            {chunksTotal} chunks
          </span>
          <span>{pct}%</span>
        </div>
      )}

      {error && (
        <p className="mt-2 break-words text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
