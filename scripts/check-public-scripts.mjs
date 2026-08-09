#!/usr/bin/env node
// Гейт: браузерный код вне `src/` обязан быть под тестом (инцидент 2026-08-08).
//
// Что случилось. `webapp/public/max-bridge.js` решал «мы внутри MAX?» поиском
// ПОДСТРОКИ `WebAppData=` во фрагменте адреса. Telegram передаёт свои
// стартовые данные тем же фрагментом — `#tgWebAppData=…`, подстрока совпала,
// и мост MAX грузился у КАЖДОГО пользователя Telegram: вход ломался у всех.
//
// Почему не поймали. Файл лежит в `public/`, его никто не импортирует —
// значит он невидим сразу для всего: coverage считает только `src/**`,
// гейт мёртвых файлов ходит по `.ts/.tsx` в `src`-деревьях, тесты его не
// исполняли ни разу. Eslint файл видел, но подстрока — валидный код.
// Двадцать строк, которые выполняются у всех пользователей, ехали в прод
// вообще без проверки.
//
// Что требует гейт:
//   1) у каждого `public/**/*.js` есть тест, который его упоминает (то есть
//      кто-то его исполняет или хотя бы читает);
//   2) каждый инлайн-`<script>` в index.html записан в бейслайн по хешу
//      содержимого — правка такого кода обязана быть осознанной (инлайн
//      нельзя ни импортировать, ни протестировать, поэтому логике там не
//      место, а theme-bootstrap заморожен как есть).
//
// Исключения — `scripts/public-scripts-baseline.json`, ключ → причина.
// Протухшая запись (файл удалён или у него появился тест) тоже роняет гейт:
// бейслайн-свалка хуже отсутствующего гейта.
//
// Починить: написать тест (образец — `webapp/src/maxBridgeLoader.test.ts`:
// читает файл с диска и исполняет с поддельными window/document) либо, если
// это вендорный SDK, вписать причину:
//   node scripts/check-public-scripts.mjs --update
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { createHash } from 'crypto';

const ROOT = join(import.meta.dirname, '..');
const BASELINE = join(ROOT, 'scripts', 'public-scripts-baseline.json');
const update = process.argv.includes('--update');

const PUBLIC_DIRS = ['webapp/public', 'schema-miniapp/public', 'game/public'];
const TEST_TREES = ['src', 'webapp/src', 'schema-miniapp/src', 'shared/src'];
const HTML = ['webapp/index.html', 'schema-miniapp/index.html'];
const TEST_FILE = /\.(spec|test)\.(ts|tsx)$/;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry === 'dist') continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const testText = TEST_TREES.flatMap((t) => walk(join(ROOT, t)))
  .filter((f) => TEST_FILE.test(f))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

// ── 1. Скрипты из public/ ───────────────────────────────────────────────────
const scripts = PUBLIC_DIRS.flatMap((d) => walk(join(ROOT, d)))
  .filter((f) => f.endsWith('.js'))
  .map((f) => relative(ROOT, f));

const uncovered = scripts.filter((rel) => {
  const name = rel.split('/').pop();
  return !testText.includes(name);
});

// ── 2. Инлайн-скрипты в index.html ──────────────────────────────────────────
// Пустые и `application/ld+json` не считаем: первые ничего не делают, вторые —
// разметка для поисковика, не исполняемый код.
const INLINE_RE = /<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
const inline = [];
for (const rel of HTML) {
  const file = join(ROOT, rel);
  if (!existsSync(file)) continue;
  const html = readFileSync(file, 'utf8');
  INLINE_RE.lastIndex = 0;
  for (let m = INLINE_RE.exec(html); m; m = INLINE_RE.exec(html)) {
    if (/type\s*=\s*["']application\/ld\+json["']/i.test(m[1])) continue;
    const body = m[2].trim();
    if (!body) continue;
    const hash = createHash('sha1').update(body).digest('hex').slice(0, 8);
    inline.push(`${rel}#inline-${hash}`);
  }
}

// ── Сверка с бейслайном ─────────────────────────────────────────────────────
const found = [...uncovered, ...inline];
const base = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};

if (update) {
  const next = {};
  for (const key of found.sort()) {
    next[key] = base[key] ?? 'ПРИЧИНА НЕ УКАЗАНА — впиши';
  }
  writeFileSync(BASELINE, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Бейслайн обновлён: ${found.length} исключений.`);
  process.exit(0);
}

const unexpected = found.filter((key) => !(key in base));
const stale = Object.keys(base).filter((key) => !found.includes(key));

if (unexpected.length === 0 && stale.length === 0) {
  console.log(
    `✓ браузерные скрипты вне src: ${scripts.length} файлов, все под тестом ` +
      `(исключений ${Object.keys(base).length}).`,
  );
  process.exit(0);
}

if (unexpected.length) {
  console.error('❌ браузерный код без теста (инцидент 2026-08-08):');
  for (const key of unexpected) {
    console.error(
      key.includes('#inline-')
        ? `   ${key} — инлайн-скрипт в HTML: его нельзя ни импортировать, ни протестировать`
        : `   ${key} — ни один тест не упоминает этот файл`,
    );
  }
  console.error(
    'Напиши тест (образец: webapp/src/maxBridgeLoader.test.ts — читает файл\n' +
      'с диска и исполняет с поддельными window/document) либо вынеси логику\n' +
      'в src/, где её видят coverage и остальные гейты.',
  );
}

if (stale.length) {
  console.error('❌ протухшие записи бейслайна (файла нет или тест появился):');
  for (const key of stale) console.error(`   ${key}`);
}

console.error('Осознанное исключение — впиши причину:');
console.error('  node scripts/check-public-scripts.mjs --update');
process.exit(1);
