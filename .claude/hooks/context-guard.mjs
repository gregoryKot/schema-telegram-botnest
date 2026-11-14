#!/usr/bin/env node
// Хук-сторож длинной сессии: контекст вырос или сжимался — начатую задачу передать новой
// сессии (или довести здесь), новую не начинать. Каждый шаг оплачивает весь контекст заново.
// События: UserPromptSubmit и SessionStart(compact) — строка в stdout;
// PostToolUse (мерж PR) — JSON additionalContext. Ниже порога молчит, не падает.
import { closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LIMIT = Number(process.env.CLAUDE_CONTEXT_GUARD_TOKENS) || 120_000;
const TAIL = 512 * 1024;
const BOUNDARY = '"subtype":"compact_boundary"';

/** Размер контекста по последней записи usage основной ветки журнала. */
export function contextTokens(tail) {
  const lines = tail.split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    const at = line.indexOf('"usage":{');
    if (at < 0 || line.includes('"isSidechain":true')) continue;
    const usage = line.slice(at, at + 400);
    const num = (key) => Number(new RegExp(`"${key}":(\\d+)`).exec(usage)?.[1] ?? 0);
    return (
      num('input_tokens') + num('cache_creation_input_tokens') + num('cache_read_input_tokens')
    );
  }
  return 0;
}

/** Читает журнал кусками: число сжатий и хвост для замера. */
export function readTranscript(path) {
  const fd = openSync(path, 'r');
  try {
    const size = fstatSync(fd).size;
    const chunk = Buffer.alloc(4 * 1024 * 1024);
    let compactions = 0;
    let carry = '';
    let tail = '';
    for (let pos = 0; pos < size; ) {
      const n = readSync(fd, chunk, 0, chunk.length, pos);
      if (n <= 0) break;
      const text = carry + chunk.toString('utf8', 0, n);
      compactions += text.split(BOUNDARY).length - 1;
      carry = text.slice(-BOUNDARY.length + 1);
      tail = (tail + chunk.toString('utf8', 0, n)).slice(-TAIL);
      pos += n;
    }
    return { compactions, tokens: contextTokens(tail) };
  } finally {
    closeSync(fd);
  }
}

/** Текст сигнала или пустая строка, если сессия ещё дешёвая. */
export function verdict({ event, source, tokens, compactions }) {
  const compacted = event === 'SessionStart' && source === 'compact';
  if (!compacted && tokens < LIMIT && compactions < 1) return '';
  const why = [
    tokens >= LIMIT ? `контекст ~${Math.round(tokens / 1000)} тыс. токенов` : '',
    compacted || compactions ? 'контекст уже сжимался, детали потеряны' : '',
  ].filter(Boolean);
  const head = `СТОРОЖ СЕССИИ: ${why.join('; ')} — каждый шаг здесь оплачивает всё это заново.`;
  const pass =
    'Остаток начатой задачи передай: записка по .claude/skills/handoff/SKILL.md, затем 1) start_session (user_asked, fresh, бриф со ссылкой на записку) и архив этой сессии; ' +
    '2) отказ, а тебя запустила другая сессия — закончи ход отчётом «нужно продолжение: записка <путь>», продолжение запустит она; ' +
    '3) не вышло и это — доводи здесь до мержа. Владельца не жди ни в одном случае.';
  if (event === 'PostToolUse') return `${head} PR вмержен: проверь деплой. ${pass}`;
  return (
    `${head} Начатая задача не новая: её доводят до мержа и деплоя; осталась пара шагов ` +
    `(CI, мерж) — доведи здесь. ${pass} Новую задачу здесь не начинай — запусти её в новой ` +
    'сессии; не дают — скажи владельцу одной строкой и остановись. ' +
    'Владелец написал «продолжай здесь» — продолжай.'
  );
}

function main() {
  try {
    const input = JSON.parse(readStdin() || '{}');
    const event = input.hook_event_name ?? '';
    let measured = { tokens: 0, compactions: 0 };
    try {
      if (input.transcript_path) measured = readTranscript(input.transcript_path);
    } catch {
      // Журнала ещё нет — судим только по событию.
    }
    const text = verdict({ event, source: input.source, ...measured });
    if (!text) return;
    if (event === 'PostToolUse') {
      process.stdout.write(
        JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } }),
      );
    } else {
      process.stdout.write(text + '\n');
    }
  } catch {
    // Сторож не имеет права мешать работе: любая ошибка — молча.
  }
}

function readStdin() {
  const buf = Buffer.alloc(1024 * 1024);
  let out = '';
  for (;;) {
    const n = readSync(0, buf, 0, buf.length, null);
    if (n <= 0) return out;
    out += buf.toString('utf8', 0, n);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
