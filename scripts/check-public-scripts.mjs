#!/usr/bin/env node
// Гейт: браузерный код вне `src/` обязан быть под тестом (инцидент 2026-08-08:
// `max-bridge.js` искал ПОДСТРОКУ `WebAppData=`, совпал с `#tgWebAppData=…`
// Telegram — мост MAX грузился у каждого, вход ломался у всех; `public/`
// никто не импортирует, файл был вне coverage/тестов). Требует тест на каждый
// `public/**/*.js` (упоминание ТОЛЬКО в комментарии не считается) и хеш на
// каждый инлайн-`<script>` в index.html. Починить: тест (образец —
// `maxBridgeLoader.test.ts`) либо причина в баселайне:
//   node scripts/check-public-scripts.mjs --update
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { createHash } from 'crypto';

const ROOT = join(import.meta.dirname, '..');
const BASELINE = join(ROOT, 'scripts', 'public-scripts-baseline.json'), update = process.argv.includes('--update');

const PUBLIC_DIRS = ['webapp/public', 'schema-miniapp/public', 'game/public'];
const TEST_TREES = ['src', 'webapp/src', 'schema-miniapp/src', 'shared/src'];
const HTML = ['webapp/index.html', 'schema-miniapp/index.html'];
const TEST_FILE = /\.(spec|test)\.(ts|tsx)$/;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry === 'dist') continue;
    statSync(full).isDirectory() ? walk(full, out) : out.push(full);
  }
  return out;
}

// Дублированный сканер (parity: gate-scanner-parity.spec.ts, идентичен
// check-unwatched-code.mjs). Учитывает regex-литералы — без этого кавычка
// внутри `[...]` (`/['"]/`) сбивает отслеживание строк дальше по файлу.
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

// stripComments ДО поиска — `//`/`/* */`-упоминание не значит, что тест файл исполняет.
const testText = stripComments(
  TEST_TREES.flatMap((t) => walk(join(ROOT, t)))
    .filter((f) => TEST_FILE.test(f))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n'),
);

// 1. Скрипты из public/.
const scripts = PUBLIC_DIRS.flatMap((d) => walk(join(ROOT, d)))
  .filter((f) => f.endsWith('.js'))
  .map((f) => relative(ROOT, f));

const uncovered = scripts.filter((rel) => !testText.includes(rel.split('/').pop()));

// 2. Инлайн-скрипты в index.html (пустые и ld+json — не код, пропускаем).
const INLINE_RE = /<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/gi, inline = [];
for (const rel of HTML) {
  const file = join(ROOT, rel);
  if (!existsSync(file)) continue;
  const html = readFileSync(file, 'utf8');
  INLINE_RE.lastIndex = 0;
  for (let m = INLINE_RE.exec(html); m; m = INLINE_RE.exec(html)) {
    if (/type\s*=\s*["']application\/ld\+json["']/i.test(m[1])) continue;
    const body = m[2].trim();
    if (!body) continue;
    inline.push(`${rel}#inline-${createHash('sha1').update(body).digest('hex').slice(0, 8)}`);
  }
}

const found = [...uncovered, ...inline];
const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};

if (update) {
  const next = {};
  for (const key of found.sort()) next[key] = base[key] ?? 'ПРИЧИНА НЕ УКАЗАНА — впиши';
  writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Бейслайн обновлён: ${found.length} исключений.`); process.exit(0);
}

const unexpected = found.filter((key) => !(key in base)), stale = Object.keys(base).filter((key) => !found.includes(key));

if (unexpected.length === 0 && stale.length === 0) {
  console.log(`✓ браузерные скрипты вне src: ${scripts.length} файлов, все под тестом (исключений ${Object.keys(base).length}).`);
  process.exit(0);
}

if (unexpected.length) {
  console.error('❌ браузерный код без теста (инцидент 2026-08-08):');
  for (const key of unexpected) {
    const why = key.includes('#inline-')
      ? 'инлайн-скрипт в HTML: его нельзя ни импортировать, ни протестировать'
      : 'ни один тест не упоминает этот файл (в реальном коде)';
    console.error(`   ${key} — ${why}`);
  }
  console.error('Напиши тест (образец: maxBridgeLoader.test.ts) либо вынеси логику в src/.');
}

if (stale.length) {
  console.error('❌ протухшие записи бейслайна (файла нет или тест появился):');
  for (const key of stale) console.error(`   ${key}`);
}

console.error('Осознанное исключение — впиши причину:\n  node scripts/check-public-scripts.mjs --update');
process.exit(1);
