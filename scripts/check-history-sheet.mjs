#!/usr/bin/env node
// Гейт «оверлей обязан жить в истории браузера» (.claude/rules/frontend.md, «Новый
// fullscreen-лист или оверлей в webapp»).
//
// Любой `.tsx` в webapp/src и shared/src, рисующий оверлей на весь экран, — `position: fixed`
// и `inset: 0` в объекте стиля, классах className или в style со спредами и классами одного
// элемента вместе, ЛИБО тег рамки (`<ExScreen`, `<BottomSheetShell`, `<Dialog`, `<ConfirmDialog`),
// — обязан вызывать `useHistorySheet(`. Иначе «Назад» браузера уводит со страницы.
//
// Решение — по компоненту (объявлению верхнего уровня): хук листа в одном компоненте не
// закрывает чек-ин без хука в соседнем, а компонент рисует не больше оверлеев, чем вызывает
// хук. Законные исключения (бэкдроп, рамка с хуком у потребителя, шаг потока, ветки одного
// листа, подтверждение поверх листа) — записи scripts/history-sheet-baseline.json:
// { "<файл>": { reason, since, components?: [имена без хука], overlays?: { "<имя>": N } } }.
// Флага --update нет: это классификация решения человека, не счётчик. Протухшая запись (файл
// получил хук, перестал быть оверлеем, число оверлеев сменилось) — красное: «сверься».
//
// Распознавание — history-sheet-detect.mjs, -css.mjs и -jsx.mjs, сверка с записью —
// history-sheet-judge.mjs. Тесты — src/test-support/gates/history-sheet*.spec.ts.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { frameOverlays, inlineOverlays, overlaysByComponent } from './history-sheet-detect.mjs';
import { classDeclarations, classOverlays, overlayClassSet } from './history-sheet-css.mjs';
import { judgeFile, needsEntry } from './history-sheet-judge.mjs';
import { elementOverlays } from './history-sheet-jsx.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'history-sheet-baseline.json');
const SCAN_DIRS = ['webapp/src', 'shared/src'];
const REASON_RED_FLAGS = ['legacy', 'todo', 'потом', 'позже'];
const SKIP_DIR = new Set(['node_modules', 'dist', 'coverage']);
const isTest = (name) => /\.(?:test|spec)\.tsx?$|\.test-helpers\./.test(name);

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(join(ROOT, dir));
  } catch {
    return acc;
  }
  for (const name of entries) {
    if (SKIP_DIR.has(name) || name.startsWith('.')) continue;
    const rel = join(dir, name);
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, acc);
    else acc.push(rel.split('\\').join('/'));
  }
  return acc;
}

function loadBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    console.error('Нет бейслайна — scripts/history-sheet-baseline.json обязан существовать\n(флага --update нет: классификация вносится руками).');
    process.exit(1);
    return {};
  }
}

function checkReason(key, entry) {
  const reason = String(entry?.reason ?? '').trim();
  if (reason.length < 20) return `${key}: причина короче 20 символов`;
  const flag = REASON_RED_FLAGS.find((w) => reason.toLowerCase().includes(w));
  if (flag) return `${key}: причина похожа на отписку (слово «${flag}»)`;
  if (!String(entry?.since ?? '').trim()) return `${key}: нет поля since (коммит/PR, где решение принято)`;
  return null;
}

function main() {
  const files = SCAN_DIRS.flatMap((d) => walk(d));
  const decls = classDeclarations(files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(ROOT, f), 'utf8')));
  const overlays = new Map(); // файл → [{ name, hook, calls, hits }] по компонентам
  for (const rel of files.filter((f) => f.endsWith('.tsx') && !isTest(f))) {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    const hits = [...inlineOverlays(src), ...classOverlays(src, decls), ...elementOverlays(src, decls), ...frameOverlays(src)];
    if (hits.length) overlays.set(rel, overlaysByComponent(src, hits));
  }

  const baseline = loadBaseline();
  const problems = [];
  const missing = [];
  for (const [file, comps] of overlays) {
    const verdict = judgeFile(file, comps, baseline[file]);
    missing.push(...verdict.missing);
    problems.push(...verdict.problems);
  }
  if (missing.length) {
    problems.unshift('оверлеи без useHistorySheet и без записи в scripts/history-sheet-baseline.json:', ...missing);
  }
  for (const [key, entry] of Object.entries(baseline)) {
    if (!overlays.has(key)) problems.push(`протухшая запись: ${key} — оверлея в файле больше нет (или файла нет)`);
    else if (!needsEntry(overlays.get(key))) problems.push(`протухшая запись: ${key} — оверлеи файла уже вызывают useHistorySheet, убери запись`);
    else {
      const bad = checkReason(key, entry);
      if (bad) problems.push(bad);
    }
  }

  if (problems.length) {
    console.error('❌ Гейт оверлеев и истории браузера (.claude/rules/frontend.md, «Новый fullscreen-лист или оверлей в webapp»):\n');
    for (const p of problems) console.error(p);
    console.error(
      '\nОверлей на весь экран без useHistorySheet: «Назад» браузера уводит со страницы\n' +
        'или закрывает родительский лист вместе с ним. Вызови хук один раз в теле\n' +
        'компонента и пусти все «Назад»/«Закрыть» через goBack(). Если оверлею хук не\n' +
        'нужен (бэкдроп под листом, рамка, лендинг, хук у вызывающего) — запись\n' +
        '  "<файл>": { "reason": "честная причина", "since": "<коммит/PR>" }\n' +
        '(несколько компонентов без хука — ещё "components": ["Имя", …]; оверлеев в компоненте\n' +
        'больше, чем вызовов хука, — "overlays": { "Имя": N }) в scripts/history-sheet-baseline.json.',
    );
    process.exit(1);
  }
  const withHook = [...overlays.values()].filter((comps) => !needsEntry(comps)).length;
  console.log(
    `✓ гейт оверлеев: ${overlays.size} файлов-оверлеев (${withHook} с useHistorySheet, ${overlays.size - withHook} в бейслайне), ` +
      `${overlayClassSet(decls).size} CSS-классов-оверлеев.`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
