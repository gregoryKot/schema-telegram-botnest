#!/usr/bin/env node
// Гейт: троттлинг сигнализации живёт в КАНАЛЕ ДОСТАВКИ, а не у вызывающего.
//
// Инцидент 2026-07-29: свёрнутый на час мини-апп шлёт ту же просроченную
// initData в каждом запросе — шквал одинаковых DM «suspicious_initdata»
// замьютил чат админу, и в шквале потонула бы настоящая подделка подписи.
// Фикс завели ТОЧЕЧНО — троттлинг в initdata-alert.ts и в
// auth-failure.report.ts — и он не защитил остальные вызовы того же
// `notifyAdminWithFallback`: `csrf_blocked` (auth-http.util.ts) и
// `refresh_token_reuse` (auth.service.ts) слали DM вообще без троттлинга.
// Регрессия домена cookie/SameSite после деплоя ломает CSRF для КАЖДОЙ
// авторизованной записи КАЖДОГО пользователя разом — то есть DM на каждый
// запрос, админ мьютит чат, и алертинг молчит ровно во время аварии. Тот же
// класс поломки, что и 2026-07-29, только на call site, до которого точечный
// фикс не доехал.
//
// Урок: троттлинг обязан жить в ДОСТАВКЕ (SecurityLogService — единственный
// канал DM для событий безопасности, теперь с бюджетом AlertBudget), а не
// повторяться в каждом новом вызывающем — иначе следующий call site снова
// его забудет.
//
// Проверка: у каждого файла под src/ (не спек), вызывающего
// `notifyAdminWithFallback(` НАПРЯМУЮ, есть выбор —
//   1. быть известным бюджетированным каналом (ALLOWED_CHANNELS ниже);
//   2. попасть в бейслайн с причиной, отвечающей на вопрос «что будет, если
//      это случится тысячу раз подряд?» — легитимные продуктовые уведомления
//      ограниченного объёма (заявка/бронь заполняются живым человеком, а
//      не ботом) это переживают, флуд-подверженные — нет.
//
//   node scripts/check-alert-throttle.mjs            # проверка
//   node scripts/check-alert-throttle.mjs --update    # зафиксировать бейслайн
//   node scripts/check-alert-throttle.mjs --verbose   # что именно найдено, file:line
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const BASELINE = join(ROOT, 'scripts', 'alert-throttle-baseline.json');
const UPDATE = process.argv.includes('--update');
const VERBOSE = process.argv.includes('--verbose');

// Каналы, где `notifyAdminWithFallback(` УЖЕ бюджетирован (или сам является
// примитивом бюджетирования) — им бейслайн не нужен: admin-alert.ts (сам
// примитив доставки), alert.logger.ts (троттлинг по тексту, 60с/ключ),
// security-log.service.ts (AlertBudget K=3/15мин). Экспорт ради структурной
// проверки в alert-throttle.spec.ts (приём REGISTERED_FILES-корпуса).
export const ALLOWED_CHANNELS = new Set([
  'src/utils/admin-alert.ts',
  'src/logger/alert.logger.ts',
  'src/auth/security-log.service.ts',
]);

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

const CALL_RE = /\bnotifyAdminWithFallback\s*\(/g;
const TEST = /\.(spec|test)\.tsx?$/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry === 'dist') continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.ts') && !TEST.test(full)) out.push(full);
  }
  return out;
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

