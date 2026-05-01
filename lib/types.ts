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
};

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
