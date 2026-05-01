import { getSession } from '@/lib/state';
import type { Session } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('session_id');
  if (!id) return new Response('missing session_id', { status: 400 });
  const s = getSession(id);
  if (!s) return new Response('unknown session', { status: 404 });

  const md = renderMarkdown(s);
  return new Response(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="ghost-ta-${id.slice(0, 8)}.md"`,
    },
  });
}

function renderMarkdown(s: Session): string {
  const g = s.study_guide;
  const lines: string[] = [];
  lines.push(`# Ghost TA Study Guide`);
  if (g.topic_summary) lines.push(`\n_${g.topic_summary}_\n`);

  lines.push(`## Concepts (ranked by emphasis)\n`);
  const sorted = [...g.concepts].sort((a, b) => b.emphasis - a.emphasis);
  for (const c of sorted) {
    const bar = '#'.repeat(Math.round(c.emphasis * 10));
    lines.push(`### ${c.name}  \`${bar.padEnd(10, '.')}\` ${c.emphasis.toFixed(2)}`);
    lines.push(c.definition);
    if (c.practice_questions.length) {
      lines.push(`\n**Practice questions:**`);
      for (const q of c.practice_questions) lines.push(`- ${q}`);
    }
    lines.push('');
  }

  if (g.assignments.length) {
    lines.push(`## Assignments\n`);
    for (const a of g.assignments) {
      lines.push(`### ${a.title} — due ${a.due_date}`);
      if (a.requirements.length) for (const r of a.requirements) lines.push(`- ${r}`);
      if (a.source_quote) lines.push(`\n> ${a.source_quote}`);
      lines.push('');
    }
  }

  if (g.questions.length) {
    lines.push(`## Office-hours questions\n`);
    for (const q of g.questions) {
      lines.push(`- **Q:** ${q.drafted_question}`);
      lines.push(`  > ${q.passage}`);
    }
  }

  return lines.join('\n');
}
