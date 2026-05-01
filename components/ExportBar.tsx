"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { sessionId: string | null; canExport: boolean };

export default function ExportBar({ sessionId, canExport }: Props) {
  const disabled = !sessionId || !canExport;
  const href = sessionId ? `/api/export?session_id=${sessionId}` : undefined;

  return (
    <div className="flex items-center gap-2">
      <Button asChild size="sm" variant="outline" disabled={disabled}>
        <a href={disabled ? undefined : href} download aria-disabled={disabled}>
          <Download className="size-3.5" />
          Markdown
        </a>
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => window.print()}
        disabled={disabled}
      >
        <Printer className="size-3.5" />
        PDF
      </Button>
    </div>
  );
}
