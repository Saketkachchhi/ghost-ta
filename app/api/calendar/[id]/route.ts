import { getSession } from '@/lib/state';
import { buildIcs } from '@/lib/ics';

export const runtime = 'nodejs';

// Next 15+: dynamic route params are async (a Promise).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id');
  if (!sessionId) return new Response('missing session_id', { status: 400 });
  const s = getSession(sessionId);
  if (!s) return new Response('unknown session', { status: 404 });

  const a = s.study_guide.assignments.find((x) => x.id === id);
  if (!a) return new Response('unknown assignment', { status: 404 });

  const ics = buildIcs(a);
  const safe = a.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40) || 'assignment';
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safe}.ics"`,
    },
  });
}
