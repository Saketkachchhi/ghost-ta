"use client";

import { forwardRef } from "react";

type Props = {
  src: string | null;
};

const AudioPlayer = forwardRef<HTMLAudioElement, Props>(function AudioPlayer(
  { src },
  ref,
) {
  if (!src) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
        Lecture audio
      </div>
      <audio
        ref={ref}
        src={src}
        controls
        preload="metadata"
        className="w-full [&::-webkit-media-controls-panel]:bg-card"
      />
      <p className="mt-1 text-[11px] text-muted-foreground">
        Click any concept&apos;s timestamp to jump.
      </p>
    </div>
  );
});

export default AudioPlayer;
