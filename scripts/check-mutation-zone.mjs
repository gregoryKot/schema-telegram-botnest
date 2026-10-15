#!/usr/bin/env node
// Гейт «файл, выделенный из файла мутационной зоны, не выпадает из зоны молча».
//
// Класс (nightly golden-auth, issue #614, 2026-10): #625 вынес `redact()` из
// security-log.service.ts в security-log-redact.ts. Сервис остался в `mutate`
// конфига Stryker, а новый файл — нет: код редакции секретов перед логом/DM
// ушёл из-под мутационного замера, и ни один гейт этого не заметил.
// `check-mutation-ratchet.mjs` о таком файле только печатает предупреждение,
// а тихо исчезнуть из зоны проще всего именно при дроблении по правилу №10.
//
// Что делает. Зона = объединение `mutate` всех stryker*.config.json. Кандидат —
// файл вне зоны (src/**, shared/src/**, без спеков), у которого ВСЕ
// нетестовые импортёры лежат в зоне: он либо выделен из файла
// зоны, либо живёт только ради него. Каждый кандидат обязан быть классифицирован
// в scripts/mutation-zone-baseline.json — `{ "reason": "…" }`: «ещё не в зоне,
// это долг» — допустимая запись, молчаливое отсутствие записи — нет. Новый файл,
// выделенный из файла зоны, краснеет сразу: автор либо добавляет его в `mutate`
// (и пол в бейслайн храповика по результату прогона), либо вносит запись
// с честной причиной — и она видна в диффе PR.
//
// Чего гейт не видит (честно, чтобы класс не считали закрытым целиком):
//  - файл, выделенный из файла зоны, но ещё и импортируемый кодом вне зоны
//    (booking-notify.service.ts, totp.service.ts, max-init-data.ts,
//    login-ticket.service.ts — AUDIT_2026-10_FINDINGS.md), кандидатом не
//    считается: «все импортёры в зоне» — единственный дешёвый признак
//    «выделен ради зоны». Эти файлы классифицируются глазами при дроблении;
//  - зона — объединение ВСЕХ stryker*.config.json, включая зонтичный
//    stryker.config.json (ручной `npm run mutation`, в nightly не гоняется;
//    ночью работают stryker.golden-*.config.json): файл, добавленный только
//    туда, в зону для гейта входит, но ночным замером не измеряется.
// Файл только с типами (interface/type, `import type`) кандидатом не считается:
// в нём нечего мутировать, а запись «мутации не измеряются» про него была бы
// ложным долгом (правило №15 п.4). Признак — isTypeOnly().
//
// Гейт ищет не признак, а требует классификации — как check-cron-leader.mjs.
// Флага --update нет намеренно: это решение человека, не счётчик. Протухшая
// запись (файл удалён, вошёл в зону или у него появился импортёр вне зоны)
// тоже красная: не уборка, а сигнал «сверься, что произошло».
import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, join, normalize, resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'mutation-zone-baseline.json');
const SCAN_DIRS = ['src', 'shared/src'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'test-support']);
// Слова-отписки (правило №15): причина «потом» — это молчание, а не причина.
const REASON_RED_FLAGS = ['legacy', 'todo', 'потом', 'позже'];
const MIN_REASON = 20;

const isTestFile = (rel) => /\.(spec|test)\.tsx?$/.test(rel);

function walk(dir, out = []) {
  if (!existsSync(join(ROOT, dir))) return out;
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(rel, out);
    } else if (/\.tsx?$/.test(e.name) && !/\.d\.ts$/.test(e.name) && !isTestFile(rel)) {
      out.push(rel);
    }
  }
  return out;
}

/** Зона: объединение `mutate` всех конфигов Stryker в корне. */
export function readZone() {
  const zone = new Set();
  for (const f of readdirSync(ROOT)) {
    if (!/^stryker.*\.json$/.test(f)) continue;
    const cfg = JSON.parse(readFileSync(join(ROOT, f), 'utf8'));
    for (const m of cfg.mutate ?? []) zone.add(m);
  }
  return zone;
}

