#!/usr/bin/env node
// Порядок CSS-файлов в собранном webapp/dist/index.html (ревью волны 0 редизайна, 2026-11-09).
// Каскад правил с равной специфичностью решает порядок <link rel="stylesheet">, а его задаёт не
// исходник, а то, как сборщик разложил модули по чанкам: новый импорт в компоненте главного потока
// дважды переносил CSS в другой чанк — `client-why.css` и `therapy-bridge.css` вставали после
// `cabinet.css`, `ExScreen.css` — раньше `index.css` (docs/open/frontend-ux.md). Тесты стилей
// читают исходники и этого не видят; нашли снимки стенда и бандл-храповик.
//
// Гейт сверяет имена чанков (без контент-хеша) с закреплённым списком scripts/css-link-order.json:
// любая перестановка, новый или пропавший файл — красное. Порядок поменялся намеренно — проверь
// каскад (снимки стенда до/после, сверка собранного CSS), затем `--update` и причина — строкой в описании PR.
//
//   node scripts/check-css-link-order.mjs            # проверка (после сборки webapp)
//   node scripts/check-css-link-order.mjs --update   # закрепить текущий порядок
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = join(ROOT, 'webapp', 'dist', 'index.html');
const PINNED = join(ROOT, 'scripts', 'css-link-order.json');
const UPDATE = process.argv.includes('--update');

/** Имена CSS-чанков по порядку `<link rel="stylesheet">`: `/assets/index-dyto_Osq.css` → `index`. */
function stylesheetOrder(html) {
  const out = [];
  for (const tag of html.match(/<link\b[^>]*>/g) ?? []) {
    if (!/\brel=["']?stylesheet\b/.test(tag)) continue;
    const href = tag.match(/\bhref=["']?([^"'\s>]+)/)?.[1] ?? '';
    const file = href.split('/').pop() ?? '';
    out.push(file.replace(/-[\w-]{8}\.css$/, '').replace(/\.css$/, ''));
  }
  return out;
}

if (!existsSync(HTML)) {
  console.error(
    '❌ порядок CSS: нет webapp/dist/index.html — гейт смотрит готовую сборку.\n' +
      'Сначала: cd webapp && VITE_BOT_USERNAME=… node_modules/.bin/vite build.\n' +
      'В CI шаг стоит после сборки webapp; эта ошибка там — сломан порядок шагов в ci.yml.',
  );
  process.exit(1);
}

const actual = stylesheetOrder(readFileSync(HTML, 'utf8'));

if (UPDATE) {
  writeFileSync(PINNED, JSON.stringify({ 'webapp/dist/index.html': actual }, null, 2) + '\n');
  console.log(`✓ порядок CSS закреплён: ${actual.join(' → ')}`);
  process.exit(0);
}

const expected = existsSync(PINNED) ? JSON.parse(readFileSync(PINNED, 'utf8'))['webapp/dist/index.html'] : null;
if (!Array.isArray(expected)) {
  console.error('❌ порядок CSS: нет списка в scripts/css-link-order.json — закрепи его: --update.');
  process.exit(1);
}

if (actual.join('\n') !== expected.join('\n')) {
  console.error(
    '❌ порядок CSS в webapp/dist/index.html изменился:\n' +
      `  было:  ${expected.join(' → ')}\n` +
      `  стало: ${actual.join(' → ')}\n` +
      'Файл переехал в другой чанк — правила с равной специфичностью теперь спорят в другом порядке.\n' +
      'Чаще всего виноват новый импорт в модуле главного потока: верни порядок импортов или вынеси\n' +
      'спорное правило на два класса (.ds-btn.x). Порядок нужен такой — сверь снимки стенда до/после,\n' +
      'затем: node scripts/check-css-link-order.mjs --update, причина — строкой в описании PR (правило №15).',
  );
  process.exit(1);
}

console.log(`✓ порядок CSS: ${actual.join(' → ')}`);
