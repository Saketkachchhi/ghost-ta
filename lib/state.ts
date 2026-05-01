import type { Session, StreamEvent } from './types';

type Listener = (event: StreamEvent) => void;

// In-memory store. Survives across requests in the same Node process.
// Vercel serverless functions reset between cold starts; for the demo this is fine.
const sessions = new Map<string, Session>();
const listeners = new Map<string, Set<Listener>>();
const eventLog = new Map<string, StreamEvent[]>();

export function createSession(session: Session): void {
  sessions.set(session.id, session);
  listeners.set(session.id, new Set());
  eventLog.set(session.id, []);
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function updateSession(id: string, patch: Partial<Session>): void {
  const existing = sessions.get(id);
  if (!existing) return;
  sessions.set(id, { ...existing, ...patch });
}

export function subscribe(id: string, listener: Listener): () => void {
  const set = listeners.get(id) ?? new Set();
  set.add(listener);
  listeners.set(id, set);
  // Replay any buffered events so a late subscriber catches up.
  const log = eventLog.get(id) ?? [];
  for (const ev of log) listener(ev);
  return () => {
    set.delete(listener);
  };
}

export function emit(id: string, event: StreamEvent): void {
  const log = eventLog.get(id);
  if (log) log.push(event);
  const set = listeners.get(id);
  if (!set) return;
  for (const l of set) {
    try {
      l(event);
    } catch {
      // ignore listener errors
    }
  }
}

export function getEventLog(id: string): StreamEvent[] {
  return eventLog.get(id) ?? [];
}
