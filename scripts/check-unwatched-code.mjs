#!/usr/bin/env node
// Гейт: исполняемый код вне наблюдаемых деревьев обязан быть под тестом
// (класс из инцидента 2026-08-08, см. scripts/check-public-scripts.mjs).
//
// Инцидент закрыл только `public/**/*.js` — браузерный код, который грузит
// index.html. Тот же класс остался открытым в СОСЕДНЕЙ директории:
// `deploy/threads-relay/worker.js` — Cloudflare Worker, реально работающий в
// проде, содержащий `sameSecret` (сверку секрета на auth-пути к ретранслятору
// Threads) — и на него не смотрит НИ ОДИН существующий гейт:
//   - check-dead-files.mjs ходит только по src/webapp-src/miniapp-src/shared-src
//     и только по *.ts(x) — .js вне этих деревьев ему не видно вообще;
//   - check-public-scripts.mjs ходит только по webapp/public,
//     schema-miniapp/public, game/public — deploy/ вне его PUBLIC_DIRS.
// Файл лежал вне обоих полей зрения: не в coverage, не в гейте мёртвых
// файлов, не в одном тесте. Ровно то же самое молчание, что пять суток
// прятало сломанный вход в мини-апп.
//
// Что делает гейт:
//   1) берёт список git-tracked файлов *.js/*.mjs/*.cjs/*.sh;
//   2) исключает деревья, за которыми УЖЕ следит другой гейт (см. WATCHED
//      выше) и служебные (dist/, node_modules/, game/ — заморожен, .github/ —
//      YAML-конфиг, не исполняемый код репозитория);
//   3) для каждого оставшегося файла ищет упоминание его имени в тестовых
//      деревьях (src/**/*.spec.ts, test/**/*.ts, {webapp,schema-miniapp,shared}
//      /src/**/*.test.*) — так же, как check-public-scripts.mjs;
//   4) без упоминания — нарушение, если не вписано в бейслайн с причиной;
//   5) протухшая запись бейслайна (файл удалён или обзавёлся тестом) тоже
//      роняет гейт — иначе бейслайн стал бы кладбищем, а не списком
//      осознанных исключений.
//
// `.config.ts` файлы (vite.config.ts, jest.config.ts и т.п.) сюда осознанно
// НЕ входят — расширение фильтра `/\.(js|mjs|cjs|sh)$/` их не ловит: у них
// уже есть tsc/сборка, которая исполняет и типизирует их на каждый прогон,
// это другой класс риска, чем «код, который никто вообще не трогает».
//
// Починить: написать тест, который читает файл с диска и исполняет его
// (образец — webapp/src/maxBridgeLoader.test.ts, src/infra/front-server.spec.ts)
// либо, если это конфиг сборки/линтера без пользовательской логики, вписать
// причину:
//   node scripts/check-unwatched-code.mjs --update
// Посмотреть, что именно попало в проверку: --verbose
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';

const ROOT = join(import.meta.dirname, '..');
const BASELINE = join(ROOT, 'scripts', 'unwatched-code-baseline.json');
const update = process.argv.includes('--update');
const verbose = process.argv.includes('--verbose');

const CODE_EXT = /\.(js|mjs|cjs|sh)$/;

// Деревья, за которыми уже следит другой гейт (см. комментарий выше) —
// префиксы repo-relative путей.
const WATCHED_PREFIXES = [
  'src/',
  'webapp/src/',
  'schema-miniapp/src/',
  'shared/src/',
  'webapp/public/',
  'schema-miniapp/public/',
  'game/public/',
];
// Деревья вне гейта в принципе (не прод-код репозитория или заморожены).
const EXCLUDED_PREFIXES = ['game/', '.github/'];

function gitFiles() {
  return execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

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

// ── тестовые деревья ────────────────────────────────────────────────────────
const isTestFile = (rel) =>
  (rel.startsWith('src/') && rel.endsWith('.spec.ts')) ||
  (rel.startsWith('test/') && rel.endsWith('.ts')) ||
  (rel.startsWith('webapp/src/') && /\.test\.[jt]sx?$/.test(rel)) ||
  (rel.startsWith('schema-miniapp/src/') && /\.test\.[jt]sx?$/.test(rel)) ||
  (rel.startsWith('shared/src/') && /\.test\.[jt]sx?$/.test(rel));

const testText = all
  .filter(isTestFile)
  // git ls-files перечисляет и то, что удалено в рабочем дереве (файл ещё в
  // индексе). Без этого гейт падал стектрейсом ENOENT вместо внятного отчёта —
  // ровно в тот момент, когда тест удалили, то есть когда он и нужен.
  .flatMap((rel) => {
    const abs = join(ROOT, rel);
    return existsSync(abs) ? [readFileSync(abs, 'utf8')] : [];
  })
  .join('\n');

/**
 * Упоминает ли тест этот файл. Полный путь — точное совпадение; голое имя
 * файла засчитывается только на границе (гейты зовутся из песочницы как
 * `runGate('check-x.mjs')`, без каталога).
 *
 * Границей считаем НЕ-часть имени файла: `/`, кавычка, пробел, скобка. Буква,
 * цифра, `_`, `.` и `-` границей НЕ являются — иначе `worker.js` засчитался бы
 * упоминанием `service-worker.js`. Это тот же промах, что уронил вход в
 * инциденте 2026-08-08 (`indexOf('WebAppData=')` находил `tgWebAppData=`):
 * совпадение подстроки — не проверка имени (правило CLAUDE.md).
 */
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
    `✓ исполняемый код вне наблюдаемых деревьев: ${scope.length} файлов, ` +
      `все под тестом (исключений ${Object.keys(base).length}).`,
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
    console.error(`   ${rel} — ни один тест не упоминает этот файл`);
  }
  console.error(
    'Напиши тест, который читает файл с диска и исполняет его (образец: ' +
      'webapp/src/maxBridgeLoader.test.ts, src/infra/front-server.spec.ts) либо,\n' +
      'если это конфиг сборки/линтера без пользовательской логики, впиши причину:',
  );
}

if (stale.length) {
  console.error('❌ протухшие записи бейслайна (файла нет или тест появился):');
  for (const rel of stale) console.error(`   ${rel}`);
}

console.error('Осознанное исключение — впиши причину:');
console.error('  node scripts/check-unwatched-code.mjs --update');
process.exit(1);
