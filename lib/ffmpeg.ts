import { spawn } from 'node:child_process';
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

// Splits an audio file into fixed-length chunks using ffmpeg's segment muxer.
// Requires ffmpeg on PATH. On Windows: choco install ffmpeg, or download static build.
export async function chunkAudio(
  inputPath: string,
  outDir: string,
  chunkSeconds = 30,
): Promise<string[]> {
  await mkdir(outDir, { recursive: true });

  const pattern = join(outDir, 'chunk_%03d.mp3');

  await new Promise<void>((resolve, reject) => {
    const args = [
      '-y',
      '-i', inputPath,
      '-f', 'segment',
      '-segment_time', String(chunkSeconds),
      '-c:a', 'libmp3lame',
      '-b:a', '64k',
      '-ac', '1',
      '-ar', '16000',
      pattern,
    ];
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr?.on('data', (d) => (stderr += d.toString()));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
  });

  const files = (await readdir(outDir))
    .filter((f) => f.startsWith('chunk_') && f.endsWith('.mp3'))
    .sort();
  return files.map((f) => join(outDir, f));
}
