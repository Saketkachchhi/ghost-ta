"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  onSelect: (file: File) => void;
  disabled?: boolean;
};

export default function AudioUploader({ onSelect, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [filename, setFilename] = useState<string | null>(null);

  function handleFile(f: File | undefined) {
    if (!f) return;
    setFilename(f.name);
    onSelect(f);
  }

  return (
    <div>
      <div
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center transition-colors",
          dragOver && "border-primary/60 bg-primary/5",
          disabled && "cursor-not-allowed opacity-50",
        )}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled) return;
          handleFile(e.dataTransfer.files?.[0]);
        }}
      >
        <Upload className="mb-2 size-6 text-muted-foreground" />
        <p className="text-sm text-foreground">
          {filename ?? "Drop a lecture audio file"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">.mp3 / .wav / .m4a</p>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? undefined)}
          disabled={disabled}
        />
      </div>
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "mt-3 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline",
          disabled && "pointer-events-none opacity-50",
        )}
        onClick={async () => {
          try {
            const r = await fetch("/demo_lecture.mp3");
            if (!r.ok) return;
            const b = await r.blob();
            handleFile(new File([b], "demo_lecture.mp3", { type: b.type }));
          } catch {
            /* no demo file present */
          }
        }}
      >
        Use bundled demo
      </button>
    </div>
  );
}
