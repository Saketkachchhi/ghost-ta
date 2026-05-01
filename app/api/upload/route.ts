import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { chunkAudio } from '@/lib/ffmpeg';
import { transcribeChunk } from '@/lib/whisper';
import { processChunk } from '@/lib/agent';
import { createSession, emit, getSession, updateSession } from '@/lib/state';
import type { Session } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('audio');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'no audio file' }, { status: 400 });
  }

  const id = randomUUID();
  const workDir = join(tmpdir(), 'ghost-ta', id);
  await mkdir(workDir, { recursive: true });

  const audioPath = join(workDir, file.name || 'lecture.mp3');
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(audioPath, buf);

  const session: Session = {
    id,
    status: 'queued',
    audio_path: audioPath,
    chunks_total: 0,
    chunks_done: 0,
    transcript_so_far: '',
    study_guide: { concepts: [], assignments: [], questions: [], topic_summary: '' },
    created_at: Date.now(),
  };
  createSession(session);

  // Kick off processing without awaiting. We return the session id immediately
  // so the client can open the SSE stream.
  void runPipeline(id, audioPath, workDir).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    updateSession(id, { status: 'error', error: msg });
    emit(id, { type: 'error', message: msg });
  });

  return NextResponse.json({ session_id: id });
}

async function runPipeline(sessionId: string, audioPath: string, workDir: string) {
  updateSession(sessionId, { status: 'processing' });
  emit(sessionId, { type: 'status', status: 'processing', chunks_done: 0, chunks_total: 0 });

  const chunks = await chunkAudio(audioPath, join(workDir, 'chunks'), 30);
  updateSession(sessionId, { chunks_total: chunks.length });
  emit(sessionId, {
    type: 'status',
    status: 'processing',
    chunks_done: 0,
    chunks_total: chunks.length,
  });

  for (let i = 0; i < chunks.length; i++) {
    const text = await transcribeChunk(chunks[i]);
    const session = getSession(sessionId);
    if (!session) return;
    const transcript_so_far = session.transcript_so_far
      ? `${session.transcript_so_far}\n${text}`
      : text;
    updateSession(sessionId, { transcript_so_far });
    emit(sessionId, { type: 'transcript', chunk_index: i, text });

    await processChunk(sessionId, i, text);

    updateSession(sessionId, { chunks_done: i + 1 });
    emit(sessionId, {
      type: 'status',
      status: 'processing',
      chunks_done: i + 1,
      chunks_total: chunks.length,
    });
  }

  updateSession(sessionId, { status: 'done' });
  emit(sessionId, { type: 'done' });
}
