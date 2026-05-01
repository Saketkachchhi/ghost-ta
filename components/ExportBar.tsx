"use client";

import { Download, Layers, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  sessionId: string | null;
  canExport: boolean;
  onPrintPdf?: () => void;
};

export default function ExportBar({ sessionId, canExport, onPrintPdf }: Props) {
  const disabled = !sessionId || !canExport;
  const mdHref = sessionId ? `/api/export?session_id=${sessionId}` : undefined;
  const ankiHref = sessionId ? `/api/anki?session_id=${sessionId}` : undefined;

  return (
    <div className="flex items-center gap-2">
      <Button asChild size="sm" variant="outline" disabled={disabled}>
        <a
          href={disabled ? undefined : ankiHref}
          download
          aria-disabled={disabled}
          title="Download Anki-compatible CSV (one card per concept + practice question)"
        >
          <Layers className="size-3.5" />
          Anki
        </a>
      </Button>
      <Button asChild size="sm" variant="outline" disabled={disabled}>
        <a href={disabled ? undefined : mdHref} download aria-disabled={disabled}>
          <Download className="size-3.5" />
          Markdown
        </a>
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => (onPrintPdf ? onPrintPdf() : window.print())}
        disabled={disabled}
        title="Open print dialog with all concepts expanded; choose 'Save as PDF' as the destination"
      >
        <Printer className="size-3.5" />
        PDF
      </Button>
    </div>
  );
}
