#!/usr/bin/env node
// Пофайловый гейт нулевого покрытия бэкенда. check-coverage-ratchet.mjs
// держит сумму и полы по каталогам, а отдельный файл не видит: так жил
// без тестов `src/api/throttle-hit.cleanup.ts`, пока аудит не нашёл его глазами.
//
// Читает `coverage/coverage-summary.json` шага check-coverage-ratchet.mjs
// (джоба backend; сам jest не гоняет). Файл `src/**` «почти ноль» (меньше
// NEAR_ZERO_PCT строк или ни одной вызванной функции) — красный, если его нет в
// `scripts/zero-coverage-baseline.json` («путь» → причина). Причина «покрыто
// e2e» называет спек, а гейт сверяет, что спек есть и его гоняет ci.yml.
// Порог, исключения и сверка e2e — zero-coverage-rules.mjs.
//
// По образцу check-file-size-ratchet: долг заморожен и обязан таять — файл из
// бейслайна, поднявшийся до порога (или удалённый), печатает предупреждение
// «зафиксируй `--update`», но не красит: иначе краснели бы соседние PR, где
// тест не писали. `--update` только вычёркивает; вписать новый ноль можно лишь
// руками и с причиной (правило №15).
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { NEAR_ZERO_PCT, e2eClaimProblems, lowFiles } from './zero-coverage-rules.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'zero-coverage-baseline.json');
const UPDATE = process.argv.includes('--update');

const summaryArg = process.argv.find((a) => a.startsWith('--summary='));
const SUMMARY_PATH = summaryArg ? resolve(summaryArg.slice(10)) : join(ROOT, 'coverage', 'coverage-summary.json');

const pct = ({ covered, total }) => `${((covered / total) * 100).toFixed(1)}% строк`;
const lowLine = (f) =>
  f.covered === 0
    ? `${f.rel}: 0% строк — новый файл без единого теста`
    : f.covered * 100 >= NEAR_ZERO_PCT * f.total
      ? `${f.rel}: ни одной вызванной функции (${pct(f)} — исполнена только загрузка модуля)`
      : `${f.rel}: ${pct(f)} (${f.covered} из ${f.total}) — ниже порога ${NEAR_ZERO_PCT}%`;

function main() {
  if (!existsSync(SUMMARY_PATH)) {
    console.error(`❌ нет ${SUMMARY_PATH}: сначала прогон jest с покрытием (node scripts/check-coverage-ratchet.mjs).`);
    process.exit(1);
  }
  const low = lowFiles(JSON.parse(readFileSync(SUMMARY_PATH, 'utf8')), ROOT);
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const fresh = low.filter((f) => !(f.rel in baseline));
  const healed = Object.keys(baseline).filter((f) => !low.some((l) => l.rel === f));
  const short = Object.entries(baseline).filter(([, r]) => String(r).trim().length < 20).map(([f]) => f);

  if (UPDATE) {
    const kept = Object.fromEntries(Object.entries(baseline).filter(([f]) => !healed.includes(f)));
    writeFileSync(BASELINE_PATH, JSON.stringify(kept, null, 2) + '\n');
    console.log(`Бейслайн нулей: вычеркнуто ${healed.length}, осталось ${Object.keys(kept).length}.`);
    if (fresh.length) console.error(`Новые нули --update не вписывает: ${fresh.map((f) => f.rel).join(', ')}`);
    process.exit(fresh.length ? 1 : 0);
  }

  // Покрытый (или удалённый) файл из бейслайна — прогресс, а не нарушение: как у
  // храповика размера, CI не краснеет у соседних PR, а просит зафиксировать.
  for (const f of healed) {
    console.log(`⚠ ${f}: в бейслайне нулей, но покрыт от ${NEAR_ZERO_PCT}% строк или удалён — зафиксируй: node scripts/check-zero-coverage.mjs --update`);
  }
  const problems = [
    ...fresh.map(lowLine),
    ...short.map((f) => `бейслайн ${f}: причина короче 20 символов`),
    ...e2eClaimProblems(baseline, ROOT),
  ];
  if (problems.length) {
    console.error('❌ Файлы бэкенда без покрытия (храповик нулей):\n');
    for (const p of problems) console.error(`   ${p}`);
    console.error(
      '\nНовый файл с логикой приезжает с тестом в том же коммите (правило «Тесты»). Низкое\n' +
        'покрытие осознано (логики нет; проверяет e2e — назови спек, который гоняет ci.yml) —\n' +
        'запись в scripts/zero-coverage-baseline.json с причиной.',
    );
    process.exit(1);
  }
  const zeros = low.filter((f) => f.covered === 0).length;
  console.log(`✓ нули покрытия: ${low.length} файлов «почти ноль» (${zeros} с 0% строк), все в бейслайне с причиной.`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
