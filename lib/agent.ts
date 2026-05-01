import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionMessageToolCall,
} from 'openai/resources/chat/completions';
import { randomUUID } from 'node:crypto';
import { emit, getSession, updateSession } from './state';
import type { Assignment, Concept, FlaggedQuestion, Session } from './types';

// Calling Claude through OpenRouter's OpenAI-compatible API. We already have the
// OpenAI SDK in the project for Whisper, so we reuse it here pointed at OpenRouter.
const MODEL = 'anthropic/claude-sonnet-4.5';

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error('OPENROUTER_API_KEY is not set');
    client = new OpenAI({
      apiKey: key,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://github.com/Saketkachchhi/ghost-ta',
        'X-Title': 'Ghost TA',
      },
    });
  }
  return client;
}

const SYSTEM_PROMPT = `You are Ghost TA, an AI agent listening to a university lecture in real time.
Your job is to build a study guide that maximizes the student's exam performance.

On every transcript chunk, you must:
  1. Identify new concepts introduced or expanded.
  2. Score how strongly the professor emphasized each concept (0..1).
     Cues: explicit ("this is important", "on the exam"), repetition,
     slow pacing, board work, formal definitions.
  3. For high-emphasis concepts (>= 0.6), generate 1-3 practice questions.
  4. Flag any passage that was confusing or rushed for office-hours follow-up.
  5. Detect any assignment, project, or problem set the professor mentions.
     Extract due_date (ISO format YYYY-MM-DD), requirements (format, length,
     allowed tools, group rules, submission method), and a verbatim source quote.
     Be conservative: only flag clear assignment statements, not vague references
     like "we'll do problems on this later." If the date is relative
     ("next Friday"), resolve it to the best ISO date you can infer; if you cannot,
     omit the assignment.
  6. Maintain a concise topic_summary (one sentence) describing the lecture's
     overall topic, refining as new evidence arrives.

Be RUTHLESS about emphasis. Most lecture content is fluff. Your value is finding
the 20% the student must master.

Output rules:
- Use the provided tools. Do not write prose responses.
- Avoid duplicates: if a concept already exists in the running guide, only
  call update_concept (not extract_concepts) to refine its definition or bump
  its emphasis.
- Cap at 10 concepts per lecture; if you already have 10, replace the
  lowest-emphasis one only if the new concept clearly outranks it.`;

const TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'extract_concepts',
      description:
        'Add NEW concepts that have not been seen before in the running study guide. Each concept must include a short definition and an emphasis score 0..1.',
      parameters: {
        type: 'object',
        properties: {
          concepts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                definition: { type: 'string' },
                emphasis: { type: 'number', minimum: 0, maximum: 1 },
                practice_questions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional. Required if emphasis >= 0.6.',
                },
              },
              required: ['name', 'definition', 'emphasis'],
            },
          },
        },
        required: ['concepts'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_concept',
      description:
        "Refine an existing concept's definition, bump its emphasis, or add practice questions. Use when the lecture re-emphasizes or expands a concept already in the guide.",
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Must match an existing concept exactly.' },
          new_definition: { type: 'string' },
          new_emphasis: { type: 'number', minimum: 0, maximum: 1 },
          add_practice_questions: { type: 'array', items: { type: 'string' } },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'flag_assignment',
      description:
        'Record an assignment, project, or problem set explicitly mentioned by the professor.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          due_date: { type: 'string', description: 'ISO format YYYY-MM-DD.' },
          requirements: { type: 'array', items: { type: 'string' } },
          source_quote: { type: 'string', description: 'Verbatim quote from the transcript.' },
        },
        required: ['title', 'due_date', 'source_quote'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'flag_unclear',
      description:
        'Mark a passage that was rushed or ambiguous as a question to ask in office hours.',
      parameters: {
        type: 'object',
        properties: {
          passage: { type: 'string' },
          drafted_question: { type: 'string' },
        },
        required: ['passage', 'drafted_question'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_topic_summary',
      description:
        "Update the one-sentence topic summary for the entire lecture. Call sparingly — only when you have new evidence the topic is different from what's currently set.",
      parameters: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
    },
  },
];

function snapshotForPrompt(s: Session): string {
  const guide = s.study_guide;
  return JSON.stringify(
    {
      topic_summary: guide.topic_summary,
      concepts: guide.concepts.map((c) => ({
        name: c.name,
        emphasis: c.emphasis,
        has_questions: c.practice_questions.length > 0,
      })),
      assignments: guide.assignments.map((a) => ({ title: a.title, due_date: a.due_date })),
    },
    null,
    2,
  );
}

export async function processChunk(
  sessionId: string,
  chunkIndex: number,
  transcript: string,
): Promise<void> {
  const session = getSession(sessionId);
  if (!session) return;

  const openai = getClient();

  const userMsg = `Chunk ${chunkIndex + 1} of ${session.chunks_total}.

NEW TRANSCRIPT CHUNK:
"""
${transcript}
"""

CURRENT STUDY GUIDE STATE:
${snapshotForPrompt(session)}

Decide which tools to call for this chunk. Stop calling tools when you have nothing to add.`;

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMsg },
  ];

  // Tool-use loop. Cap at a few iterations per chunk to bound latency.
  for (let i = 0; i < 4; i++) {
    const response = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 1000,
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
    });

    const choice = response.choices[0];
    const toolCalls = choice?.message?.tool_calls ?? [];

    if (toolCalls.length === 0 || choice.finish_reason !== 'tool_calls') {
      break;
    }

    // Append the assistant message (with tool_calls) so the model can see its own decisions.
    messages.push({
      role: 'assistant',
      content: choice.message.content ?? '',
      tool_calls: toolCalls,
    });

    // Apply each tool call and feed back the result as a 'tool' role message.
    for (const t of toolCalls) {
      const result = applyToolCall(sessionId, chunkIndex, t);
      messages.push({
        role: 'tool',
        tool_call_id: t.id,
        content: result,
      });
    }
  }
}

