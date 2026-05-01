"use client";

import { useEffect, useRef } from "react";
import { FileText } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CHUNK_SECONDS } from "@/lib/types";

type Chunk = { chunk_index: number; text: string };

type Props = {
  chunks: Chunk[];
  isLive: boolean;
  onJumpTo?: (seconds: number) => void;
};

function formatMmSs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TranscriptSheet({ chunks, isLive, onJumpTo }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom while live so users see new chunks arrive.
  useEffect(() => {
    if (isLive) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [chunks.length, isLive]);

  const sorted = [...chunks].sort((a, b) => a.chunk_index - b.chunk_index);
  const wordCount = sorted.reduce(
    (n, c) => n + c.text.split(/\s+/).filter(Boolean).length,
    0,
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" disabled={chunks.length === 0}>
          <FileText className="size-3.5" />
          Transcript
          {chunks.length > 0 && (
            <span className="ml-0.5 rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
              {chunks.length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b border-border bg-card/40 px-6 py-4">
          <SheetTitle className="font-mono uppercase tracking-wide">
            Live transcript
          </SheetTitle>
          <SheetDescription>
            {chunks.length} chunk{chunks.length === 1 ? "" : "s"} ·{" "}
            {wordCount.toLocaleString()} word{wordCount === 1 ? "" : "s"}
            {isLive && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live
              </span>
            )}
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 px-6 py-4">
          {sorted.length === 0 ? (
            <p className="mt-12 text-center text-sm text-muted-foreground">
              The transcript will appear here as Whisper processes each
              30-second chunk.
            </p>
          ) : (
            <div className="space-y-4">
              {sorted.map((c) => {
                const start = c.chunk_index * CHUNK_SECONDS;
                return (
                  <div key={c.chunk_index} className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => onJumpTo?.(start)}
                      disabled={!onJumpTo}
                      className="mt-0.5 shrink-0 rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:border-emerald-500/60 hover:text-emerald-500 disabled:opacity-50 disabled:hover:border-border disabled:hover:text-muted-foreground"
                    >
                      {formatMmSs(start)}
                    </button>
                    <p className="flex-1 text-sm leading-relaxed text-foreground">
                      {c.text}
                    </p>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
