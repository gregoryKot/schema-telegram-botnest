// Правила eslint-храповика (движок — check-eslint-ratchet.mjs, правило №9):
// как режется дерево на запуски, какие файлы считаются изменёнными, как
// суммируется отчёт и как печатается рост против бейслайна. Чистые функции
// без диска и подпроцессов — их проверяет спек
// src/test-support/gates/eslint-ratchet-modes.spec.ts через песочницу гейта.
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { join } from 'path';

// Каталоги верхнего уровня, которые не линтуются: node_modules — чужой код,
// game/ — заморожен решением владельца (дублируется --ignore-pattern game/**).
// Точечные каталоги (.claude, .stryker-tmp, …) отсекаются по точке.
const SKIP_DIRS = new Set(['node_modules', 'game']);

/** Полный режим: один запуск eslint на каждый каталог верхнего уровня плюс
 * один на файлы в корне. Запуск по всему дереву разом держит в памяти
 * программы TypeScript всех четырёх пакетов (корень, webapp, schema-miniapp,
 * shared) и падает с OOM у лимита кучи ~2 ГБ (находка PR #880); по каталогам
 * каждый дочерний процесс отдаёт память перед следующим. Сумма отчётов равна
 * отчёту по `.`: флэт-конфиг резолвится от cwd, а не от пути файла. */
export function lintShards(dirents) {
  const dirs = [];
  const rootFiles = [];
  for (const d of dirents) {
    if (d.name.startsWith('.')) continue;
    if (d.isDirectory()) {
      if (!SKIP_DIRS.has(d.name)) dirs.push([d.name]);
    } else {
      rootFiles.push(d.name);
    }
  }
  dirs.sort((a, b) => a[0].localeCompare(b[0]));
  return rootFiles.length ? [...dirs, rootFiles.sort()] : dirs;
}

/** Режим --changed: файлы, отличающиеся от origin/main (вывод
 * `git diff --name-only --diff-filter=ACMR origin/main`), плюс неотслеживаемые
 * (`git ls-files --others --exclude-standard`). Удалённые отфильтрует движок
 * по existsSync. Порядок стабильный, дубли убраны. */
export function changedTargets(diffOut, untrackedOut) {
  const seen = new Set();
  for (const out of [diffOut, untrackedOut]) {
    for (const line of out.split('\n')) {
      const p = line.trim();
      if (p) seen.add(p);
    }
  }
  return [...seen];
}

/** Счётчики отчёта eslint (json-форматтер): ошибки, варнинги, по правилам. */
export function summarize(report) {
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
  return { total: errors + warnings, errors, warnings, byRule };
}

/** Рост против бейслайна: правила, по которым стало больше, и файлы с
 * вхождениями (до 5 строк на файл). Печатает в stderr. */
function printGrowth(report, summary, baseline) {
  console.error(
    'Правила с ростом против бейслайна (и файлы с их вхождениями):',
  );
  const rules = Object.entries(summary.byRule).sort((a, b) => b[1] - a[1]);
  for (const [rule, n] of rules) {
    const base = baseline.byRule?.[rule] ?? 0;
    if (n <= base) continue;
    console.error(`   ${rule}: ${base} → ${n}`);
    for (const f of report) {
      const hits = f.messages.filter((m) => (m.ruleId ?? '(parse)') === rule);
      if (!hits.length) continue;
      console.error(`      ${f.filePath}: ${hits.length}`);
      for (const m of hits.slice(0, 5))
        console.error(
          `         стр. ${m.line}: ${JSON.stringify(m.message ?? '').slice(0, 160)}`,
        );
    }
  }
}

/** Диагностика environment-расхождений при росте: какой prettier резолвится
 * и совпадает ли содержимое файла-индикатора (инцидент PR #64). */
function printEnvDiag(root) {
  try {
    const req = createRequire(join(root, 'package.json'));
    const pPath = req.resolve('prettier/package.json');
    const pVer = JSON.parse(readFileSync(pPath, 'utf8')).version;
    let miniVer = '(нет)';
    try {
      const reqMini = createRequire(join(root, 'schema-miniapp/package.json'));
      const mp = reqMini.resolve('prettier/package.json');
      miniVer = JSON.parse(readFileSync(mp, 'utf8')).version + ' @ ' + mp;
    } catch {
      /* prettier не установлен в miniapp — норм */
    }
    const suspect = join(
      root,
      'schema-miniapp/src/components/YSQTestSheet.tsx',
    );
    const md5 = createHash('md5').update(readFileSync(suspect)).digest('hex');
    console.error(
      `   [diag] prettier(root) ${pVer} @ ${pPath}\n` +
        `   [diag] prettier(miniapp) ${miniVer}\n` +
        `   [diag] node ${process.version}, YSQTestSheet md5=${md5}`,
    );
  } catch (e) {
    console.error('   [diag] не удалось: ' + e.message);
  }
}

/** Вердикт частичного режима (--changed): бейслайн на подмножество файлов не
 * ложится, поэтому любая находка — рост. Возвращает код выхода. */
export function verdictChanged(report, sum) {
  if (sum.total > 0) {
    console.error(
      `❌ eslint-храповик (--changed): ${sum.total} находок в изменённых ` +
        `файлах (errors ${sum.errors}, warnings ${sum.warnings}). Частичный ` +
        'режим: любая находка — рост, полную сумму по дереву сверит CI.',
    );
    printGrowth(report, sum, { byRule: {} });
    return 1;
  }
  console.log(
    `✓ eslint-храповик (--changed): ${report.length} файлов, находок нет`,
  );
  return 0;
}

/** Вердикт полного режима: сумма по дереву против бейслайна. Возвращает код
 * выхода; при росте печатает диагностику окружения и вхождения. */
export function verdictFull(report, sum, baseline, root) {
  const { total, errors, warnings } = sum;
  if (total > baseline.total) {
    printEnvDiag(root);
    console.error(
      `❌ eslint-храповик: счётчик вырос ${baseline.total} → ${total} ` +
        `(errors ${baseline.errors} → ${errors}, warnings ${baseline.warnings} → ${warnings}).`,
    );
    printGrowth(report, sum, baseline);
    console.error(
      'Правило №9 CLAUDE.md: ни один PR не увеличивает счётчик eslint.\n' +
        'Почини свои вхождения (npx eslint <файл> покажет их); бейслайн\n' +
        'обновляется только вниз: node scripts/check-eslint-ratchet.mjs --update',
    );
    return 1;
  }
  if (total < baseline.total) {
    console.log(
      `✓ eslint-храповик: ${total} ≤ ${baseline.total} — стало лучше, ` +
        'зафиксируй прогресс: node scripts/check-eslint-ratchet.mjs --update',
    );
  } else {
    console.log(`✓ eslint-храповик: ${total} (без роста)`);
  }
  return 0;
}
