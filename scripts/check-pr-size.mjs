#!/usr/bin/env node
// Размер PR: красный, если закоммиченный дифф ветки с origin/main больше
// 60 файлов или 1500 изменённых строк (добавленные + удалённые). PR крупнее
// не проверит ни владелец, ни субагент-ревьюер.
//
// Не считаются чистые переименования и пути из EXCLUDED (бейслайны,
// lock-файлы, test/fixtures). Обход — метка PR `big-pr`: читается из события
// PR ($GITHUB_EVENT_PATH), поэтому в CI шаг идёт только на pull_request.
//
// Локально считает против своего origin/main — сначала обнови его:
//   git fetch origin main && node scripts/check-pr-size.mjs
import { readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'origin/main';
const MAX_FILES = 60;
const MAX_LINES = 1500;
const LABEL = 'big-pr';

// Пути, чей размер не говорит об объёме ревью: их пишет инструмент, а не автор.
export const EXCLUDED = [
  /-baseline\.json$/, // бейслайны храповиков: пишет `--update`
  /(^|\/)package-lock\.json$/, // пишет npm install
  /^test\/fixtures\//, // записанные ответы внешних площадок
];

/**
 * Новые пути чистых переименований (R100) из `git diff --name-status -z -M`.
 * По numstat их не узнать: у бинарного файла там `-`/`-` и без правок.
 */
export function pureRenames(nameStatus) {
  const tokens = nameStatus.split('\0');
  const pure = new Set();
  for (let i = 0; i < tokens.length && tokens[i]; i += 2) {
    if (!/^[RC]/.test(tokens[i])) continue;
    if (tokens[i] === 'R100') pure.add(tokens[i + 2]);
    i += 1;
  }
  return pure;
}

/**
 * Файлы и строки из вывода `git diff --numstat -z -M`. Запись — `+\t-\tпуть\0`;
 * у переименования путь пуст, а старое и новое имя идут двумя токенами следом.
 * @returns {{files: number, lines: number}}
 */
export function countDiff(numstat, pure = new Set()) {
  const tokens = numstat.split('\0');
  let files = 0;
  let lines = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (!tokens[i]) continue;
    const [added, deleted, ...rest] = tokens[i].split('\t');
    let path = rest.join('\t');
    const renamed = path === '';
    if (renamed) {
      path = tokens[i + 2] ?? '';
      i += 2;
    }
    if (renamed && pure.has(path)) continue;
    if (EXCLUDED.some((re) => re.test(path))) continue;
    files += 1;
    // У бинарного файла вместо чисел `-`: файл считается, строк в нём нет.
    lines += (Number(added) || 0) + (Number(deleted) || 0);
  }
  return { files, lines };
}

/** Стоит ли на PR метка-обход. Нет события PR — метки нет. */
function hasBypassLabel() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return false;
  try {
    const event = JSON.parse(readFileSync(eventPath, 'utf8'));
    const labels = event?.pull_request?.labels;
    return Array.isArray(labels) && labels.some((l) => l?.name === LABEL);
  } catch {
    return false;
  }
}

function main() {
  const diff = (format) =>
    execFileSync('git', ['diff', format, '-z', '-M', `${BASE}...HEAD`], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  let counted;
  try {
    counted = countDiff(diff('--numstat'), pureRenames(diff('--name-status')));
  } catch (err) {
    const why = String(err.stderr || err.message).trim().split('\n')[0];
    console.error(
      `✗ размер PR: не удалось сравнить с ${BASE} (${why}). ` +
        'Локально — git fetch origin main; в CI — fetch-depth: 0 у checkout.',
    );
    process.exitCode = 1;
    return;
  }
  const { files, lines } = counted;
  const size = `размер PR: ${files} файлов, ${lines} строк`;
  if (files <= MAX_FILES && lines <= MAX_LINES) {
    console.log(`✓ ${size} (лимит ${MAX_FILES} и ${MAX_LINES}).`);
    return;
  }
  if (hasBypassLabel()) {
    console.log(
      `✓ ${size} — сверх лимита ${MAX_FILES} и ${MAX_LINES}, пропущено меткой ${LABEL}.`,
    );
    return;
  }
  console.error(
    `✗ ${size} при лимите ${MAX_FILES} файлов и ${MAX_LINES} строк ` +
      '(не считаются *-baseline.json, package-lock.json, test/fixtures/**, чистые переименования).',
  );
  console.error(
    `Что делать: раздели работу на несколько PR; делить нельзя — поставь на PR метку ${LABEL} ` +
      'и запушь в ветку: метка читается из события PR, перезапуск джобы её не увидит.',
  );
  process.exitCode = 1;
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
