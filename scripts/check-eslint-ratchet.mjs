#!/usr/bin/env node
// eslint-храповик (аудит 2026-07, этап 2е; правило №9 CLAUDE.md).
//
// Исторический долг (~11k ошибок, в основном unsafe-* и prettier в старом
// коде) невозможно закрыть одним PR, поэтому — храповик: суммарный счётчик
// ошибок+варнингов (без game/ — заморожен решением владельца) сравнивается
// с закоммиченным бейслайном. Рост роняет CI; снижение приветствуется —
// обнови бейслайн: node scripts/check-eslint-ratchet.mjs --update
//
// Режимы:
//   (нет флагов) — полный: eslint по каждому каталогу верхнего уровня отдельным
//     дочерним процессом (с кучей 4 ГБ: один src/ занимает ~3.2 ГБ), отчёты
//     суммируются и сверяются с бейслайном. Так гоняет CI (джоба eslint).
//   --changed — локальный частичный: только файлы, отличающиеся от origin/main
//     (плюс неотслеживаемые). Бейслайн тут не применим — красным считается
//     любая находка в изменённом файле; полную сумму по дереву сверяет CI.
//
// Требует установленных node_modules во всех четырёх пакетах (корень, webapp,
// schema-miniapp, shared) и прогнанного prisma generate — иначе typed-линт
// видит неразрешённые типы как any и счётчики уезжают вверх.
import { spawnSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import {
  changedTargets,
  lintShards,
  summarize,
  verdictChanged,
  verdictFull,
} from './eslint-ratchet-rules.mjs';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'eslint-baseline.json');
const UPDATE = process.argv.includes('--update');
const CHANGED = process.argv.includes('--changed');
// Швы для теста гейта (src/test-support/gates/): eslint по всему дереву в
// песочницу не поднять — ему нужен tsconfig, node_modules и сам бинарь.
// RATCHET_REPORT_FILE подсовывает готовый отчёт вместо запуска;
// RATCHET_ESLINT_BIN подменяет бинарь eslint (проверка нарезки и --changed).
const REPORT_FILE = process.env.RATCHET_REPORT_FILE;
const ESLINT_BIN = resolve(
  ROOT,
  process.env.RATCHET_ESLINT_BIN ?? 'node_modules/eslint/bin/eslint.js',
);

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

// eslint выходит с 1 при наличии ошибок — это норма; фатальны только сбои
// самого запуска (нет бинаря, кривой конфиг, OOM → пустой/невалидный stdout).
function parseReport(res, what) {
  try {
    return JSON.parse(res.stdout);
  } catch {
    return fail(
      `❌ eslint не отработал (${what}):\n` +
        (res.stderr || res.stdout).slice(0, 2000),
    );
  }
}

function runEslint(targets) {
  const res = spawnSync(
    process.execPath,
    [
      '--max-old-space-size=4096',
      ESLINT_BIN,
      ...targets,
      '--format',
      'json',
      '--ignore-pattern',
      'game/**',
      // Каталог без линтуемых файлов (docs/, prisma/) и явно переданный
      // игнорируемый файл — не ошибка и не варнинг в счётчике.
      '--no-error-on-unmatched-pattern',
      '--no-warn-ignored',
    ],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 },
  );
  return parseReport(res, targets.join(' '));
}

function git(...args) {
  const res = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (res.status !== 0) fail(`❌ git ${args[0]} не отработал:\n${res.stderr}`);
  return res.stdout;
}

function collectReport() {
  if (REPORT_FILE)
    return parseReport(
      { stdout: readFileSync(REPORT_FILE, 'utf8') },
      REPORT_FILE,
    );
  if (CHANGED) {
    const targets = changedTargets(
      git('diff', '--name-only', '--diff-filter=ACMR', 'origin/main'),
      git('ls-files', '--others', '--exclude-standard'),
    ).filter((p) => existsSync(join(ROOT, p)));
    if (!targets.length) {
      console.log('✓ eslint-храповик (--changed): изменённых файлов нет');
      process.exit(0);
    }
    return runEslint(targets);
  }
  const report = [];
  for (const shard of lintShards(readdirSync(ROOT, { withFileTypes: true }))) {
    console.log(`  eslint ${shard.join(' ')}`);
    report.push(...runEslint(shard));
  }
  return report;
}

const report = collectReport();
const sum = summarize(report);

if (UPDATE) {
  if (CHANGED) fail('--update обновляет бейслайн только в полном режиме.');
  writeFileSync(BASELINE_PATH, JSON.stringify(sum, null, 2) + '\n');
  console.log(
    `Бейслайн обновлён: ${sum.total} (errors ${sum.errors}, warnings ${sum.warnings}).`,
  );
  process.exit(0);
}

if (CHANGED) process.exit(verdictChanged(report, sum));

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  fail(
    'Нет бейслайна — сгенерируй: node scripts/check-eslint-ratchet.mjs --update',
  );
}
process.exit(verdictFull(report, sum, baseline, ROOT));
