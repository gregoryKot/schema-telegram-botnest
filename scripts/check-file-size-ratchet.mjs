#!/usr/bin/env node
// Храповик размера файлов (правило №10 CLAUDE.md: «Лимит размера файла —
// честный и всеобщий»). До июля 2026 правило «~150 строк, потолок 300»
// держалось на честном слове — ни одного механизма принуждения, и 80 файлов
// пробили потолок (худший — 3370 строк). Правило без гейта не работает.
//
// Механизм — пофайловый храповик (как eslint/jscpd baseline):
//   1. Каждый файл из бейслайна может только УМЕНЬШАТЬСЯ (или стоять). Рост
//      сверх зафиксированного размера роняет CI — раздутый файл дробится,
//      а не пухнет дальше.
//   2. Любой НОВЫЙ файл (не в бейслайне) держится на жёстком потолке
//      NEW_FILE_LIMIT=300. Новый код обязан жить по правилу с первого дня.
//
// Исторический долг заморожен в бейслайне и обязан таять: снизил размер —
// зафиксируй прогресс, чтобы файл нельзя было снова раздуть:
//   node scripts/check-file-size-ratchet.mjs --update
//
// game/ исключён — заморожен решением владельца (как в eslint-храповике).
import { spawnSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const BASELINE_PATH = join(ROOT, 'scripts', 'file-size-baseline.json');
const UPDATE = process.argv.includes('--update');

// Новый файл (не в бейслайне) не имеет права родиться больше этого — жёсткий
// потолок из CLAUDE.md. Легитимное исключение (крупный дата-файл) заводится
// осознанно через --update и видно в диффе PR.
const NEW_FILE_LIMIT = 300;

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
// Что не считаем кодом проекта: vendor, сборки, декларации, тесты (растут
// законно вместе с покрытием), заморозенная игра.
const EXCLUDE = [
  /(^|\/)node_modules\//,
  /(^|\/)dist\//,
  /(^|\/)coverage\//,
  /(^|\/)build\//,
  /\.d\.ts$/,
  /\.(spec|test)\.(ts|tsx|js|jsx)$/,
  /(^|\/)game\//,
  /(^|\/)webapp\/public\//,
];

function listFiles() {
  const res = spawnSync('git', ['ls-files'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.status !== 0) {
    console.error('❌ git ls-files не отработал:\n' + (res.stderr || ''));
    process.exit(1);
  }
  return res.stdout
    .split('\n')
    .filter(Boolean)
    .filter((p) => CODE_EXT.test(p))
    .filter((p) => !EXCLUDE.some((re) => re.test(p)));
}

function countLines(relPath) {
  try {
    const txt = readFileSync(join(ROOT, relPath), 'utf8');
    if (txt === '') return 0;
    // Финальный перевод строки не считаем отдельной строкой (как `wc -l`+1
    // договорённость — здесь берём число строк текста).
    const n = txt.split('\n').length;
    return txt.endsWith('\n') ? n - 1 : n;
  } catch {
    return null; // файл удалён между ls-files и чтением — пропускаем
  }
}

const files = listFiles();
const sizes = {};
for (const f of files) {
  const n = countLines(f);
  if (n !== null) sizes[f] = n;
}

if (UPDATE) {
  const sorted = Object.fromEntries(
    Object.entries(sizes).sort((a, b) => b[1] - a[1]),
  );
  writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + '\n');
  const over = Object.values(sizes).filter((n) => n > NEW_FILE_LIMIT).length;
  console.log(
    `Бейслайн обновлён: ${Object.keys(sizes).length} файлов, ` +
      `${over} сверх потолка ${NEW_FILE_LIMIT} (зафиксированы как долг).`,
  );
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
} catch {
  console.error(
    'Нет бейслайна — сгенерируй: node scripts/check-file-size-ratchet.mjs --update',
  );
  process.exit(1);
}

const grown = []; // файл из бейслайна вырос
const newBig = []; // новый файл сразу больше потолка
for (const [f, n] of Object.entries(sizes)) {
  if (f in baseline) {
    if (n > baseline[f]) grown.push({ f, was: baseline[f], now: n });
  } else if (n > NEW_FILE_LIMIT) {
    newBig.push({ f, now: n });
  }
}

if (grown.length || newBig.length) {
  if (grown.length) {
    console.error('❌ файл-храповик: файлы выросли сверх зафиксированного размера:');
    for (const { f, was, now } of grown.sort((a, b) => b.now - b.was - (a.now - a.was)))
      console.error(`   ${f}: ${was} → ${now} (+${now - was})`);
    console.error(
      'Правило №10 CLAUDE.md: раздутый файл дробится (выноси хуки/подкомпоненты/сервисы),\n' +
        'а не пухнет дальше. Если рост неизбежен и осознан — обнови бейслайн:\n' +
        '  node scripts/check-file-size-ratchet.mjs --update',
    );
  }
  if (newBig.length) {
    console.error(
      `❌ файл-храповик: новые файлы больше потолка ${NEW_FILE_LIMIT} строк:`,
    );
    for (const { f, now } of newBig.sort((a, b) => b.now - a.now))
      console.error(`   ${f}: ${now}`);
    console.error(
      `Новый код живёт по правилу с первого дня (~150 строк, потолок ${NEW_FILE_LIMIT}).\n` +
        'Крупный дата-файл — осознанное исключение через --update (видно в диффе PR).',
    );
  }
  process.exit(1);
}

// Прогресс: сколько файлов усохло против бейслайна.
const shrunk = Object.entries(sizes).filter(
  ([f, n]) => f in baseline && n < baseline[f],
).length;
const overCap = Object.values(sizes).filter((n) => n > NEW_FILE_LIMIT).length;
console.log(
  shrunk
    ? `✓ файл-храповик: без роста, ${shrunk} файлов усохло — зафиксируй: ` +
        `node scripts/check-file-size-ratchet.mjs --update (${overCap} ещё сверх ${NEW_FILE_LIMIT})`
    : `✓ файл-храповик: без роста (${overCap} файлов сверх потолка ${NEW_FILE_LIMIT} — долг тает по мере рефакторинга)`,
);
