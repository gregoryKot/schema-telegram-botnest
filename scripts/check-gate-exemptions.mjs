#!/usr/bin/env node
// Метагейт — «гейт про гейты» (правило №15 CLAUDE.md). Закрывает класс
// «замалчивание гейта»: исключение (ALLOW/EXCLUDE/EXEMPT/EXCLUDED) внесли
// в список храповика, гейт замолчал на этот случай — а проверить, что оно
// гасит именно законный случай и не шире, никто не проверил. Список без
// теста-образца может опустошиться бесследно (уже случалось: замер на
// каждый существующий ALLOW/EXCLUDE в этом репозитории показал списки,
// которые можно было выкинуть целиком без единого красного теста).
//
// Что делает:
//   1. Находит в scripts/*.mjs все объявления `const`/`let` (экспортируемые
//      и локальные), чьё имя содержит ALLOW/EXCLUDE/EXEMPT/EXCLUDED.
//   2. Игнорирует пустые списки — пустой список нечего проверять.
//   3. Для каждого непустого списка ищет в src/test-support/gates/**/*.ts
//      тест, который упоминает список ПО ИМЕНИ вместе с файлом-источником —
//      через pattern-loader (loadRegexList/loadStringList/loadNamedPatterns)
//      или прямым импортом экспорта.
//   4. Список без такого теста — нарушение: печатает файл, имя, что делать.
//
// Точность важнее полноты (правило CLAUDE.md: ложно-красный гейт отключают
// через неделю) — см. KNOWN_EXEMPTIONS ниже, если список технически не
// поддаётся такой проверке.
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(import.meta.dirname, '..');
const SCRIPTS_DIR = join(ROOT, 'scripts');
const GATES_DIR = join(ROOT, 'src', 'test-support', 'gates');
const SELF = 'check-gate-exemptions.mjs';

// Структурные исключения метагейта — список ОБЯЗАН оставаться маленьким и
// каждая запись обоснованной (та же ирония, что и в правиле №15 CLAUDE.md:
// гейт про исключения не должен сам стать свалкой исключений). На
// 2026-08-18 пуст: у всех найденных списков есть тест по имени.
export const KNOWN_EXEMPTIONS = [];

// Имя списка-исключения — SCREAMING_SNAKE_CASE с одним из четырёх маркерных
// слов. Требуем заглавные буквы, чтобы не ловить служебные локальные
// переменные вроде `excludedPaths` внутри функций — только константы верхнего
// уровня модуля, которые и есть «список правил», а не рабочая переменная.
const NAME_MARKER = /(?:ALLOW|EXCLUDE|EXEMPT|EXCLUDED)/;
const DECL_RE = /^[ \t]*(?:export\s+)?(?:const|let)\s+([A-Z][A-Z0-9_]*)\s*=/gm;

// Свой посимвольный сканер комментариев (та же идея, что в дублированных
// gate-scanner'ах check-unwatched-code.mjs/check-public-scripts.mjs/
// check-alert-throttle.mjs, но не тот же вызывающий код: там гасятся вызовы
// функций в продуктовом коде, здесь — две разные задачи внутри одного файла
// метагейта, дублировать не для чего, gate-scanner-parity.spec.ts сравнивает
// байт-в-байт только настоящие копии).
function stripComments(text) {
  const n = text.length;
  let out = '', i = 0, quote = null, prev = '';
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

// Находит первый `[` после позиции объявления и возвращает текст между ним
// и его закрывающим `]` (баланс глубины, слепой к строкам/regex-литералам —
// их символьные классы `[...]` не в счёт). null — если `[` не нашёлся
// (объявление не список — например, число/строка) или скобка не закрылась.
function extractBalancedArray(source, fromIndex) {
  const start = source.indexOf('[', fromIndex);
  if (start === -1) return null;
  let depth = 0, quote = null, prev = '';
  for (let i = start; i < source.length; i++) {
    const c = source[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; prev = c; continue; }
    if (c === '/' && source[i + 1] === '/') { while (i < source.length && source[i] !== '\n') i++; continue; }
    if (c === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i++; continue;
    }
    if (c === '/' && !/[\w$)\]]/.test(prev)) {
      let j = i + 1, cls = false;
      while (j < source.length && source[j] !== '\n' && (cls || source[j] !== '/')) {
        if (source[j] === '\\') j++;
        else if (source[j] === '[') cls = true;
        else if (source[j] === ']') cls = false;
        j++;
      }
      if (j < source.length && source[j] === '/') j++;
      while (j < source.length && /[a-z]/i.test(source[j])) j++;
      i = j - 1; prev = 'x'; continue;
    }
    if (c === '[') { depth++; prev = c; continue; }
    if (c === ']') {
      depth--;
      if (depth === 0) return source.slice(start + 1, i);
      prev = c; continue;
    }
    if (c > ' ') prev = c;
  }
  return null; // незакрытая скобка — не считаем найденным списком
}

