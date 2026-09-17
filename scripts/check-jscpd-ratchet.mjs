#!/usr/bin/env node
// Храповик копипасты (аудит 2026-07, свип дублей): jscpd считает
// дублированные строки по src + обоим фронтендам, счётчик сравнивается
// с бейслайном. Рост роняет CI; снижение — обнови бейслайн:
//   node scripts/check-jscpd-ratchet.mjs --update
//
// В счётчик входят и канонические межфронтендовые пары (họ константны и
// уйдут в shared-пакет волной 2), и внутренние дубли — исторический долг
// зафиксирован, новая копипаста ≥70 токенов не проходит.
import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'jscpd-baseline.json');
const UPDATE = process.argv.includes('--update');

// Шов для теста гейта (src/test-support/gates/): сам jscpd в песочницу не
// поднять — он обходит всё дерево. Молча сломаться может вторая половина:
// чтение отчёта и сверка с бейслайном. RATCHET_REPORT_FILE подставляет
// готовый отчёт вместо запуска; сравнение дальше — то же, что в CI.
const reportFile = process.env.RATCHET_REPORT_FILE;
const out = reportFile ? null : mkdtempSync(join(tmpdir(), 'jscpd-'));
const res = reportFile
  ? { stdout: '', stderr: '' }
  : spawnSync(
  'npx',
  [
    'jscpd', 'src', 'webapp/src', 'schema-miniapp/src', 'shared/src',
    '--min-tokens', '70',
    '--reporters', 'json',
    '--output', out,
    '--ignore', '**/*.spec.ts,**/*.test.ts,**/*.test.tsx,**/dist/**',
  ],
  { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);

let report;
try {
  report = JSON.parse(
    readFileSync(reportFile ?? join(out, 'jscpd-report.json'), 'utf8'),
  );
} catch {
  console.error('❌ jscpd не отработал:\n' + (res.stderr || res.stdout).slice(0, 2000));
  process.exit(1);
} finally {
  if (out) rmSync(out, { recursive: true, force: true });
}

const lines = report.statistics.total.duplicatedLines;
const clones = report.statistics.total.clones;

if (UPDATE) {
  writeFileSync(BASELINE_PATH, JSON.stringify({ lines, clones }, null, 2) + '\n');
  console.log(`Бейслайн обновлён: ${lines} дублированных строк, ${clones} клонов.`);
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  console.error('Нет бейслайна — сгенерируй: node scripts/check-jscpd-ratchet.mjs --update');
  process.exit(1);
}

if (lines > baseline.lines) {
  console.error(
    `❌ jscpd-храповик: дублированные строки выросли ${baseline.lines} → ${lines} ` +
      `(клонов ${baseline.clones} → ${clones}).\n` +
      'Новый повторяющийся код выноси в общий модуль/хук, а не копируй.\n' +
      'Найти свои клоны: npx jscpd <файлы> --min-tokens 70 --reporters consoleFull\n' +
      'Бейслайн обновляется только вниз: node scripts/check-jscpd-ratchet.mjs --update',
  );
  process.exit(1);
}
console.log(
  lines < baseline.lines
    ? `✓ jscpd-храповик: ${lines} < ${baseline.lines} — стало лучше, зафиксируй: node scripts/check-jscpd-ratchet.mjs --update`
    : `✓ jscpd-храповик: ${lines} (без роста)`,
);
