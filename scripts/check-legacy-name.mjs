#!/usr/bin/env node
// Гейт против возврата старого НАЗВАНИЯ продукта «СхемаЛаб» / «Схема-лаб»
// (issue: «схемалаб снова и снова всплывает — нет больше этого названия, мы
// переехали»). Продукт называется «Всё по схеме» / schemehappens.ru.
//
// Старое имя всплывало кириллицей — в заголовке карточки «О приложении», в
// share-тексте приглашения клиента, в вотермарке экспорта. Первый проход искал
// только латиницей (SchemaLab) и кириллицу пропустил — поэтому ловим кириллицу.
//
// Про юзернейм бота этот гейт НЕ про: он живёт в utils/botConfig.ts из env
// (дефолт-фолбэк 'SchemaLabBot' там легитимен), переезд делается сменой env.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(import.meta.dirname, '..');
const SCAN_DIRS = [
  join(ROOT, 'webapp', 'src'),
  join(ROOT, 'schema-miniapp', 'src'),
];

// «лаб» обязателен после «схема» — «схема-терапия», «дневник схем» не триггерят.
const LEGACY_NAME = /схема[-\s]?лаб/i;

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === 'dist') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx|css)$/.test(p)) yield p;
  }
}

const offenders = [];
for (const scanDir of SCAN_DIRS) {
  for (const file of walk(scanDir)) {
    const rel = relative(ROOT, file).split('\\').join('/');
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (LEGACY_NAME.test(line)) offenders.push({ rel, line: i + 1, text: line.trim() });
      });
  }
}

if (offenders.length > 0) {
  console.error(
    '❌ Старое название продукта «СхемаЛаб»/«Схема-лаб» вернулось.\n' +
      '   Продукт называется «Всё по схеме» — используй его.\n',
  );
  for (const o of offenders) console.error(`   ${o.rel}:${o.line}  ${o.text}`);
  process.exit(1);
}

console.log('✓ Старого имени «СхемаЛаб»/«Схема-лаб» в исходниках нет.');
