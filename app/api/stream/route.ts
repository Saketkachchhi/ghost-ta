import { subscribe, getSession } from '@/lib/state';
import type { StreamEvent } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id');
  if (!sessionId) return new Response('missing session_id', { status: 400 });
  if (!getSession(sessionId)) return new Response('unknown session', { status: 404 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* closed */
        }
      };

      // Heartbeat keeps proxies from closing the socket.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* closed */
        }
      }, 15_000);

      const unsub = subscribe(sessionId, (event) => {
        send(event);
        if (event.type === 'done' || event.type === 'error') {
          clearInterval(heartbeat);
          unsub();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      });

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        unsub();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
