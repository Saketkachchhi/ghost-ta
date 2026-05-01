import OpenAI from 'openai';
import { createReadStream } from 'node:fs';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is not set');
    client = new OpenAI({ apiKey: key });
  }
  return client;
}

// Language is an ISO 639-1 code (en, es, fr, ...). Pass 'auto' or omit to
// let Whisper detect — detection adds ~1s of latency but is accurate.
export async function transcribeChunk(
  filePath: string,
  language?: string,
): Promise<string> {
  const openai = getClient();
  const useLanguage = language && language !== 'auto' ? language : undefined;
  const resp = await openai.audio.transcriptions.create({
    file: createReadStream(filePath) as unknown as File,
    model: 'whisper-1',
    response_format: 'text',
    ...(useLanguage ? { language: useLanguage } : {}),
  });
  // When response_format is 'text' the SDK returns a string.
  return typeof resp === 'string' ? resp.trim() : String(resp).trim();
}