function isNonEmpty(literalText) {
  return stripComments(literalText).replace(/[\s,]/g, '').length > 0;
}

function findExemptionLists(file, source) {
  const found = [];
  DECL_RE.lastIndex = 0;
  let m;
  while ((m = DECL_RE.exec(source))) {
    const name = m[1];
    if (!NAME_MARKER.test(name)) continue;
    const body = extractBalancedArray(source, m.index + m[0].length);
    if (body === null || !isNonEmpty(body)) continue;
    found.push({ file, name });
  }
  return found;
}

function walkTsFiles(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc; // src/test-support/gates ещё не существует (пустая песочница)
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkTsFiles(full, acc);
    else if (entry.endsWith('.ts')) acc.push(full);
  }
  return acc;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Тест «упоминает список по имени», если он либо зовёт load*(file, name)
// из pattern-loader.ts (принятая идиома — см. loadRegexList/loadStringList/
// loadNamedPatterns), либо напрямую импортирует именованный экспорт из
// этого файла-скрипта. Оба варианта явно разрешены заданием.
function isCovered(file, name, testSourceStripped) {
  const scriptNoExt = file.replace(/\.mjs$/, '');
  const callRe = new RegExp(
    `load(?:NamedPatterns|RegexList|StringList)\\(\\s*['"]${escapeRe(file)}['"]\\s*,\\s*['"]${escapeRe(name)}['"]`,
  );
  if (callRe.test(testSourceStripped)) return true;
  const importRe = new RegExp(
    `import\\s*\\{[^}]*\\b${escapeRe(name)}\\b[^}]*\\}\\s*from\\s*['"][^'"]*${escapeRe(scriptNoExt)}(?:\\.mjs)?['"]`,
  );
  return importRe.test(testSourceStripped);
}

function main() {
  const scriptFiles = readdirSync(SCRIPTS_DIR)
    .filter((f) => f.endsWith('.mjs') && f !== SELF)
    .sort();

  const allLists = [];
  for (const file of scriptFiles) {
    const source = readFileSync(join(SCRIPTS_DIR, file), 'utf8');
    allLists.push(...findExemptionLists(file, source));
  }

  const testSource = stripComments(
    walkTsFiles(GATES_DIR)
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n'),
  );

  const known = new Set(KNOWN_EXEMPTIONS.map((e) => `${e.file}::${e.name}`));
  const staleKnown = KNOWN_EXEMPTIONS.filter(
    (e) => !allLists.some((l) => l.file === e.file && l.name === e.name),
  );

  const missing = allLists.filter(
    (l) => !known.has(`${l.file}::${l.name}`) && !isCovered(l.file, l.name, testSource),
  );

  if (missing.length || staleKnown.length) {
    if (missing.length) {
      console.error('❌ Гейт про гейты: список исключений без теста на своё имя.\n');
      for (const { file, name } of missing) {
        console.error(`  scripts/${file}: ${name}`);
      }
      console.error(
        '\nДля каждого списка выше: добавь тест в src/test-support/gates/*.spec.ts,\n' +
          'который зовёт loadRegexList/loadStringList/loadNamedPatterns(\'<файл>\', \'<ИМЯ>\')\n' +
          '(pattern-loader.ts) и проверяет ОБА исхода — образец, который исключение\n' +
          'гасит, И контрольный образец, который оно гасить НЕ должно (правило №15,\n' +
          'CLAUDE.md). Если список технически не поддаётся такой проверке — впиши\n' +
          'запись с причиной в KNOWN_EXEMPTIONS в начале scripts/check-gate-exemptions.mjs,\n' +
          'а не оставляй молчаливый пропуск.',
      );
    }
    if (staleKnown.length) {
      console.error('\n❌ Протухшие KNOWN_EXEMPTIONS (списка больше нет):');
      for (const { file, name } of staleKnown) console.error(`  scripts/${file}: ${name}`);
    }
    process.exit(1);
  }

  console.log(
    `✓ гейт про гейты: ${allLists.length} непустых списков исключений, ` +
      `все с тестом на своё имя (${KNOWN_EXEMPTIONS.length} структурных исключений).`,
  );
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
