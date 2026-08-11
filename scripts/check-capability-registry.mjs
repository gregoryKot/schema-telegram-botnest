#!/usr/bin/env node
// Гейт: класс «ветка, зависящая от конфигурации, деградирует МОЛЧА» (щит,
// волна 8). Заголовный случай — src/utils/admin-alert.ts: без
// BOT_TOKEN/ADMIN_ID и без RESEND_API_KEY/ADMIN_EMAIL КАЖДЫЙ алерт (события
// безопасности, сбои платежей, сбои канала волн 2/3/7) улетает в никуда без
// следа — и никто в системе об этом не узнаёт.
//
// Проверяется форма `if (!token/key/secret/process.env.X) return …` (без
// `throw` в теле ветки) — код, который при отсутствующей env-переменной
// просто ничего не делает вместо явного отказа. Каждый файл с такой веткой
// обязан быть либо
//   1. зарегистрирован в src/infra/capability-report.ts (REGISTERED_FILES
//      ниже — зеркало его `files`, держи их в одном PR), либо
//   2. занесён в бейслайн с причиной, отвечающей на вопрос «что именно тут
//      не является конфигурацией/уже компенсировано в этом же файле».
//
//   node scripts/check-capability-registry.mjs            # проверка
//   node scripts/check-capability-registry.mjs --update    # зафиксировать бейслайн
//   node scripts/check-capability-registry.mjs --verbose   # что именно найдено, file:line
import {
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  existsSync,
} from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const BASELINE = join(ROOT, 'scripts', 'capability-registry-baseline.json');
const UPDATE = process.argv.includes('--update');
const VERBOSE = process.argv.includes('--verbose');

// Зеркало `files` из src/infra/capability-report.ts — файлы, чьи молчаливые
// ветки уже представлены в реестре возможностей и видны в /stats + при
// старте (capability-boot-log.ts). Гейты в этом репозитории однофайловые
// (gate-sandbox копирует ровно один .mjs), поэтому список хардкожен здесь по
// образцу ALLOWED_CHANNELS в check-alert-throttle.mjs, а не импортируется.
const REGISTERED_FILES = new Set([
  'src/utils/admin-alert.ts',
  'src/auth/email.service.ts',
  'src/booking/meeting.service.ts',
  'src/prisma/encryption-wave2.service.ts',
  'src/utils/encrypt-migration.ts',
  'src/channel/targets/threads-token.service.ts',
]);

const TEST = /\.(spec|test)\.tsx?$/;
const IF_RE = /^\s*(?:}\s*else\s+)?if\s*\(!/;
const KEY_RE = /\b(token|apiKey|secret|encryptionKey)\b|process\.env\.[A-Z0-9_]+/i;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry === 'dist') continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.ts') && !TEST.test(full)) out.push(full);
  }
  return out;
}

/** Находит все «if (!config) return …» без throw в теле. Возвращает номера строк. */
function findSilentBranches(text) {
  const lines = text.split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!IF_RE.test(line) || !KEY_RE.test(line)) continue;
    const isBlock = /\{\s*$/.test(line.trim());
    let windowEnd = i;
    if (isBlock) {
      let depth = 1;
      for (let j = i + 1; j < lines.length && j < i + 20; j++) {
        depth +=
          (lines[j].match(/\{/g) ?? []).length -
          (lines[j].match(/\}/g) ?? []).length;
        windowEnd = j;
        if (depth <= 0) break;
      }
    }
    const window = lines.slice(i, windowEnd + 1).join('\n');
    if (/\bthrow\b/.test(window)) continue;
    if (!/\breturn\b/.test(window)) continue;
    hits.push(i + 1);
  }
  return hits;
}

const flagged = new Map(); // rel path -> [line, ...]
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file).split('\\').join('/');
  const hits = findSilentBranches(readFileSync(file, 'utf8'));
  if (hits.length > 0) flagged.set(rel, hits);
}

if (VERBOSE) {
  for (const [rel, lines] of [...flagged].sort()) {
    for (const line of lines) console.log(`   ${rel}:${line}`);
  }
}

const unregistered = [...flagged.keys()]
  .filter((rel) => !REGISTERED_FILES.has(rel))
  .sort();

if (UPDATE) {
  const base = existsSync(BASELINE)
    ? JSON.parse(readFileSync(BASELINE, 'utf8'))
    : {};
  const next = {};
  for (const rel of unregistered) next[rel] = base[rel] ?? 'ПРИЧИНА НЕ УКАЗАНА — впиши';
  writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Бейслайн обновлён: ${unregistered.length} незарегистрированных файлов.`);
  for (const rel of unregistered) console.log(`   ${rel}`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(
    `❌ нет бейслайна ${BASELINE} — зафиксируй текущее состояние:\n` +
      '   node scripts/check-capability-registry.mjs --update',
  );
  process.exit(1);
}

const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
const known = new Set(Object.keys(base));
const fresh = unregistered.filter((rel) => !known.has(rel));
const goneButListed = [...known].filter((rel) => !flagged.has(rel));
const registeredButBaselined = [...known].filter((rel) => REGISTERED_FILES.has(rel));
const noReason = Object.entries(base).filter(([, why]) => String(why).length < 20);

const problems = [];
if (fresh.length > 0) {
  problems.push(
    'новая молчаливая ветка «if (!config) return» вне реестра и вне бейслайна:',
    ...fresh.map((rel) => `   ${rel}`),
  );
}
if (goneButListed.length > 0) {
  problems.push(
    'записи бейслайна протухли — файл больше не содержит такую ветку:',
    ...goneButListed.map((rel) => `   ${rel}`),
  );
}
if (registeredButBaselined.length > 0) {
  problems.push(
    'файл и в реестре, и в бейслайне разом — выбери одно:',
    ...registeredButBaselined.map((rel) => `   ${rel}`),
  );
}
if (noReason.length > 0) {
  problems.push(
    'исключение без внятной причины (следующий редактор не поймёт, почему оно тут):',
    ...noReason.map(([rel]) => `   ${rel}`),
  );
}

if (problems.length > 0) {
  console.error('❌ гейт реестра возможностей:');
  for (const p of problems) console.error(p);
  console.error(
    'Ветка вида `if (!token/key/secret/process.env.X) return …` без throw —\n' +
      'фича молча выключается, и никто в системе об этом не узнаёт (см. заголовок\n' +
      'src/utils/admin-alert.ts — без BOT_TOKEN/ADMIN_ID и RESEND_API_KEY/ADMIN_EMAIL\n' +
      'КАЖДЫЙ алерт улетает в никуда без следа). Заведи запись в\n' +
      'src/infra/capability-report.ts (+ REGISTERED_FILES здесь), либо, если ветка не\n' +
      'про конфигурацию или уже компенсирована в этом же файле — впиши причину:\n' +
      '   node scripts/check-capability-registry.mjs --update',
  );
  process.exit(1);
}

console.log(
  `✓ гейт реестра возможностей: ${flagged.size} файлов с молчаливыми ветками, ` +
    `${REGISTERED_FILES.size} зарегистрированы в capability-report.ts, ` +
    `${unregistered.length} в бейслайне.`,
);
