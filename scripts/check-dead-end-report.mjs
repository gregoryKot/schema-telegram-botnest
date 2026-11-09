#!/usr/bin/env node
// Гейт «экран-тупик шлёт отчёт наверх» (правило №14, аудит 2026-10).
//
// Обработанная авария невидимее необработанной: `catch` ловит отказ и рисует
// экран «не удалось», пользователь видит, а мы — нет. По аудиту 2026-10 отчёт
// наверх был у 3 из 13 страниц с таким исходом; `SubscribePage` показывал «Не
// удалось загрузить подписку» и молчал.
//
// Гейт не угадывает, «настоящий ли это тупик», — он требует классификации
// (образец — check-cron-leader.mjs). Исход ищется в `catch`-ветке (try/catch и
// `.catch(…)`) файлов `webapp/src/pages/**` и `webapp/src/components/*/**`:
// вызов сеттера с Error/Err/Fail в имени (`setLoadError(…)`, `setFailed(true)`)
// или с исходом-литералом (`setStatus('error')`, `setState({ kind: 'failed' })`).
// Ключ — `<файл>::<сеттер>`: одно состояние ошибки — одно решение, сколько бы
// веток его ни ставили. Запись в `scripts/dead-end-report-baseline.json`:
//   reports — каждая ветка с этим сеттером зовёт отчёт (`reportClientError(`,
//             `report…(`, `handleLoadFailure(`, `handleBookingFailure(`) в теле `catch`; отчёт по
//             состоянию хуком — поле `via` с именем хука, он обязан быть в файле;
//   exempt  — отчёт не нужен, причина (админка владельца, ошибка действия рядом
//             с кнопкой при рабочем экране);
//   debt    — тупик без отчёта, честный долг с причиной; виден в итоге гейта.
// Незаклассифицированный исход, протухшая запись, `reports` без отчёта,
// причина короче 20 символов — красное. Флага --update нет: это решение.
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { stripComments } from './gate-strip-comments.mjs';
import { matchBrace, matchParen, lineAt } from './gate-balance.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'dead-end-report-baseline.json');
const STATUSES = ['reports', 'exempt', 'debt'];
const REASON_RED_FLAGS = ['legacy', 'todo', 'потом', 'позже'];
const OUTCOME_RE =
  /\b(set\w*(?:Error|Err|Fail|Failed|Failure)\w*)\s*\(|\b(set\w*)\s*\(\s*(?:'(?:error|failed|fail)'|\{\s*kind:\s*'(?:error|failed)')/g;
const REPORT_RE = /\b(?:report[A-Z]\w*|handleLoadFailure|handleBookingFailure)\s*\(/;

function walk(rel, acc = []) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) return acc;
  for (const name of readdirSync(abs)) {
    const r = `${rel}/${name}`;
    if (statSync(join(ROOT, r)).isDirectory()) walk(r, acc);
    else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$|\.d\.ts$|test-helpers/.test(name)) acc.push(r);
  }
  return acc;
}

export function scopeFiles() {
  const files = walk('webapp/src/pages');
  const comps = join(ROOT, 'webapp/src/components');
  if (existsSync(comps)) {
    for (const name of readdirSync(comps)) {
      if (statSync(join(comps, name)).isDirectory()) walk(`webapp/src/components/${name}`, files);
    }
  }
  return files;
}

/** catch-ветки файла с исходом-ошибкой: [{ setter, reports, line }]. */
export function findOutcomes(rawSrc) {
  const src = stripComments(rawSrc);
  const out = [];
  const re = /\bcatch\s*(?:\(\s*[\w$]*\s*(?::\s*\w+\s*)?\))?\s*\{|\.catch\(/g;
  let m;
  while ((m = re.exec(src))) {
    const open = m.index + m[0].length - 1;
    const close = m[0].startsWith('.') ? matchParen(src, open) : matchBrace(src, open);
    if (close === -1) continue;
    const body = src.slice(open, close + 1);
    const setters = new Set([...body.matchAll(OUTCOME_RE)].map((x) => x[1] ?? x[2]));
    for (const setter of setters) out.push({ setter, reports: REPORT_RE.test(body), line: lineAt(src, m.index) });
  }
  return out;
}

function reasonProblem(key, entry) {
  const reason = String(entry?.reason ?? '').trim();
  if (reason.length < 20) return `${key}: ${entry.status} без внятной причины (короче 20 символов)`;
  const flag = REASON_RED_FLAGS.find((w) => reason.toLowerCase().includes(w));
  return flag ? `${key}: причина похожа на отписку (слово «${flag}»)` : null;
}

function main() {
  const found = new Map();
  const sources = new Map();
  for (const rel of scopeFiles()) {
    const raw = readFileSync(join(ROOT, rel), 'utf8');
    if (!/catch/.test(raw)) continue;
    sources.set(rel, stripComments(raw));
    for (const o of findOutcomes(raw)) {
      const key = `${rel}::${o.setter}`;
      const prev = found.get(key) ?? { file: rel, lines: [], unreported: [] };
      prev.lines.push(o.line);
      if (!o.reports) prev.unreported.push(o.line);
      found.set(key, prev);
    }
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const problems = [];
  for (const [key, f] of found) {
    if (!(key in baseline)) problems.push(`${key} (L${f.lines.join(', L')}): исход ошибки без классификации`);
  }
  for (const [key, entry] of Object.entries(baseline)) {
    const f = found.get(key);
    if (!f) { problems.push(`${key}: протухшая запись — catch-ветки с этим сеттером нет`); continue; }
    if (!STATUSES.includes(entry?.status)) { problems.push(`${key}: неизвестный status «${entry?.status}» (reports|exempt|debt)`); continue; }
    if (entry.status === 'reports') {
      if (entry.via) {
        if (!new RegExp(`\\b${entry.via}\\s*\\(`).test(sources.get(f.file))) problems.push(`${key}: via «${entry.via}», но вызова в файле нет`);
      } else if (f.unreported.length) {
        problems.push(`${key}: объявлен reports, но в catch (L${f.unreported.join(', L')}) отчёта наверх нет`);
      }
    } else {
      const p = reasonProblem(key, entry);
      if (p) problems.push(p);
    }
  }
  if (problems.length) {
    console.error('❌ Экран-тупик без отчёта наверх (правило №14):\n');
    for (const p of problems) console.error(`   ${p}`);
    console.error(
      '\ncatch, рисующий экран «не удалось», обязан звать reportClientError (или хук отчёта)\n' +
        'либо стоять в scripts/dead-end-report-baseline.json: "<файл>::<сеттер>":\n' +
        '{ "status": "reports" | "exempt" | "debt", "reason": "…", "via"?: "useAuthFailureReport" }.',
    );
    process.exit(1);
  }
  const by = (s) => Object.values(baseline).filter((e) => e.status === s).length;
  console.log(
    `✓ экраны-тупики: исходов ${found.size} — с отчётом ${by('reports')}, без отчёта по причине ${by('exempt')}, долг ${by('debt')}.`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
