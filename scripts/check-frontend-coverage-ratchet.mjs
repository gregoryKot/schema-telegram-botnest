#!/usr/bin/env node
// Пол покрытия сайта и shared/ — scripts/frontend-coverage-baseline.json.
// Пол фиксированный: меняет владелец правкой файла.
//
// Гоняет `npx vitest run --coverage` в каждом пакете (webapp,
// shared), читает <pkg>/coverage/coverage-summary.json (репортер
// json-summary объявлен в <pkg>/vite.config.ts → test.coverage.reporter) и
// сравнивает total lines/branches с scripts/frontend-coverage-baseline.json.
//
// Без флага — все пакеты по очереди (для локального прогона). В CI джобы
// раздельные (webapp, shared) — каждая передаёт --package <имя>, чтобы не
// гонять чужой пакет и не задваивать время джобы.
import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { exitFlushed as exit, relayOutput } from './child-output.mjs';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'frontend-coverage-baseline.json');
const PACKAGES = ['webapp', 'shared'];

const UPDATE = process.argv.includes('--update');
if (UPDATE) {
  console.error(
    '❌ Пол покрытия фиксированный: его меняет владелец правкой ' +
      'scripts/frontend-coverage-baseline.json, --update не поддерживается.',
  );
  process.exit(1);
}
const packageFlagIndex = process.argv.indexOf('--package');
const requestedPackage =
  packageFlagIndex !== -1 ? process.argv[packageFlagIndex + 1] : null;

if (requestedPackage && !PACKAGES.includes(requestedPackage)) {
  console.error(
    `❌ неизвестный пакет "${requestedPackage}" — ожидается один из: ${PACKAGES.join(', ')}`,
  );
  await exit(1);
}

const packages = requestedPackage ? [requestedPackage] : PACKAGES;

// Порог небольшой, чтобы случайный сдвиг числа строк (рефакторинг без потери
// теста) не флеймил CI на десятые доли процента — как в бэкендовом храповике.
const EPSILON = 0.1;

async function runVitestCoverage(pkg) {
  const cwd = join(ROOT, pkg);
  const res = spawnSync('npx', ['vitest', 'run', '--coverage', '--silent'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  });
  relayOutput(res);
  if (res.error) {
    console.error(
      `❌ [${pkg}] не удалось запустить vitest: ${res.error.message}`,
    );
    await exit(1);
  }
  if (res.status !== 0) {
    console.error(
      `❌ [${pkg}] vitest завершился с ошибкой (упавшие тесты?) — coverage-храповик не проверяется.`,
    );
    await exit(res.status ?? 1);
  }

  const summaryPath = join(cwd, 'coverage', 'coverage-summary.json');
  let summary;
  try {
    summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
  } catch {
    console.error(
      `❌ [${pkg}] не найден ${summaryPath} — vitest не сгенерировал coverage-summary.json ` +
        `(проверь reporter: ['...', 'json-summary'] в ${pkg}/vite.config.ts → test.coverage).`,
    );
    await exit(1);
  }
  return {
    lines: summary.total.lines.pct,
    branches: summary.total.branches.pct,
  };
}

const current = {};
for (const pkg of packages) {
  current[pkg] = await runVitestCoverage(pkg);
}


let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  console.error(
    'Нет бейслайна scripts/frontend-coverage-baseline.json — верни файл из git.',
  );
  await exit(1);
}

let hasFailure = false;

for (const pkg of packages) {
  const cur = current[pkg];
  const base = baseline[pkg];
  if (!base) {
    console.error(
      `❌ [${pkg}] нет в бейслайне ${BASELINE_PATH} — допиши пакет в файл.`,
    );
    hasFailure = true;
    continue;
  }

  const failures = [];
  if (base.lines - cur.lines > EPSILON) {
    failures.push(`lines: ${base.lines}% → ${cur.lines}%`);
  }
  if (base.branches - cur.branches > EPSILON) {
    failures.push(`branches: ${base.branches}% → ${cur.branches}%`);
  }

  if (failures.length > 0) {
    hasFailure = true;
    console.error(`❌ [${pkg}] coverage-храповик: покрытие просело.`);
    for (const f of failures) console.error(`   ${f}`);
    console.error(
      'Покрытие ниже пола: допиши тест на новую логику. Пол меняет владелец ' +
        'правкой scripts/frontend-coverage-baseline.json.',
    );
    continue;
  }

  console.log(
    `✓ [${pkg}] coverage-храповик: lines ${cur.lines}% (пол ${base.lines}%), ` +
      `branches ${cur.branches}% (пол ${base.branches}%)`,
  );
}

if (hasFailure) await exit(1);
await exit(0);
