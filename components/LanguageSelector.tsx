"use client";

import { Globe, Languages } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGES, OUTPUT_LANGUAGES } from "@/lib/types";

type Props = {
  sourceLanguage: string;
  targetLanguage: string;
  onSourceChange: (code: string) => void;
  onTargetChange: (code: string) => void;
  disabled?: boolean;
};

export default function LanguageSelector({
  sourceLanguage,
  targetLanguage,
  onSourceChange,
  onTargetChange,
  disabled,
}: Props) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
        Languages
      </div>
      <div className="space-y-2">
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Globe className="size-3" />
            Lecture audio
          </label>
          <Select
            value={sourceLanguage}
            onValueChange={onSourceChange}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code} className="text-xs">
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Languages className="size-3" />
            Study guide output
          </label>
          <Select
            value={targetLanguage}
            onValueChange={onTargetChange}
            disabled={disabled}
          >
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OUTPUT_LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code} className="text-xs">
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
