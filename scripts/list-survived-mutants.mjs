#!/usr/bin/env node
// Список выживших мутантов из отчёта Stryker — рабочий инструмент для
// усиления тестов (TEST_IMPROVEMENT_PLAN.md, этап 4.1).
//
// Выживший мутант = Stryker поломал строку, а тесты остались зелёными.
// HTML-отчёт красив, но чтобы РАБОТАТЬ со списком (раздать по файлам,
// сгруппировать по типу правки), нужен текст. Скрипт печатает выживших
// с номером строки, типом мутации и самой подменой.
//
//   npm run mutation                              # обновить отчёт
//   node scripts/list-survived-mutants.mjs        # все выжившие
//   node scripts/list-survived-mutants.mjs crypto # только по файлу-фильтру
//   node scripts/list-survived-mutants.mjs --stats # сводка по типам мутаций
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = join(ROOT, 'reports', 'mutation', 'mutation.json');

if (!existsSync(REPORT)) {
  console.error(`❌ нет отчёта ${REPORT} — сначала: npm run mutation`);
  process.exit(1);
}

const args = process.argv.slice(2);
const statsOnly = args.includes('--stats');
const filter = args.find((a) => !a.startsWith('--'));

const report = JSON.parse(readFileSync(REPORT, 'utf8'));
const byMutator = new Map();
let total = 0;

for (const [path, file] of Object.entries(report.files ?? {})) {
  const rel = path.replace(`${ROOT}/`, '');
  if (filter && !rel.includes(filter)) continue;
  const survived = (file.mutants ?? []).filter((m) => m.status === 'Survived');
  if (survived.length === 0) continue;

  total += survived.length;
  if (!statsOnly) console.log(`\n=== ${rel} — выжило ${survived.length} ===`);

  // Строки исходника нужны, чтобы показать контекст правки: сам по себе
  // "заменили + на -" ничего не говорит без строки, где это произошло.
  const lines = (file.source ?? '').split('\n');
  for (const m of survived.sort((a, b) => a.location.start.line - b.location.start.line)) {
    byMutator.set(m.mutatorName, (byMutator.get(m.mutatorName) ?? 0) + 1);
    if (statsOnly) continue;
    const ln = m.location.start.line;
    const src = (lines[ln - 1] ?? '').trim();
    const repl = (m.replacement ?? '').replace(/\s+/g, ' ').slice(0, 80);
    console.log(`  стр.${String(ln).padStart(4)} [${m.mutatorName}] ${src}`);
    console.log(`            → подменили на: ${repl}`);
  }
}

console.log(`\nВсего выживших: ${total}`);
console.log('По типам мутаций (что именно тесты не ловят):');
for (const [name, n] of [...byMutator.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${name}`);
}
