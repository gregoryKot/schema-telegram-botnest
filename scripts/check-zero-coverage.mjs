#!/usr/bin/env node
// Пофайловый гейт нулевого покрытия бэкенда (docs/open/ci-tests.md, аудит
// 2026-10). check-coverage-ratchet.mjs держит сумму и полы по каталогам, а
// отдельный файл не видит: десять непокрытых строк пол `src/api` не роняют.
// Так жил `src/api/throttle-hit.cleanup.ts` — единственный код, удаляющий из
// общего счётчика денежных ручек, — пока аудит не нашёл его глазами.
//
// Читает `coverage/coverage-summary.json`, который пишет прогон jest с
// покрытием в шаге check-coverage-ratchet.mjs (джоба backend, шаг сразу после
// него; сам jest не гоняет). Файл `src/**` с исполняемыми строками и нулём
// покрытых — красный, если его нет в `scripts/zero-coverage-baseline.json`
// («путь» → причина). Новый файл рождается с покрытием. По образцу
// check-file-size-ratchet: долг заморожен и обязан таять — файл из бейслайна,
// получивший покрытие (или удалённый), красит гейт, пока его не уберёт
// `--update`. `--update` только вычёркивает; вписать новый ноль можно лишь
// руками и с причиной (правило №15).
//
// Без логики по построению — `EXEMPT_PATTERNS`: Nest-модуль (`*.module.ts` —
// один декоратор `@Module`) и точка входа `src/main.ts` поднимаются e2e-смоком
// на AppModule, который в этот подсчёт не входит.
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'zero-coverage-baseline.json');
const UPDATE = process.argv.includes('--update');

export const EXEMPT_PATTERNS = [/\.module\.ts$/, /^src\/main\.ts$/];

const summaryArg = process.argv.find((a) => a.startsWith('--summary='));
const SUMMARY_PATH = summaryArg ? resolve(summaryArg.slice(10)) : join(ROOT, 'coverage', 'coverage-summary.json');

/** Файлы с нулём покрытых строк: относительные пути, отсортированы. */
export function zeroFiles(summary, root) {
  return Object.entries(summary)
    .filter(([p]) => p !== 'total')
    .map(([p, e]) => [p.startsWith(`${root}/`) ? p.slice(root.length + 1) : p, e])
    .filter(([rel, e]) => rel.startsWith('src/') && e.lines.total > 0 && e.lines.covered === 0)
    .filter(([rel]) => !EXEMPT_PATTERNS.some((re) => re.test(rel)))
    .map(([rel]) => rel)
    .sort();
}

function main() {
  if (!existsSync(SUMMARY_PATH)) {
    console.error(`❌ нет ${SUMMARY_PATH}: сначала прогон jest с покрытием (node scripts/check-coverage-ratchet.mjs).`);
    process.exit(1);
  }
  const summary = JSON.parse(readFileSync(SUMMARY_PATH, 'utf8'));
  const zeros = zeroFiles(summary, ROOT);
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const fresh = zeros.filter((f) => !(f in baseline));
  const healed = Object.keys(baseline).filter((f) => !zeros.includes(f));
  const short = Object.entries(baseline).filter(([, r]) => String(r).trim().length < 20).map(([f]) => f);

  if (UPDATE) {
    const kept = Object.fromEntries(Object.entries(baseline).filter(([f]) => !healed.includes(f)));
    writeFileSync(BASELINE_PATH, JSON.stringify(kept, null, 2) + '\n');
    console.log(`Бейслайн нулей: вычеркнуто ${healed.length}, осталось ${Object.keys(kept).length}.`);
    if (fresh.length) console.error(`Новые нули --update не вписывает: ${fresh.join(', ')}`);
    process.exit(fresh.length ? 1 : 0);
  }

  const problems = [
    ...fresh.map((f) => `${f}: 0% строк — новый файл без единого теста`),
    ...healed.map((f) => `${f}: в бейслайне нулей, но покрыт или удалён — зафиксируй: node scripts/check-zero-coverage.mjs --update`),
    ...short.map((f) => `бейслайн ${f}: причина короче 20 символов`),
  ];
  if (problems.length) {
    console.error('❌ Файлы бэкенда с нулевым покрытием (храповик нулей):\n');
    for (const p of problems) console.error(`   ${p}`);
    console.error(
      '\nНовый файл с логикой приезжает с тестом в том же коммите (правило «Тесты»). Ноль\n' +
        'осознан (логики нет, проверяется e2e) — запись в scripts/zero-coverage-baseline.json с причиной.',
    );
    process.exit(1);
  }
  console.log(`✓ нули покрытия: ${zeros.length} файлов с 0%, все в бейслайне с причиной.`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
