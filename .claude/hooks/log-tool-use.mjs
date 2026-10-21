#!/usr/bin/env node
// Хук Claude Code: одна строка JSON на событие в .claude/state/tool-log.jsonl —
// какой инструмент, над чем и сколько знаков его ответ внёс в контекст агента.
// Сырьё для `node scripts/agent/session-report.mjs` и навыка /retro: «что
// съело токены в этой сессии» по замеру, а не по памяти агента.
//
// Хук обязан быть невидимым: ничего не печатает (stdout хука может попасть в
// контекст), никогда не падает (любая ошибка — молча exit 0) и не пишет
// содержимое файлов или ответов — только размер и короткий адрес.
// Путь журнала — первый аргумент (тест) или <проект>/.claude/state/tool-log.jsonl.
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_TARGET = 160;

/** Короткий адрес вызова: путь файла, шаблон поиска, начало команды. */
export function targetOf(input, cwd) {
  if (!input || typeof input !== 'object') return '';
  const raw =
    input.file_path ?? input.notebook_path ?? input.pattern ?? input.command ??
    input.url ?? input.query ?? input.description ?? input.skill ?? '';
  let t = String(raw).replace(/\s+/g, ' ').trim();
  if (cwd && t.startsWith(cwd + '/')) t = relative(cwd, t);
  return t.length > MAX_TARGET ? t.slice(0, MAX_TARGET) + '…' : t;
}

// Поля ответа, которые видит интерфейс, а не модель: дифф правки командой,
// исходный файл и патч у Edit/Write. Замер 2026-10-21: `bashEditDiff` давал
// 1,1 тыс. знаков у команды с выводом в одно слово.
const UI_ONLY = new Set(['bashEditDiff', 'originalFile', 'structuredPatch', 'gitDiff']);
// Правка файла возвращает модели короткое подтверждение, содержимое — нет.
const WRITE_TOOLS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit']);

/** Сколько знаков ответ инструмента внёс в контекст модели (для сравнения, не токены). */
export function contextChars(tool, response) {
  if (WRITE_TOOLS.has(tool)) return 0;
  if (!response || typeof response !== 'object' || Array.isArray(response)) return sizeOf(response);
  if (tool === 'Bash') return sizeOf(response.stdout ?? '') + sizeOf(response.stderr ?? '');
  if (tool === 'Read' && response.file && typeof response.file.content === 'string') {
    return response.file.content.length;
  }
  let n = 0;
  for (const [key, value] of Object.entries(response)) if (!UI_ONLY.has(key)) n += sizeOf(value);
  return n;
}

/** Длина значения в знаках (строка — как есть, остальное — JSON). */
export function sizeOf(response) {
  if (response == null) return 0;
  if (typeof response === 'string') return response.length;
  try {
    return JSON.stringify(response).length;
  } catch {
    return 0;
  }
}

/** Размер каждого поля ответа (имена и длины, без значений) — видно, что именно весит. */
export function fieldSizes(response) {
  if (!response || typeof response !== 'object' || Array.isArray(response)) return undefined;
  const out = {};
  for (const [key, value] of Object.entries(response)) out[key] = sizeOf(value);
  return out;
}

/** Событие хука → строка журнала (без содержимого). */
export function entryOf(event, now = new Date()) {
  const cwd = event.cwd ?? '';
  const base = {
    ts: now.toISOString(),
    session: event.session_id ?? '',
    event: event.hook_event_name ?? '',
  };
  if (event.tool_name !== undefined) {
    return {
      ...base,
      tool: event.tool_name,
      target: targetOf(event.tool_input, cwd),
      chars: contextChars(event.tool_name, event.tool_response),
      fields: fieldSizes(event.tool_response),
    };
  }
  // Прочие события: InstructionsLoaded (какой CLAUDE.md или правило и почему —
  // session_start, path_glob_match, compact…), PreCompact и т.п.
  const rel = (p) => (p && cwd && String(p).startsWith(cwd + '/') ? relative(cwd, p) : String(p ?? ''));
  return {
    ...base,
    target: rel(event.file_path),
    reason: String(event.load_reason ?? event.trigger ?? ''),
    by: rel(event.trigger_file_path),
  };
}

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    try {
      const event = JSON.parse(raw);
      const root = process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd();
      const file = process.argv[2] || join(root, '.claude', 'state', 'tool-log.jsonl');
      mkdirSync(dirname(file), { recursive: true });
      appendFileSync(file, JSON.stringify(entryOf(event)) + '\n');
    } catch {
      // Замер не должен мешать работе: любая ошибка — тишина.
    }
    process.exit(0);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