// `from '…'`, `import '…'`, `import('…')` (динамический) и `require('…')`.
const IMPORT_RE =
  /(?:\bfrom|\bimport\s*\(?|\brequire\s*\()\s*['"](\.{1,2}\/[^'"]+)['"]/g;

// Строки верхнего уровня, не порождающие рантайм-кода: объявления типов,
// `import type`, `declare`. Всё остальное на нулевой колонке (const, function,
// class, enum, обычный import, реэкспорт, вызов) — рантайм, файл измеряем.
const TYPE_ONLY_LINE =
  /^(?:export\s+)?(?:declare\b|type\b|interface\b)|^import\s+type\b/;

/** Файл целиком из типов: мутировать нечего. Консервативно: сомнение = не type-only. */
export function isTypeOnly(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const topLevel = code.split('\n').filter((l) => /^[A-Za-z_$]/.test(l));
  return topLevel.length > 0 && topLevel.every((l) => TYPE_ONLY_LINE.test(l));
}

/** Относительные импорты файла, разрешённые в существующие .ts/.tsx. */
function localImports(rel) {
  const src = readFileSync(join(ROOT, rel), 'utf8');
  const found = [];
  for (const m of src.matchAll(IMPORT_RE)) {
    const base = normalize(join(dirname(rel), m[1])).split('\\').join('/');
    for (const tail of ['.ts', '.tsx', '/index.ts']) {
      if (existsSync(join(ROOT, base + tail))) {
        found.push(base + tail);
        break;
      }
    }
  }
  return found;
}

/** Кандидаты: файл вне зоны, все нетестовые импортёры которого — в зоне. */
export function findCandidates(zone) {
  const files = SCAN_DIRS.flatMap((d) => walk(d));
  const importers = new Map();
  for (const f of files) {
    for (const t of localImports(f)) {
      if (!importers.has(t)) importers.set(t, new Set());
      importers.get(t).add(f);
    }
  }
  const out = new Map();
  for (const [target, from] of importers) {
    if (zone.has(target)) continue;
    if (isTypeOnly(readFileSync(join(ROOT, target), 'utf8'))) continue;
    if ([...from].every((f) => zone.has(f))) out.set(target, [...from].sort());
  }
  return out;
}

function reasonProblem(reason) {
  if (typeof reason !== 'string' || reason.trim().length < MIN_REASON)
    return `причина короче ${MIN_REASON} символов`;
  const low = reason.toLowerCase();
  const flag = REASON_RED_FLAGS.find((w) => low.includes(w));
  return flag ? `причина-отписка («${flag}»)` : null;
}

function main() {
  const zone = readZone();
  const candidates = findCandidates(zone);
  const baseline = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    : {};
  const problems = [];

  for (const [file, from] of candidates) {
    const entry = baseline[file];
    if (!entry) {
      problems.push(
        `${file} (импортируется только из зоны: ${from.join(', ')}) — не в \`mutate\` ` +
          'и не классифицирован',
      );
      continue;
    }
    const bad = reasonProblem(entry.reason);
    if (bad) problems.push(`${file}: запись в бейслайне — ${bad}`);
  }
  for (const file of Object.keys(baseline)) {
    if (candidates.has(file)) continue;
    problems.push(
      `протухшая запись ${file}: файл удалён, вошёл в зону или у него появился ` +
        'импортёр вне зоны — сверься и убери запись',
    );
  }

  if (problems.length > 0) {
    console.error('❌ гейт мутационной зоны: файл выпал из зоны Stryker молча:');
    for (const p of problems) console.error(`   ${p}`);
    console.error(
      '\nФайл, выделенный из файла зоны, измеряется мутациями только если он в\n' +
        '`mutate` конфига stryker.*.config.json. Добавь его туда (пол в бейслайн\n' +
        'храповика — только по результату прогона `npm run mutation:…`) либо внеси\n' +
        'запись в scripts/mutation-zone-baseline.json с честной причиной.\n' +
        'Флага --update нет: это классификация, а не счётчик.',
    );
    process.exit(1);
  }
  console.log(
    `✓ гейт мутационной зоны: ${zone.size} файлов в зоне, ` +
      `${candidates.size} выделенных вне неё классифицировано`,
  );
}

if (resolve(process.argv[1] ?? '') === resolve(import.meta.filename)) main();
