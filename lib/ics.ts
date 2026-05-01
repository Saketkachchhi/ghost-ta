import { createEvent, type DateArray, type EventAttributes } from 'ics';
import type { Assignment } from './types';

// Parse an ISO date string ("YYYY-MM-DD" or full ISO) into the [Y,M,D,h,m] tuple ics expects.
function parseDateToArray(iso: string): DateArray {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    // Fallback: try YYYY-MM-DD shape manually
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      return [Number(m[1]), Number(m[2]), Number(m[3]), 23, 59];
    }
    // Default to 7 days from now if unparseable.
    const fallback = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return [
      fallback.getFullYear(),
      fallback.getMonth() + 1,
      fallback.getDate(),
      23,
      59,
    ];
  }
  return [
    d.getFullYear(),
    d.getMonth() + 1,
    d.getDate(),
    d.getHours() || 23,
    d.getMinutes() || 59,
  ];
}

export function buildIcs(a: Assignment): string {
  const event: EventAttributes = {
    title: a.title || 'Assignment',
    start: parseDateToArray(a.due_date),
    duration: { hours: 0, minutes: 30 },
    description:
      (a.requirements?.length ? a.requirements.map((r) => `- ${r}`).join('\n') : '') +
      (a.source_quote ? `\n\nFrom lecture:\n"${a.source_quote}"` : ''),
    categories: ['Ghost TA', 'Assignment'],
    alarms: [
      { action: 'display', description: `Reminder: ${a.title}`, trigger: { hours: 24, before: true } },
    ],
    productId: 'ghost-ta/ics',
    uid: `${a.id}@ghost-ta`,
  };

  const { error, value } = createEvent(event);
  if (error || !value) {
    throw new Error(`Failed to build .ics: ${error?.message ?? 'unknown error'}`);
  }
  return value;
}
