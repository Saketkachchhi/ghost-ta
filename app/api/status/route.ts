import { NextResponse } from 'next/server';
import { getSession } from '@/lib/state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('session_id');
  if (!id) return NextResponse.json({ error: 'missing session_id' }, { status: 400 });
  const s = getSession(id);
  if (!s) return NextResponse.json({ error: 'unknown session' }, { status: 404 });

  return NextResponse.json({
    id: s.id,
    status: s.status,
    chunks_done: s.chunks_done,
    chunks_total: s.chunks_total,
    error: s.error,
    study_guide: s.study_guide,
  });
}
