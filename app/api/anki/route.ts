import { getSession } from '@/lib/state';

export const runtime = 'nodejs';

// Anki imports CSV cleanly when each cell is double-quoted and internal
// double quotes are escaped by doubling. We use 3 columns: Front, Back, Tags.
// Anki desktop: File -> Import -> select this .csv -> "Fields separated by: Comma".
function csvCell(s: string): string {
  return `"${s.replace(/"/g, '""').replace(/\r?\n/g, '<br>')}"`;
}

function csvRow(...cells: string[]): string {
  return cells.map(csvCell).join(',');
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('session_id');
  if (!id) return new Response('missing session_id', { status: 400 });
  const s = getSession(id);
  if (!s) return new Response('unknown session', { status: 404 });

  const lines: string[] = [];
  // Anki ignores the header row if you check "First field is field name" — but
  // it's also fine as a card. We emit it as a comment-style line that Anki
  // will treat as a card; users delete it after import. Skip headers entirely.

  const topic = s.study_guide.topic_summary || 'Lecture';

  // Concept cards: front=concept name, back=definition.
  for (const c of s.study_guide.concepts) {
    lines.push(
      csvRow(
        c.name,
        c.definition,
        `ghost-ta concept emphasis-${c.emphasis.toFixed(1)}`,
      ),
    );
  }

  // Practice question cards: front=question, back=concept it tests + definition.
  for (const c of s.study_guide.concepts) {
    for (const q of c.practice_questions) {
      lines.push(
        csvRow(
          q,
          `Tests: ${c.name}\n\n${c.definition}`,
          `ghost-ta practice ${c.name.replace(/\s+/g, '_')}`,
        ),
      );
    }
  }

  const body = `# Ghost TA flashcards — ${topic}\n# Import into Anki: File > Import, comma-separated, "Allow HTML" ON\n${lines.join('\n')}\n`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ghost-ta-anki-${id.slice(0, 8)}.csv"`,
    },
  });
}