function applyToolCall(
  sessionId: string,
  chunkIndex: number,
  call: ChatCompletionMessageToolCall,
): string {
  if (call.type !== 'function') return `unsupported tool type: ${call.type}`;
  let input: unknown;
  try {
    input = JSON.parse(call.function.arguments || '{}');
  } catch {
    return `invalid JSON arguments for ${call.function.name}`;
  }
  return applyTool(sessionId, chunkIndex, call.function.name, input);
}

function applyTool(
  sessionId: string,
  chunkIndex: number,
  name: string,
  input: unknown,
): string {
  const session = getSession(sessionId);
  if (!session) return 'no session';
  const guide = session.study_guide;

  try {
    if (name === 'extract_concepts') {
      const { concepts } = input as {
        concepts: Array<{
          name: string;
          definition: string;
          emphasis: number;
          practice_questions?: string[];
        }>;
      };
      const added: string[] = [];
      for (const c of concepts) {
        if (guide.concepts.some((x) => x.name.toLowerCase() === c.name.toLowerCase())) {
          continue; // dedupe
        }
        const concept: Concept = {
          id: randomUUID(),
          name: c.name,
          definition: c.definition,
          emphasis: clamp01(c.emphasis),
          practice_questions: c.practice_questions ?? [],
          first_seen_chunk: chunkIndex,
        };
        // Cap at 10 concepts; replace lowest if new outranks it.
        if (guide.concepts.length >= 10) {
          let lowestIdx = 0;
          for (let i = 1; i < guide.concepts.length; i++) {
            if (guide.concepts[i].emphasis < guide.concepts[lowestIdx].emphasis) lowestIdx = i;
          }
          if (concept.emphasis > guide.concepts[lowestIdx].emphasis) {
            guide.concepts[lowestIdx] = concept;
            emit(sessionId, { type: 'concept_update', concept });
            added.push(concept.name);
          }
        } else {
          guide.concepts.push(concept);
          emit(sessionId, { type: 'concept', concept });
          added.push(concept.name);
        }
      }
      updateSession(sessionId, { study_guide: guide });
      return `added ${added.length} concept(s): ${added.join(', ') || 'none'}`;
    }

    if (name === 'update_concept') {
      const { name: cname, new_definition, new_emphasis, add_practice_questions } = input as {
        name: string;
        new_definition?: string;
        new_emphasis?: number;
        add_practice_questions?: string[];
      };
      const concept = guide.concepts.find(
        (c) => c.name.toLowerCase() === cname.toLowerCase(),
      );
      if (!concept) return `concept not found: ${cname}`;
      if (new_definition) concept.definition = new_definition;
      if (typeof new_emphasis === 'number') concept.emphasis = clamp01(new_emphasis);
      if (add_practice_questions?.length) {
        concept.practice_questions = [
          ...concept.practice_questions,
          ...add_practice_questions,
        ];
      }
      updateSession(sessionId, { study_guide: guide });
      emit(sessionId, { type: 'concept_update', concept });
      return `updated ${concept.name}`;
    }

    if (name === 'flag_assignment') {
      const a = input as Omit<Assignment, 'id' | 'detected_at_chunk' | 'requirements'> & {
        requirements?: string[];
      };
      // Dedupe by (title + due_date).
      if (
        guide.assignments.some(
          (x) =>
            x.title.toLowerCase() === a.title.toLowerCase() && x.due_date === a.due_date,
        )
      ) {
        return 'duplicate, ignored';
      }
      const assignment: Assignment = {
        id: randomUUID(),
        title: a.title,
        due_date: a.due_date,
        requirements: a.requirements ?? [],
        source_quote: a.source_quote,
        detected_at_chunk: chunkIndex,
      };
      guide.assignments.push(assignment);
      updateSession(sessionId, { study_guide: guide });
      emit(sessionId, { type: 'assignment', assignment });
      return `recorded assignment: ${assignment.title}`;
    }

    if (name === 'flag_unclear') {
      const { passage, drafted_question } = input as {
        passage: string;
        drafted_question: string;
      };
      const q: FlaggedQuestion = {
        id: randomUUID(),
        passage,
        drafted_question,
        detected_at_chunk: chunkIndex,
      };
      guide.questions.push(q);
      updateSession(sessionId, { study_guide: guide });
      emit(sessionId, { type: 'question', question: q });
      return 'flagged';
    }

    if (name === 'set_topic_summary') {
      const { text } = input as { text: string };
      guide.topic_summary = text;
      updateSession(sessionId, { study_guide: guide });
      emit(sessionId, { type: 'topic_summary', text });
      return 'updated';
    }

    return `unknown tool: ${name}`;
  } catch (e) {
    return `tool error: ${(e as Error).message}`;
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
