#!/usr/bin/env node
// Гейт: исполняемый код вне наблюдаемых деревьев обязан быть под тестом
// (класс из инцидента 2026-08-08, см. check-public-scripts.mjs — закрыл
// только `public/**/*.js`; `deploy/threads-relay/worker.js` в проде не видел
// ни check-dead-files.mjs, ни check-public-scripts.mjs — то же молчание).
//
// 1) git-tracked *.js/*.mjs/*.cjs/*.sh; 2) минус деревья под другим гейтом
// (WATCHED) и служебные; 3) ищет имя файла в тестах — ИСКЛЮЧАЯ комментарии
// (stripComments): `//`/`/* */`-упоминание не значит, что файл исполняется;
// 4) без упоминания — нарушение без записи в бейслайне; 5) протухшая запись
// тоже роняет гейт. Починить: тест (образец — maxBridgeLoader.test.ts) либо:
//   node scripts/check-unwatched-code.mjs --update   (--verbose — детали)
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
const ROOT = join(import.meta.dirname, '..');
const BASELINE = join(ROOT, 'scripts', 'unwatched-code-baseline.json');
const update = process.argv.includes('--update');
const verbose = process.argv.includes('--verbose');
const CODE_EXT = /\.(js|mjs|cjs|sh)$/;

// Деревья, за которыми уже следит другой гейт — префиксы repo-relative путей.
const WATCHED_PREFIXES = [
  'src/', 'webapp/src/', 'schema-miniapp/src/', 'shared/src/',
  'webapp/public/', 'schema-miniapp/public/', 'game/public/',
];
// Деревья вне гейта в принципе (не прод-код репозитория или заморожены).
// Экспорт — ради теста гейта.
export const EXCLUDED_PREFIXES = ['game/', '.github/'];
function gitFiles() {
  return execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}
function main() {
const all = gitFiles();
const isSegmentExcluded = (rel) => {
  const segments = rel.split('/');
  return segments.includes('dist') || segments.includes('node_modules');
};
const scope = all
  .filter((rel) => CODE_EXT.test(rel))
  .filter((rel) => !WATCHED_PREFIXES.some((p) => rel.startsWith(p)))
  .filter((rel) => !EXCLUDED_PREFIXES.some((p) => rel.startsWith(p)))
  .filter((rel) => !isSegmentExcluded(rel))
  .sort();

// Дублированный сканер — держать идентичным check-public-scripts.mjs (гейты
// однофайловые, общий модуль не вынести; parity: gate-scanner-parity.spec.ts).
// Регэксп-литералы (`/…/`) тоже учтены: без этого кавычка внутри символьного
// класса (`/['"]/`) сбивает отслеживание строк и глушит вырезание дальше по
// файлу — реальный случай, найденный на src/security/*.invariants.spec.ts.
// gate-scanner-dup:start
function stripComments(text) {
  const n = text.length;
  let out = '', i = 0, quote = null, prev = ''; // prev — для эвристики regex-vs-деление
  while (i < n) {
    const c = text[i];
    if (quote) {
      out += c;
      if (c === '\\' && i + 1 < n) { out += text[i + 1]; i += 2; continue; }
      if (c === quote) quote = null;
      i++; continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; out += c; prev = c; i++; continue; }
    if (c === '/' && text[i + 1] === '/') { while (i < n && text[i] !== '\n') i++; continue; }
    if (c === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i = Math.min(i + 2, n); out += ' '; continue;
    }
    if (c === '/' && !/[\w$)\]]/.test(prev)) {
      let j = i + 1, cls = false;
      while (j < n && text[j] !== '\n' && (cls || text[j] !== '/')) {
        if (text[j] === '\\') j++;
        else if (text[j] === '[') cls = true;
        else if (text[j] === ']') cls = false;
        j++;
      }
      if (j < n && text[j] === '/') j++;
      while (j < n && /[a-z]/i.test(text[j])) j++;
      out += text.slice(i, j); prev = text[j - 1] || prev; i = j;
      continue;
    }
    if (c > ' ') prev = c;
    out += c; i++;
  }
  return out;
}
// gate-scanner-dup:end

const isTestFile = (rel) =>
  (rel.startsWith('src/') && rel.endsWith('.spec.ts')) ||
  (rel.startsWith('test/') && rel.endsWith('.ts')) ||
  (rel.startsWith('webapp/src/') && /\.test\.[jt]sx?$/.test(rel)) ||
  (rel.startsWith('schema-miniapp/src/') && /\.test\.[jt]sx?$/.test(rel)) ||
  (rel.startsWith('shared/src/') && /\.test\.[jt]sx?$/.test(rel));

// existsSync — на удалённое из рабочего дерева. stripComments ДО поиска.
const testText = stripComments(
  all
    .filter(isTestFile)
    .flatMap((rel) => {
      const abs = join(ROOT, rel);
      return existsSync(abs) ? [readFileSync(abs, 'utf8')] : [];
    })
    .join('\n'),
);

// Упоминает ли тест файл в реальном коде. Путь — точное совпадение; имя —
// на границе (иначе `worker.js` засчитал бы `service-worker.js`, правило CLAUDE.md).
const mentioned = (rel) => {
  if (testText.includes(rel)) return true;
  const name = rel.split('/').pop();
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z0-9_.\\-])${escaped}`).test(testText);
};

const uncovered = scope.filter((rel) => !mentioned(rel));

if (verbose) {
  console.log(`Файлов в области действия гейта: ${scope.length}`);
  for (const rel of scope) {
    console.log(`   ${mentioned(rel) ? '✓' : '✗'} ${rel}`);
  }
}

// ── сверка с бейслайном ─────────────────────────────────────────────────────
const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};

if (update) {
  const next = {};
  for (const rel of uncovered) next[rel] = base[rel] ?? 'ПРИЧИНА НЕ УКАЗАНА — впиши';
  writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Бейслайн обновлён: ${uncovered.length} исключений.`);
  for (const rel of uncovered) console.log(`   ${rel}`);
  process.exit(0);
}

const unexpected = uncovered.filter((rel) => !(rel in base));
const stale = Object.keys(base).filter((rel) => !uncovered.includes(rel));

if (unexpected.length === 0 && stale.length === 0) {
  console.log(
    `✓ исполняемый код вне наблюдаемых деревьев: ${scope.length} файлов, все под тестом (исключений ${Object.keys(base).length}).`,
  );
  process.exit(0);
}

if (unexpected.length) {
  console.error(
    '❌ исполняемый код вне наблюдаемых деревьев без теста (класс инцидента 2026-08-08 — ' +
      'webapp/public/max-bridge.js сломал вход всем пользователям Telegram на 5 суток именно ' +
      'потому, что лежал вне поля зрения coverage/гейтов/тестов; та же дыра нашлась в ' +
      'deploy/threads-relay/worker.js):',
  );
  for (const rel of unexpected) {
    console.error(`   ${rel} — ни один тест не упоминает этот файл (в реальном коде)`);
  }
  console.error(
    'Напиши тест, который читает файл с диска и исполняет его (образец: webapp/src/maxBridgeLoader.test.ts) ' +
      'либо, если это конфиг сборки/линтера без пользовательской логики, впиши причину:',
  );
}

if (stale.length) {
  console.error('❌ протухшие записи бейслайна (файла нет или тест появился):');
  for (const rel of stale) console.error(`   ${rel}`);
}

console.error('Осознанное исключение — впиши причину:');
console.error('  node scripts/check-unwatched-code.mjs --update');
process.exit(1);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
