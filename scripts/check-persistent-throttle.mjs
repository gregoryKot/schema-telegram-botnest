#!/usr/bin/env node
// Гейт-классификация «счётчик ручки живёт в Postgres» (правило №5 CLAUDE.md).
//
// Лимит `@Throttle` по умолчанию считается в памяти процесса: каждый деплой
// обнуляет окно, а на двух инстансах Amvera у каждого свой счётчик. Для
// ручек, где перебор кода или поток заявок стоит дорого, счётчик обязан жить
// в Postgres — метка `@PersistentThrottle()` (src/api/persistent-throttle.decorator.ts).
// Аудит 2026-10: метка стояла на booking/donation/subscription/2fa, а на
// `POST /api/auth/merge` (проверяет TOTP), `ticket/preview|approve`,
// `confirm-login|deny-login` (код человека — 8 символов) и `therapy/request`
// (окно 24 часа) — нет, и никто не принимал решения «в память — осознанно».
//
// Гейт НЕ ищет признак «опасной» ручки (так он молчал бы о том, чего не знает,
// — ровно как реестр кронов до check-cron-leader). Он требует РЕШЕНИЯ о каждой
// ручке, у которой есть лимит или в теле проверяется код / создаётся заявка:
//   - метка есть (на методе, на классе через `AdminThrottle()`, либо составной
//     `@PersistentThrottleLimit(...)`) — классификацией служит сам код;
//   - метки нет — запись `exempt` в scripts/persistent-throttle-baseline.json
//     с честной причиной (≥20 символов, не отписка) и `since`.
// Красное: ручка без метки и без записи; запись без причины; протухшая запись
// (маршрута больше нет, или на нём уже стоит метка).
//
// Флага --update НЕТ: это классификация решения человека, не счётчик долга.
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { parseControllerFile } from './persistent-throttle-parse.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'persistent-throttle-baseline.json');
const RED_FLAGS = ['legacy', 'todo', 'потом', 'позже'];

function controllerFiles() {
  const out = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '--', 'src'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return out.split('\n').filter((f) => /^src\/.*\.controller\.ts$/.test(f));
}

/** Ручки, требующие решения: лимит или код/заявка в теле, ключ — «METHOD /путь». */
function collect(problems) {
  const needs = new Map();
  const marked = new Set();
  for (const file of controllerFiles()) {
    const { handlers, expected } = parseControllerFile(readFileSync(join(ROOT, file), 'utf8'));
    if (handlers.length !== expected) {
      problems.push(
        `${file}: разобрано ${handlers.length} хендлеров из ${expected} HTTP-декораторов — ` +
          'разбор контроллера разошёлся с кодом, гейт слеп к файлу',
      );
    }
    for (const h of handlers) {
      if (h.marked) marked.add(h.key);
      else if (h.throttled || h.triggers) needs.set(h.key, `${file}:${h.line}`);
    }
  }
  return { needs, marked };
}

function reasonProblem(key, entry) {
  if (entry?.status !== 'exempt') return `${key}: неизвестный status «${entry?.status}» (допустимо exempt)`;
  const reason = String(entry.reason ?? '').trim();
  if (reason.length < 20) return `${key}: exempt без внятной причины (короче 20 символов)`;
  const flag = RED_FLAGS.find((w) => reason.toLowerCase().includes(w));
  if (flag) return `${key}: exempt-причина похожа на отписку (слово «${flag}»)`;
  if (!String(entry.since ?? '').trim()) return `${key}: exempt без since (коммит/PR, где решение принято)`;
  return null;
}

function main() {
  let baseline;
  try {
    baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    console.error('Нет бейслайна — scripts/persistent-throttle-baseline.json обязан существовать (флага --update нет).');
    process.exit(1);
  }
  const problems = [];
  const { needs, marked } = collect(problems);

  const fresh = [...needs.keys()].filter((k) => !(k in baseline));
  if (fresh.length) {
    problems.push(
      'ручки без решения (нет метки @PersistentThrottle и нет записи exempt в бейслайне):',
      ...fresh.map((k) => `   ${k}  (${needs.get(k)})`),
    );
  }
  const stale = Object.keys(baseline).filter((k) => !needs.has(k));
  if (stale.length) {
    problems.push(
      'протухшие записи (маршрута нет, лимит убран, либо на ручке уже стоит метка — сверься, что произошло):',
      ...stale.map((k) => `   ${k}${marked.has(k) ? '  (метка уже стоит)' : ''}`),
    );
  }
  for (const [key, entry] of Object.entries(baseline)) {
    const p = needs.has(key) ? reasonProblem(key, entry) : null;
    if (p) problems.push(p);
  }

  if (problems.length) {
    console.error('❌ Гейт «счётчик ручки в Postgres» (правило №5 CLAUDE.md):\n');
    for (const p of problems) console.error(p);
    console.error(
      '\nРучка, где перебор кода или поток заявок стоит дорого, считает попытки в Postgres:\n' +
        '  @PersistentThrottleLimit({ ... })  (или @Throttle + @PersistentThrottle())\n' +
        'Остаётся в памяти осознанно (подпись/токен не перебираются, событие аналитики и т. п.) —\n' +
        'запись в scripts/persistent-throttle-baseline.json:\n' +
        '  "METHOD /api/путь": { "status": "exempt", "reason": "честная причина", "since": "коммит/PR" }\n' +
        'Флага --update нет — это классификация решения человека, не счётчик.',
    );
    process.exit(1);
  }
  console.log(
    `✓ гейт «счётчик ручки в Postgres»: ${marked.size} ручек с меткой, ` +
      `${needs.size} осознанно в памяти — все классифицированы.`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
