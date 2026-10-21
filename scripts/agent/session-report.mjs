#!/usr/bin/env node
// Отчёт «куда ушёл контекст» по журналу хука .claude/hooks/log-tool-use.mjs.
//
// Зачем: «что съедает токены» решалось по ощущениям агента. Журнал хука пишет
// на каждый вызов инструмента, сколько знаков его ответ внёс в контекст, и
// какие правила `.claude/rules/` подгрузились. Отчёт сворачивает это в ответ:
// самые дорогие вызовы, повторные чтения одного файла, доля документов и кода,
// загруженные правила. Его читает навык /retro.
//
//   node scripts/agent/session-report.mjs              # последняя сессия
//   node scripts/agent/session-report.mjs --all        # весь журнал
//   node scripts/agent/session-report.mjs --log <путь> # другой журнал
//
// Знаки — не токены: для сравнения вызовов между собой, не для счёта денег.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TOP = 10;
const BIG_BASH = 5000;

/** Строки журнала → объекты; битые строки пропускаются. */
export function parseLog(text) {
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      // Недописанная строка (хук прервали) — не повод терять отчёт.
    }
  }
  return out;
}

/** Записи последней сессии (по последней записи журнала). */
export function lastSession(entries) {
  const last = entries.at(-1)?.session;
  return last === undefined ? [] : entries.filter((e) => e.session === last);
}

const isDoc = (t) => /\.md$/.test(t) || t.startsWith('docs/') || t.startsWith('.claude/');

/** Сводка по записям: итоги, разбивка по инструментам, дорогие и повторные вызовы. */
export function summarize(entries) {
  const tools = entries.filter((e) => e.tool !== undefined);
  const total = tools.reduce((s, e) => s + (e.chars || 0), 0);
  const byTool = {};
  for (const e of tools) {
    const t = (byTool[e.tool] ??= { calls: 0, chars: 0 });
    t.calls += 1;
    t.chars += e.chars || 0;
  }
  const reads = tools.filter((e) => e.tool === 'Read');
  const readCount = {};
  for (const e of reads) readCount[e.target] = (readCount[e.target] || 0) + 1;
  const repeated = Object.entries(readCount)
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1]);
  const docChars = reads.filter((e) => isDoc(e.target)).reduce((s, e) => s + (e.chars || 0), 0);
  const codeChars = reads.filter((e) => !isDoc(e.target)).reduce((s, e) => s + (e.chars || 0), 0);
  const top = [...tools].sort((a, b) => (b.chars || 0) - (a.chars || 0)).slice(0, TOP);
  const bigBash = tools.filter((e) => e.tool === 'Bash' && (e.chars || 0) > BIG_BASH);
  const rules = entries
    .filter((e) => e.event === 'InstructionsLoaded')
    .map((e) => ({ file: e.target, reason: e.reason, by: e.by }));
  return { calls: tools.length, total, byTool, top, repeated, docChars, codeChars, bigBash, rules };
}

const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)} тыс.` : String(n));

/** Сводка → текст отчёта (пустой журнал — честное «нет данных»). */
export function format(s) {
  if (s.calls === 0 && s.rules.length === 0) {
    return 'Журнал пуст: хук .claude/hooks/log-tool-use.mjs ещё ничего не записал в этой сессии.';
  }
  const lines = [`Вызовов инструментов: ${s.calls}, внесено в контекст ≈ ${k(s.total)} знаков.`, ''];
  lines.push('По инструментам:');
  for (const [tool, v] of Object.entries(s.byTool).sort((a, b) => b[1].chars - a[1].chars)) {
    lines.push(`  ${tool}: ${v.calls} вызовов, ${k(v.chars)} знаков`);
  }
  lines.push('', `Чтение файлов: документы ${k(s.docChars)} знаков, код ${k(s.codeChars)} знаков.`);
  lines.push('', `Самые дорогие вызовы (топ ${TOP}):`);
  for (const e of s.top) lines.push(`  ${k(e.chars || 0).padStart(10)}  ${e.tool}  ${e.target}`);
  if (s.repeated.length) {
    lines.push('', 'Один файл прочитан несколько раз:');
    for (const [file, n] of s.repeated) lines.push(`  ${n}×  ${file}`);
  }
  if (s.bigBash.length) {
    lines.push('', `Команды с выводом больше ${k(BIG_BASH)} знаков — сократить (tail, grep, --silent):`);
    for (const e of s.bigBash) lines.push(`  ${k(e.chars)}  ${e.target}`);
  }
  if (s.rules.length) {
    lines.push('', 'Загружены инструкции:');
    for (const r of s.rules) lines.push(`  ${r.file} (${r.reason}${r.by ? ` ← ${r.by}` : ''})`);
  }
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--log');
  const file = i >= 0 ? args[i + 1] : join(ROOT, '.claude', 'state', 'tool-log.jsonl');
  const entries = existsSync(file) ? parseLog(readFileSync(file, 'utf8')) : [];
  const scope = args.includes('--all') ? entries : lastSession(entries);
  console.log(format(summarize(scope)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
