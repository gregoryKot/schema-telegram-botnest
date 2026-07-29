#!/usr/bin/env node
// Храповик mutation-score золотых зон (TEST_IMPROVEMENT_PLAN.md, этап 4.1).
//
// Покрытие отвечает на вопрос «строка исполнилась?», а не «тест поймает, если
// строку сломать». Mutation testing правит код (`>` → `>=`, `&&` → `||`,
// выкидывает вызовы) и смотрит, покраснеет ли хоть один тест. Выживший мутант
// = строка формально покрыта, но её поломку никто не заметит.
//
// Гоняем НЕ по всему бэкенду (дорого — минуты на файл), а по «золотым зонам»
// из stryker.config.json: шифрование, auth, платёжная подпись, таймзоны —
// места, где тихая ошибка дороже всего.
//
// Скрипт НЕ запускает Stryker сам (прогон долгий, в PR-CI ему не место —
// см. nightly.yml): читает готовый reports/mutation/mutation.json и сверяет
// с scripts/mutation-baseline.json. Порядок работы:
//   npm run mutation                        # прогон (пишет отчёт)
//   node scripts/check-mutation-ratchet.mjs # сверка с бейслайном
//   node scripts/check-mutation-ratchet.mjs --update   # зафиксировать рост
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = join(ROOT, 'reports', 'mutation', 'mutation.json');
const BASELINE = join(ROOT, 'scripts', 'mutation-baseline.json');
const update = process.argv.includes('--update');

if (!existsSync(REPORT)) {
  console.error(
    `❌ нет отчёта ${REPORT} — сначала прогон: npm run mutation\n` +
      '   (Stryker пишет reports/mutation/mutation.json через json-репортер).',
  );
  process.exit(1);
}

/** Мутант считается «обезвреженным», если тест на нём упал или завис. */
const DETECTED = new Set(['Killed', 'Timeout']);
/** Не считаем в знаменателе то, что Stryker не смог применить. */
const IGNORED = new Set(['CompileError', 'Ignored', 'RuntimeError']);

function scoreOf(mutants) {
  let detected = 0;
  let valid = 0;
  for (const m of mutants) {
    if (IGNORED.has(m.status)) continue;
    valid += 1;
    if (DETECTED.has(m.status)) detected += 1;
  }
  return { detected, valid, pct: valid ? (100 * detected) / valid : 0 };
}

const report = JSON.parse(readFileSync(REPORT, 'utf8'));
const files = report.files ?? {};
if (Object.keys(files).length === 0) {
  console.error('❌ отчёт пуст — Stryker не нашёл ни одного файла для мутаций.');
  process.exit(1);
}

const perFile = {};
const allMutants = [];
for (const [path, file] of Object.entries(files)) {
  const rel = path.replace(`${ROOT}/`, '');
  const mutants = file.mutants ?? [];
  allMutants.push(...mutants);
  perFile[rel] = Number(scoreOf(mutants).pct.toFixed(2));
}
const total = scoreOf(allMutants);
const current = {
  total: Number(total.pct.toFixed(2)),
  files: perFile,
};

if (update) {
  writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
  console.log(
    `Бейслайн обновлён: mutation-score ${current.total}% ` +
      `(${total.detected}/${total.valid} мутантов обезврежено).`,
  );
  for (const [f, pct] of Object.entries(perFile)) console.log(`   ${pct}%  ${f}`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(
    `❌ нет бейслайна ${BASELINE} — зафиксируй текущий счёт:\n` +
      '   node scripts/check-mutation-ratchet.mjs --update',
  );
  process.exit(1);
}

const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
// Допуск: Stryker недетерминирован на таймаутах (медленный раннер убивает
// мутанта по времени, быстрый — нет). Просадка меньше допуска — шум, не регресс.
const TOLERANCE = 1.5;
const problems = [];
if (current.total < base.total - TOLERANCE) {
  problems.push(
    `общий счёт: ${base.total}% → ${current.total}% ` +
      `(допуск ${TOLERANCE} п.п. на недетерминизм таймаутов)`,
  );
}
for (const [f, wasPct] of Object.entries(base.files ?? {})) {
  const nowPct = current.files[f];
  if (nowPct === undefined) {
    problems.push(`файл пропал из прогона: ${f} (убрали из mutate в конфиге?)`);
  } else if (nowPct < wasPct - TOLERANCE) {
    problems.push(`${f}: ${wasPct}% → ${nowPct}%`);
  }
}

if (problems.length > 0) {
  console.error('❌ mutation-храповик: тесты стали хуже ловить поломки кода:');
  for (const p of problems) console.error(`   ${p}`);
  console.error(
    'Выживший мутант = строка исполняется тестом, но её поломку никто не\n' +
      'заметит. Усиль ассерты (проверяй результат/аргументы, а не сам факт\n' +
      'вызова) или добавь кейс на ветку. Отчёт: reports/mutation/mutation.html\n' +
      '— вкладка Survived показывает точную правку, которую тесты проспали.\n' +
      'Если просадка осознана — обнови: node scripts/check-mutation-ratchet.mjs --update',
  );
  process.exit(1);
}

console.log(
  `✓ mutation-храповик: ${current.total}% ` +
    `(бейслайн ${base.total}%, обезврежено ${total.detected}/${total.valid})`,
);
