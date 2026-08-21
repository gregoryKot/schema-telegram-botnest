#!/usr/bin/env node
// Гейт паритета фич между фронтендами (правило №3 CLAUDE.md, расследование
// 2026-08-21). Источник истины — БЭКЕНД: он общий для обеих площадок, а
// проверенные раньше механизмы его не видели. check-paired-files.mjs ходит
// по жёсткому списку файлов и молчит про файл, которого в списке нет —
// PhraseCheck-упражнение, DiaryShareButton, .ics-экспорт жили только в
// мини-аппе, и ни один гейт этого не заметил. check-dead-files.mjs считает
// единицей учёта ФАЙЛ, а не метод — живой api.ts прикрывает собой мёртвый
// экспорт внутри (deleteBeliefCheck/deleteFlashcard/deleteLetter объявлены
// в обоих фронтендах и не вызываются НИОТКУДА, кроме тестов).
//
// Алгоритм (разбор — в feature-parity-patterns.mjs, правило №10: движок не
// растёт вместе с правилами разбора): собрать HTTP-роуты из
// src/api/**/*.controller.ts, определить для каждого — реально ли его
// дёргает webapp/src, schema-miniapp/src, оба или ни один (shared/src
// засчитывается ОБОИМ — buildSharedApi/createRatingApi/
// createClientErrorReporter спред-ятся в оба api-объекта, это факт текущей
// архитектуры, не догадка). «Доступность» — не сам факт объявления метода в
// api.ts (это дало бы вечнозелёный гейт: deleteBeliefCheck ОБЪЯВЛЕН в обоих
// api.ts, но экспорт мёртв), а то, что объявленный метод где-то ЕЩЁ
// упоминается за пределами своей строки-объявления — минимальный сигнал
// «это не мёртвый стаб», не полная трассировка до конкретного экрана.
//
//   node scripts/check-feature-parity.mjs            # проверка
//   node scripts/check-feature-parity.mjs --update   # зафиксировать бейслайн
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { classify } from './feature-parity-patterns.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'feature-parity-baseline.json');
const UPDATE = process.argv.includes('--update');

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return {};
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
}

function main() {
  const results = classify(ROOT);
  const oneSided = new Map(results.filter((r) => r.status !== 'both').map((r) => [r.key, r]));
  const baseline = loadBaseline();

  if (UPDATE) {
    const next = {};
    for (const key of [...oneSided.keys()].sort()) {
      const prev = baseline[key];
      const status = oneSided.get(key).status;
      next[key] =
        prev && prev.status === status
          ? prev
          : { status, reason: prev?.reason ?? 'ПРИЧИНА НЕ УКАЗАНА — впиши', since: prev?.since ?? 'TODO' };
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n');
    console.log(`Бейслайн обновлён: ${Object.keys(next).length} односторонних роутов.`);
    process.exit(0);
  }

  const problems = [];

  const known = new Set(Object.keys(baseline));
  const fresh = [...oneSided.values()].filter((r) => !known.has(r.key));
  if (fresh.length) {
    problems.push(
      'роуты без записи в бейслайне (доступны не с обеих площадок и не заведены осознанно):',
      ...fresh.map((r) => `   ${r.key}  [${r.status}]`),
    );
  }

  const stale = Object.keys(baseline).filter((key) => {
    const cur = oneSided.get(key);
    return !cur || cur.status !== baseline[key].status;
  });
  if (stale.length) {
    problems.push(
      'протухшие записи бейслайна (роут исчез, или расклад уже не тот — сверься, может, паритет достигнут):',
      ...stale.map((key) => `   ${key}`),
    );
  }

  const noReason = Object.entries(baseline).filter(([, v]) => !v.reason || String(v.reason).length < 20);
  if (noReason.length) {
    problems.push('исключение без внятной причины:', ...noReason.map(([key]) => `   ${key}`));
  }

  const noSince = Object.entries(baseline).filter(([, v]) => !v.since || String(v.since).trim() === '');
  if (noSince.length) {
    problems.push('исключение без `since` (коммит/PR, где решение принято):', ...noSince.map(([key]) => `   ${key}`));
  }

  if (problems.length) {
    console.error('❌ Гейт паритета фич (правило №3 CLAUDE.md):\n');
    for (const p of problems) console.error(p);
    console.error(
      '\nФикс приезжает в оба фронтенда в одном PR, либо код переезжает в shared/.\n' +
        'Осознанное платформенное решение — впиши в scripts/feature-parity-baseline.json\n' +
        '{ status, reason (честная причина, не «legacy»), since (коммит/PR) } и прогони\n' +
        '  node scripts/check-feature-parity.mjs --update',
    );
    process.exit(1);
  }

  console.log(
    `✓ гейт паритета фич: ${results.length} роутов, ` +
      `${results.length - oneSided.size} доступны с обеих площадок, ` +
      `${oneSided.size} односторонних — все с осознанной причиной.`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
