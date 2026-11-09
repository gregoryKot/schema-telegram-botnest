#!/usr/bin/env node
// Гейт «оверлей обязан жить в истории браузера» (CLAUDE.md, раздел «Новый
// fullscreen-лист или оверлей в webapp»; дизайн-аудит 2026-08, кандидат из В6;
// находка аудита 2026-10 — чек-ин в ModesTab).
//
// Любой `.tsx` в webapp/src и shared/src, рисующий оверлей на весь экран —
// `position: fixed` + `inset: 0` в одном объекте стиля, className с классом,
// чьё правило в CSS делает то же самое, ЛИБО тег рамки-оверлея (`<ExScreen`,
// `<BottomSheetShell`), — обязан вызывать `useHistorySheet(`.
// Иначе «Назад» браузера уводит со страницы (или, хуже, закрывает родительский
// лист вместе с оверлеем), а Escape его не касается.
//
// Законных исключений много (бэкдропы под шторкой, лоадер, декор, лендинги, экран,
// у которого хук в вызывающем) — каждое внесено в
// scripts/history-sheet-baseline.json с причиной: { "<файл>": { reason, since } }.
// Флага --update нет: это классификация решения человека, не счётчик (как у
// cron-leader / raw-sql-live). Протухшая запись (файл получил хук, перестал быть
// оверлеем или исчез) — красное: не уборка, а сигнал «сверься, что произошло».
//
// Решение принимается по компоненту (объявлению верхнего уровня), а не по
// файлу: хук листа в одном компоненте не закрывает чек-ин без хука в соседнем
// (форма находки аудита 2026-10). Запись бейслайна закрывает один компонент
// без хука; если их в файле несколько — поле "components": [имена]. Новый
// оверлей в другом компоненте файла из бейслайна — красный. Слепая зона:
// второй оверлей в ТОМ ЖЕ компоненте, что уже вызывает хук или записан.
//
// Тесты гейта — src/test-support/gates/history-sheet.spec.ts и
// history-sheet-components.spec.ts.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { classOverlays, frameOverlays, inlineOverlays, overlayClasses, overlaysByComponent } from './history-sheet-detect.mjs';

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
    if (SKIP_DIR.has(name)) continue;
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
  const classes = new Set();
  for (const rel of files.filter((f) => f.endsWith('.css'))) {
    for (const c of overlayClasses(readFileSync(join(ROOT, rel), 'utf8'))) classes.add(c);
  }

  const overlays = new Map(); // файл → [{ name, hook, hits }] по компонентам
  for (const rel of files.filter((f) => f.endsWith('.tsx') && !isTest(f))) {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    const hits = [...inlineOverlays(src), ...classOverlays(src, classes), ...frameOverlays(src)];
    if (hits.length) overlays.set(rel, overlaysByComponent(src, hits));
  }
  const bareOf = (file) => (overlays.get(file) ?? []).filter((c) => !c.hook);

  const baseline = loadBaseline();
  const problems = [];
  const missing = [];
  const show = (file, c) => `   ${file} › ${c.name}  (L${c.hits[0].line}: ${c.hits[0].what})`;
  for (const file of overlays.keys()) {
    const bare = bareOf(file);
    const entry = baseline[file];
    if (!bare.length) continue;
    if (!entry) {
      for (const c of bare) missing.push(show(file, c));
    } else if (!Array.isArray(entry.components)) {
      if (bare.length > 1) {
        problems.push(
          `${file}: одна запись бейслайна, а компонентов-оверлеев без хука ${bare.length} ` +
            `(${bare.map((c) => c.name).join(', ')}) — хук или поле "components" с перечнем`,
        );
      }
    } else {
      for (const c of bare.filter((x) => !entry.components.includes(x.name))) missing.push(show(file, c));
      const gone = entry.components.filter((n) => !bare.some((c) => c.name === n));
      if (gone.length) problems.push(`протухшая запись: ${file} — в components ${gone.join(', ')}: хук уже есть или оверлея нет`);
    }
  }
  if (missing.length) {
    problems.unshift('оверлеи без useHistorySheet и без записи в scripts/history-sheet-baseline.json:', ...missing);
  }
  for (const [key, entry] of Object.entries(baseline)) {
    if (!overlays.has(key)) problems.push(`протухшая запись: ${key} — оверлея в файле больше нет (или файла нет)`);
    else if (!bareOf(key).length) problems.push(`протухшая запись: ${key} — оверлеи файла уже вызывают useHistorySheet, убери запись`);
    else {
      const bad = checkReason(key, entry);
      if (bad) problems.push(bad);
    }
  }

  if (problems.length) {
    console.error('❌ Гейт оверлеев и истории браузера (CLAUDE.md, «Новый fullscreen-лист или оверлей в webapp»):\n');
    for (const p of problems) console.error(p);
    console.error(
      '\nОверлей на весь экран без useHistorySheet: «Назад» браузера уводит со страницы\n' +
        'или закрывает родительский лист вместе с ним. Вызови хук один раз в теле\n' +
        'компонента и пусти все «Назад»/«Закрыть» через goBack(). Если оверлею хук не\n' +
        'нужен (бэкдроп под листом, лоадер, декор, лендинг, хук у вызывающего) — запись\n' +
        '  "<файл>": { "reason": "честная причина", "since": "<коммит/PR>" }\n' +
        '(несколько компонентов без хука в файле — ещё "components": ["Имя", …])\n' +
        'в scripts/history-sheet-baseline.json. Флага --update нет.',
    );
    process.exit(1);
  }
  const withHook = [...overlays.keys()].filter((f) => !bareOf(f).length).length;
  console.log(
    `✓ гейт оверлеев: ${overlays.size} файлов-оверлеев (${withHook} с useHistorySheet, ${overlays.size - withHook} в бейслайне), ` +
      `${classes.size} CSS-классов-оверлеев.`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
