#!/usr/bin/env node
// Фронтенд-coverage-храповик (TEST_IMPROVEMENT_PLAN.md, этап 2.1; по образцу
// check-coverage-ratchet.mjs, бэкендового). До этого шага coverage webapp и
// schema-miniapp вообще не гейтился в CI — джобы гоняли `npm test --prefix
// <pkg>` без --coverage, число могло падать незаметно.
//
// Гоняет `npx vitest run --coverage` в каждом пакете (webapp,
// schema-miniapp), читает <pkg>/coverage/coverage-summary.json (репортер
// json-summary объявлен в <pkg>/vite.config.ts → test.coverage.reporter) и
// сравнивает total lines/branches с scripts/frontend-coverage-baseline.json.
//
// Без флага — оба пакета по очереди (для локального прогона). В CI джобы
// раздельные (webapp/miniapp) — каждая передаёт --package <имя>, чтобы не
// гонять чужой пакет и не задваивать время джобы.
import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'frontend-coverage-baseline.json');
const PACKAGES = ['webapp', 'schema-miniapp'];

const UPDATE = process.argv.includes('--update');
const packageFlagIndex = process.argv.indexOf('--package');
const requestedPackage =
  packageFlagIndex !== -1 ? process.argv[packageFlagIndex + 1] : null;

if (requestedPackage && !PACKAGES.includes(requestedPackage)) {
  console.error(
    `❌ неизвестный пакет "${requestedPackage}" — ожидается один из: ${PACKAGES.join(', ')}`,
  );
  process.exit(1);
}

const packages = requestedPackage ? [requestedPackage] : PACKAGES;

// Порог небольшой, чтобы случайный сдвиг числа строк (рефакторинг без потери
// теста) не флеймил CI на десятые доли процента — как в бэкендовом храповике.
const EPSILON = 0.1;

function runVitestCoverage(pkg) {
  const cwd = join(ROOT, pkg);
  const res = spawnSync('npx', ['vitest', 'run', '--coverage', '--silent'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  if (res.error) {
    console.error(
      `❌ [${pkg}] не удалось запустить vitest: ${res.error.message}`,
    );
    process.exit(1);
  }
  if (res.status !== 0) {
    console.error(
      `❌ [${pkg}] vitest завершился с ошибкой (упавшие тесты?) — coverage-храповик не проверяется.`,
    );
    process.exit(res.status ?? 1);
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
    process.exit(1);
  }
  return {
    lines: summary.total.lines.pct,
    branches: summary.total.branches.pct,
  };
}

const current = {};
for (const pkg of packages) {
  current[pkg] = runVitestCoverage(pkg);
}

if (UPDATE) {
  const existing = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    : {};
  const next = { ...existing, ...current };
  writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n');
  console.log(
    `Бейслайн обновлён: ${Object.entries(current)
      .map(([pkg, c]) => `${pkg} — lines ${c.lines}%, branches ${c.branches}%`)
      .join('; ')}.`,
  );
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  console.error(
    'Нет бейслайна — сгенерируй: node scripts/check-frontend-coverage-ratchet.mjs --update',
  );
  process.exit(1);
}

let hasFailure = false;
let hasProgress = false;

for (const pkg of packages) {
  const cur = current[pkg];
  const base = baseline[pkg];
  if (!base) {
    console.error(
      `❌ [${pkg}] нет в бейслайне ${BASELINE_PATH} — сгенерируй: ` +
        'node scripts/check-frontend-coverage-ratchet.mjs --update',
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
      'CLAUDE.md, правило «Тесты»: новый код с логикой приезжает с тестом — ' +
        'покрытие не должно падать.\n' +
        'Если снижение осознанное и оправдано — обсуди перед тем как обновлять ' +
        'бейслайн: node scripts/check-frontend-coverage-ratchet.mjs --update',
    );
    continue;
  }

  if (
    cur.lines - base.lines > EPSILON ||
    cur.branches - base.branches > EPSILON
  ) {
    hasProgress = true;
    console.log(
      `✓ [${pkg}] coverage-храповик: lines ${cur.lines}% (было ${base.lines}%), ` +
        `branches ${cur.branches}% (было ${base.branches}%) — стало лучше, зафиксируй: ` +
        'node scripts/check-frontend-coverage-ratchet.mjs --update',
    );
  } else {
    console.log(
      `✓ [${pkg}] coverage-храповик: lines ${cur.lines}% (без просадки), branches ${cur.branches}%`,
    );
  }
}

if (hasFailure) process.exit(1);
if (hasProgress) process.exit(0);
process.exit(0);