// CLI-логика — только при запуске как скрипт (не при импорте ALLOWED_CHANNELS).
function main() {
const callSites = new Map(); // rel path -> [{line}]
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file).split('\\').join('/');
  // admin-alert.ts объявляет функцию (`export async function
  // notifyAdminWithFallback(`) — это не вызов, а определение примитива,
  // и он же в списке разрешённых каналов, так что даже без спецразбора
  // объявления гейт бы его не тронул. Пропускаем явно ради ясности.
  if (rel === 'src/utils/admin-alert.ts') continue;
  // stripComments ДО поиска: упоминание имени в комментарии или в тексте
  // сообщения об ошибке — не вызов. Ложно-красный гейт отключают через
  // неделю, а это ровно тот класс подстрочного совпадения, что уронил вход
  // в инциденте 2026-08-08 (`indexOf('WebAppData=')` находил `tgWebAppData=`).
  const text = stripComments(readFileSync(file, 'utf8'));
  CALL_RE.lastIndex = 0;
  const hits = [];
  for (let m = CALL_RE.exec(text); m; m = CALL_RE.exec(text)) {
    hits.push(lineOf(text, m.index));
  }
  if (hits.length > 0) callSites.set(rel, hits);
}

if (VERBOSE) {
  for (const [rel, lines] of [...callSites].sort()) {
    for (const line of lines) console.log(`   ${rel}:${line}`);
  }
}

const direct = [...callSites.keys()]
  .filter((rel) => !ALLOWED_CHANNELS.has(rel))
  .sort();

if (UPDATE) {
  const base = existsSync(BASELINE)
    ? JSON.parse(readFileSync(BASELINE, 'utf8'))
    : {};
  const next = {};
  for (const rel of direct) next[rel] = base[rel] ?? 'ПРИЧИНА НЕ УКАЗАНА — впиши';
  writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Бейслайн обновлён: ${direct.length} прямых вызывающих.`);
  for (const rel of direct) console.log(`   ${rel}`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(
    `❌ нет бейслайна ${BASELINE} — зафиксируй текущее состояние:\n` +
      '   node scripts/check-alert-throttle.mjs --update',
  );
  process.exit(1);
}

const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
const known = new Set(Object.keys(base));
const fresh = direct.filter((rel) => !known.has(rel));
const goneButListed = [...known].filter((rel) => !direct.includes(rel));
const noReason = Object.entries(base).filter(
  ([, why]) => String(why).length < 20,
);

const problems = [];
if (fresh.length > 0) {
  problems.push(
    'новые прямые вызовы notifyAdminWithFallback() в обход бюджетированных каналов:',
    ...fresh.map((rel) => `   ${rel}`),
  );
}
if (goneButListed.length > 0) {
  problems.push(
    'записи бейслайна протухли — файл больше не зовёт notifyAdminWithFallback() напрямую:',
    ...goneButListed.map((rel) => `   ${rel}`),
  );
}
if (noReason.length > 0) {
  problems.push(
    'исключение без внятной причины (следующий редактор не поймёт риск флуда):',
    ...noReason.map(([rel]) => `   ${rel}`),
  );
}

if (problems.length > 0) {
  console.error('❌ гейт троттлинга сигнализации:');
  for (const p of problems) console.error(p);
  console.error(
    'Прямой вызов notifyAdminWithFallback() в обход SecurityLogService/AlertLogger —\n' +
      'DM без бюджета: шквал одинаковых событий (пример 2026-07-29 —\n' +
      'suspicious_initdata; та же дыра нашлась у csrf_blocked/refresh_token_reuse)\n' +
      'мьютит админский чат, и алертинг молчит ровно во время аварии.\n' +
      'Заведи событие через SecurityLogService.log() (бюджет уже встроен), либо,\n' +
      'если объём гарантированно ограничен не ботом, а живым пользовательским\n' +
      'действием (заявка, бронь) — впиши причину, отвечающую на вопрос «что\n' +
      'будет, если это случится тысячу раз подряд?»:\n' +
      '   node scripts/check-alert-throttle.mjs --update',
  );
  process.exit(1);
}

console.log(
  `✓ гейт троттлинга сигнализации: ${callSites.size} файлов зовут ` +
    `notifyAdminWithFallback(), ${ALLOWED_CHANNELS.size} бюджетированных ` +
    `канала, ${direct.length} известных прямых исключений.`,
);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
