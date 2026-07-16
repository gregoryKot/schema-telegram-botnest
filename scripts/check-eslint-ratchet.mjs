#!/usr/bin/env node
// eslint-храповик (аудит 2026-07, этап 2е; правило №9 CLAUDE.md).
//
// Исторический долг (~11k ошибок, в основном unsafe-* и prettier в старом
// коде) невозможно закрыть одним PR, поэтому — храповик: суммарный счётчик
// ошибок+варнингов (без game/ — заморожен решением владельца) сравнивается
// с закоммиченным бейслайном. Рост роняет CI; снижение приветствуется —
// обнови бейслайн: node scripts/check-eslint-ratchet.mjs --update
//
// Требует установленных node_modules во всех трёх пакетах (корень, webapp,
// schema-miniapp) и прогнанного prisma generate — иначе typed-линт видит
// неразрешённые типы как any и счётчики уезжают вверх.
import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'eslint-baseline.json');
const UPDATE = process.argv.includes('--update');

const res = spawnSync(
  'npx',
  ['eslint', '.', '--format', 'json', '--ignore-pattern', 'game/**'],
  { cwd: ROOT, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 },
);
// eslint выходит с 1 при наличии ошибок — это норма; фатальны только сбои
// самого запуска (нет бинаря, кривой конфиг → пустой/невалидный stdout).
let report;
try {
  report = JSON.parse(res.stdout);
} catch {
  console.error('❌ eslint не отработал:\n' + (res.stderr || res.stdout).slice(0, 2000));
  process.exit(1);
}

let errors = 0;
let warnings = 0;
const byRule = {};
for (const f of report) {
  errors += f.errorCount;
  warnings += f.warningCount;
  for (const m of f.messages) {
    const rule = m.ruleId ?? '(parse)';
    byRule[rule] = (byRule[rule] || 0) + 1;
  }
}
const total = errors + warnings;

if (UPDATE) {
  writeFileSync(
    BASELINE_PATH,
    JSON.stringify({ total, errors, warnings, byRule }, null, 2) + '\n',
  );
  console.log(`Бейслайн обновлён: ${total} (errors ${errors}, warnings ${warnings}).`);
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  console.error('Нет бейслайна — сгенерируй: node scripts/check-eslint-ratchet.mjs --update');
  process.exit(1);
}

if (total > baseline.total) {
  // Диагностика environment-расхождений: какой prettier резолвится и
  // совпадает ли содержимое файла (см. инцидент PR #64).
  try {
    const { createRequire } = await import('module');
    const req = createRequire(join(ROOT, 'package.json'));
    const pPath = req.resolve('prettier/package.json');
    const pVer = JSON.parse(readFileSync(pPath, 'utf8')).version;
    let miniVer = '(нет)';
    try {
      const reqMini = createRequire(join(ROOT, 'schema-miniapp/package.json'));
      const mp = reqMini.resolve('prettier/package.json');
      miniVer = JSON.parse(readFileSync(mp, 'utf8')).version + ' @ ' + mp;
    } catch {
      /* prettier не установлен в miniapp — норм */
    }
    const { createHash } = await import('crypto');
    const suspect = join(ROOT, 'schema-miniapp/src/components/YSQTestSheet.tsx');
    const md5 = createHash('md5').update(readFileSync(suspect)).digest('hex');
    console.error(
      `   [diag] prettier(root) ${pVer} @ ${pPath}\n` +
        `   [diag] prettier(miniapp) ${miniVer}\n` +
        `   [diag] node ${process.version}, YSQTestSheet md5=${md5}`,
    );
  } catch (e) {
    console.error('   [diag] не удалось: ' + e.message);
  }
  console.error(
    `❌ eslint-храповик: счётчик вырос ${baseline.total} → ${total} ` +
      `(errors ${baseline.errors} → ${errors}, warnings ${baseline.warnings} → ${warnings}).`,
  );
  console.error('Правила с ростом против бейслайна (и файлы с их вхождениями):');
  for (const [rule, n] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) {
    const base = baseline.byRule?.[rule] ?? 0;
    if (n <= base) continue;
    console.error(`   ${rule}: ${base} → ${n}`);
    for (const f of report) {
      const hits = f.messages.filter((m) => (m.ruleId ?? '(parse)') === rule);
      if (hits.length) {
        console.error(`      ${f.filePath}: ${hits.length}`);
        for (const m of hits.slice(0, 5))
          console.error(
            `         стр. ${m.line}: ${JSON.stringify(m.message).slice(0, 160)}`,
          );
      }
    }
  }
  console.error(
    'Правило №9 CLAUDE.md: ни один PR не увеличивает счётчик eslint.\n' +
      'Почини свои вхождения (npx eslint <файл> покажет их); бейслайн\n' +
      'обновляется только вниз: node scripts/check-eslint-ratchet.mjs --update',
  );
  process.exit(1);
}

if (total < baseline.total) {
  console.log(
    `✓ eslint-храповик: ${total} ≤ ${baseline.total} — стало лучше, ` +
      'зафиксируй прогресс: node scripts/check-eslint-ratchet.mjs --update',
  );
} else {
  console.log(`✓ eslint-храповик: ${total} (без роста)`);
}
