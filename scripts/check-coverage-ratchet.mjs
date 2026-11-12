#!/usr/bin/env node
// Пол покрытия бэкенда: общий (lines/branches) и жёсткий по критичным каталогам —
// scripts/coverage-baseline.json. Пол фиксированный: меняет владелец правкой файла.
//
// Запускает jest сам (с --coverage) — отдельный `npx jest --silent` в CI
// не нужен, этот скрипт его заменяет.
import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { exitFlushed as exit, relayOutput } from './child-output.mjs';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'coverage-baseline.json');
const SUMMARY_PATH = join(ROOT, 'coverage', 'coverage-summary.json');
const UPDATE = process.argv.includes('--update');
if (UPDATE) {
  console.error(
    '❌ Пол покрытия фиксированный: его меняет владелец правкой ' +
      'scripts/coverage-baseline.json, --update не поддерживается.',
  );
  process.exit(1);
}

// Порог небольшой, чтобы случайный сдвиг числа строк (рефакторинг без потери
// теста) не флеймил CI на десятые доли процента.
const EPSILON = 0.1;

// CI-гигиена 4.2: если джоба задала JEST_CACHE_DIR (кэш ts-jest между
// прогонами через actions/cache), прокидываем его в спавненный jest —
// jest сам env для этого не читает, нужен CLI-флаг.
const jestArgs = ['jest', '--coverage', '--silent', '--coverageReporters=json-summary'];
if (process.env.JEST_CACHE_DIR) {
  jestArgs.push(`--cacheDirectory=${process.env.JEST_CACHE_DIR}`);
}
const res = spawnSync('npx', jestArgs, {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 512 * 1024 * 1024,
});
relayOutput(res);

if (res.error) {
  console.error('❌ не удалось запустить jest: ' + res.error.message);
  await exit(1);
}
if (res.status !== 0) {
  console.error(
    '❌ jest завершился с ошибкой (упавшие тесты?) — coverage-храповик не проверяется.',
  );
  await exit(res.status ?? 1);
}

let summary;
try {
  summary = JSON.parse(readFileSync(SUMMARY_PATH, 'utf8'));
} catch {
  console.error(
    `❌ не найден ${SUMMARY_PATH} — jest не сгенерировал coverage-summary.json.`,
  );
  await exit(1);
}

function relPath(absPath) {
  return absPath.startsWith(ROOT + '/')
    ? absPath.slice(ROOT.length + 1)
    : absPath;
}

// Агрегирует lines.total/covered всех файлов, чей относительный путь
// начинается с prefix (напр. "src/auth"), и возвращает pct покрытия строк.
function dirLinesPct(prefix) {
  const withSlash = prefix.endsWith('/') ? prefix : prefix + '/';
  let total = 0;
  let covered = 0;
  for (const [absPath, entry] of Object.entries(summary)) {
    if (absPath === 'total') continue;
    if (relPath(absPath).startsWith(withSlash)) {
      total += entry.lines.total;
      covered += entry.lines.covered;
    }
  }
  return total > 0 ? (covered / total) * 100 : null;
}

const current = {
  lines: summary.total.lines.pct,
  branches: summary.total.branches.pct,
};


let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  console.error(
    'Нет бейслайна scripts/coverage-baseline.json — верни файл из git.',
  );
  await exit(1);
}

const failures = [];

if (baseline.lines - current.lines > EPSILON) {
  failures.push(`lines: ${baseline.lines}% → ${current.lines}%`);
}
if (baseline.branches - current.branches > EPSILON) {
  failures.push(`branches: ${baseline.branches}% → ${current.branches}%`);
}

const floorFailures = [];
for (const [dir, floor] of Object.entries(baseline.floors ?? {})) {
  const pct = dirLinesPct(dir);
  if (pct === null) {
    floorFailures.push(
      `${dir}: файлов не найдено (директория удалена/переименована?)`,
    );
    continue;
  }
  if (pct < floor - 0.001) {
    floorFailures.push(`${dir}: ${pct.toFixed(2)}% < пола ${floor}%`);
  }
}

if (failures.length > 0 || floorFailures.length > 0) {
  console.error('❌ coverage-храповик: покрытие просело.');
  if (failures.length > 0) {
    console.error('Общий бейслайн:');
    for (const f of failures) console.error(`   ${f}`);
  }
  if (floorFailures.length > 0) {
    console.error('Жёсткий пол по директориям:');
    for (const f of floorFailures) console.error(`   ${f}`);
  }
  console.error(
    'Покрытие ниже пола: допиши тест на новую логику. Пол меняет владелец ' +
      'правкой scripts/coverage-baseline.json.',
  );
  await exit(1);
}

console.log(
  `✓ coverage-храповик: lines ${current.lines}% (пол ${baseline.lines}%), ` +
    `branches ${current.branches}% (пол ${baseline.branches}%)`,
);
