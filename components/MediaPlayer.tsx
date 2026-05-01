"use client";

import { forwardRef } from "react";

type Kind = "audio" | "video";

type Props = {
  src: string | null;
  kind: Kind;
};

// Single component that drives both <audio> and <video> via the same forwarded
// ref. Both elements share `currentTime`, `play()`, etc., so the click-to-jump
// logic in page.tsx works identically across the two.
const MediaPlayer = forwardRef<HTMLMediaElement, Props>(function MediaPlayer(
  { src, kind },
  ref,
) {
  if (!src) return null;

  const label = kind === "video" ? "Lecture video" : "Lecture audio";
  const helper =
    kind === "video"
      ? "Click any concept's timestamp to jump and play."
      : "Click any concept's timestamp to jump.";

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {kind === "video" ? (
        <video
          ref={ref as React.Ref<HTMLVideoElement>}
          src={src}
          controls
          preload="metadata"
          className="aspect-video w-full rounded-md bg-black"
        />
      ) : (
        <audio
          ref={ref as React.Ref<HTMLAudioElement>}
          src={src}
          controls
          preload="metadata"
          className="w-full"
        />
      )}
      <p className="mt-1 text-[11px] text-muted-foreground">{helper}</p>
    </div>
  );
});

export default MediaPlayer;
