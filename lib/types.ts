// Chunk size in seconds — used to convert first_seen_chunk into a real-time
// timestamp for the audio player. Must match CHUNK_SECONDS in app/api/upload/route.ts.
export const CHUNK_SECONDS = 60;

export type Concept = {
  id: string;
  name: string;
  definition: string;
  emphasis: number; // 0..1
  practice_questions: string[];
  first_seen_chunk: number;
};

export type Assignment = {
  id: string;
  title: string;
  due_date: string; // ISO 8601 — YYYY-MM-DD or full datetime
  requirements: string[];
  source_quote: string;
  detected_at_chunk: number;
};

export type FlaggedQuestion = {
  id: string;
  passage: string;
  drafted_question: string;
  detected_at_chunk: number;
};

export type StudyGuide = {
  concepts: Concept[];
  assignments: Assignment[];
  questions: FlaggedQuestion[];
  topic_summary: string;
};

export type SessionStatus = 'queued' | 'processing' | 'done' | 'error';

export type Session = {
  id: string;
  status: SessionStatus;
  error?: string;
  audio_path: string;
  chunks_total: number;
  chunks_done: number;
  transcript_so_far: string;
  study_guide: StudyGuide;
  created_at: number;
  // 'auto' lets Whisper detect; otherwise an ISO 639-1 code ('en', 'es', ...)
  source_language: string;
  // ISO 639-1 code for the study guide output. The agent translates as needed.
  target_language: string;
};

// Languages we surface in the UI. Whisper supports many more — these are the
// ones with the strongest accuracy for academic lecture content.
export const LANGUAGES: { code: string; label: string }[] = [
  { code: 'auto', label: 'Auto-detect' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish (Español)' },
  { code: 'fr', label: 'French (Français)' },
  { code: 'de', label: 'German (Deutsch)' },
  { code: 'it', label: 'Italian (Italiano)' },
  { code: 'pt', label: 'Portuguese (Português)' },
  { code: 'nl', label: 'Dutch (Nederlands)' },
  { code: 'ru', label: 'Russian (Русский)' },
  { code: 'pl', label: 'Polish (Polski)' },
  { code: 'tr', label: 'Turkish (Türkçe)' },
  { code: 'ar', label: 'Arabic (العربية)' },
  { code: 'hi', label: 'Hindi (हिन्दी)' },
  { code: 'ja', label: 'Japanese (日本語)' },
  { code: 'ko', label: 'Korean (한국어)' },
  { code: 'zh', label: 'Chinese (中文)' },
  { code: 'vi', label: 'Vietnamese (Tiếng Việt)' },
];

// Output languages — same list minus 'auto'.
export const OUTPUT_LANGUAGES = LANGUAGES.filter((l) => l.code !== 'auto');

export function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

export type StreamEvent =
  | { type: 'status'; status: SessionStatus; chunks_done: number; chunks_total: number }
  | { type: 'transcript'; chunk_index: number; text: string }
  | { type: 'concept'; concept: Concept }
  | { type: 'concept_update'; concept: Concept }
  | { type: 'assignment'; assignment: Assignment }
  | { type: 'question'; question: FlaggedQuestion }
  | { type: 'topic_summary'; text: string }
  | { type: 'done' }
  | { type: 'error'; message: string };
