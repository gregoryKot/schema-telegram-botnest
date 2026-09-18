#!/usr/bin/env node
// Гейт-сверка контракта дизайн-токенов (дизайн-аудит 2026-08, В11; правило
// «контракт токенов» CLAUDE.md/DESIGN_AUDIT). Было 24 общих имени токенов
// из 48 (webapp) / 35 (miniapp) — остальные назывались по-разному
// (--c-rose ↔ --accent-red) или существовали только в одном фронтенде, и
// расхождение росло молча: ни один тест этого не видел.
//
// Проверяет два разных обещания:
//   1. Токены, которые ОБЯЗАНЫ совпадать по ЗНАЧЕНИЮ (акцент и его
//      производные, шрифтовая пара) — заданы один раз в
//      shared/src/theme/tokens.css. Гейт проверяет, что оба index.css его
//      импортируют — если импорта нет, значения неизбежно разъедутся.
//   2. Токены, которые обязаны совпадать только ИМЕНЕМ, а значение
//      осознанно локально для площадки (статусные цвета, поверхности —
//      см. комментарий в самом tokens.css). Гейт проверяет, что оба
//      index.css ОБЪЯВЛЯЮТ каждое имя (не просто ссылаются через var()).
//
// Список токенов первого типа гейт не хранит сам — берёт прямо из
// tokens.css (там же и живёт), чтобы не превратиться в третью копию,
// которая расходится с первой. Список второго типа хранится здесь
// (значения для него намеренно НЕ в tokens.css) и продублирован в
// token-contract.spec.ts (фикстуры теста) — тот же приём, что PAIRS в
// check-paired-files.mjs. Отдельного TS-модуля с именами нет: без
// реального потребителя в прод-коде он был бы мёртвым файлом (правило №11
// CLAUDE.md) — сам tokens.css уже достаточно документирован для этой роли.
//
// Третья проверка — запрет фолбэка в var(). `var(--danger, #e5484d)`
// выглядит страховкой, а работает подменой: токена --danger не было
// объявлено нигде, все четыре места рисовались фолбэком, и фолбэки успели
// разъехаться (#e5484d на сайте против #c0392b в мини-аппе — два разных
// красных на одну роль «ошибка», ни один из них не проходил WCAG AA).
// Гейт краснеет на любой фолбэк, кроме тех, где значение по построению
// задаёт не тема — см. FALLBACK_ALLOW и HOST_PREFIXES ниже.
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(import.meta.dirname, '..');
const TOKENS_CSS_PATH = 'shared/src/theme/tokens.css';
const APP_CSS = [
  'webapp/src/index.css',
  'schema-miniapp/src/index.css',
];

// Токены, которые обязаны существовать под одним именем в обоих index.css,
// но их значение НАМЕРЕННО локально для площадки (разный фон/поверхности;
// статусные цвета не сводятся — иначе статус перестаёт читаться).
export const SHARED_NAME_ONLY_TOKENS = [
  '--accent-red',
  // Текст на залитом --accent-red. Значение локально (у площадок разные
  // красные), но имя обязано быть на обеих: иначе следующая красная кнопка
  // мини-аппа снова напишет '#fff' и получит в тёмной теме 2.94:1. Контраст
  // самой ПАРЫ считает webapp/src/index.css.contrast.test.ts.
  '--on-accent-red',
  '--accent-orange',
  '--accent-yellow',
  '--accent-green',
  '--accent-blue',
  '--accent-pink',
  '--bg',
  '--surface',
  '--surface-2',
  '--text',
  '--text-sub',
  '--text-faint',
  '--line',
  '--border-color',
  '--nav-bg',
  '--sheet-bg',
  '--sheet-bg-2',
  '--track-color',
  '--fg-rgb',
];

// Где ищем фолбэки. Оба фронтенда и shared — dist/сборки сюда не попадают.
const FALLBACK_SCAN_DIRS = ['webapp/src', 'schema-miniapp/src', 'shared/src'];
const FALLBACK_SCAN_EXT = ['.css', '.ts', '.tsx'];

// Свойства, у которых значение задаёт НЕ тема, а конкретный инстанс элемента
// (ставится инлайном в style={{ '--x': … }}), — для них фолбэк и есть
// значение по умолчанию «когда инстанс ничего не задал», а не подмена
// отсутствующего токена. Каждая запись обязана иметь живого установщика:
// список короткий намеренно, «на будущее» сюда не пишут (крючок без
// установщика — мёртвая косвенность, так был убран --modal-width).
export const FALLBACK_ALLOW = [
  // webapp/src/components/exercises/ChildhoodWheelEx.tsx — цвет потребности
  // на дорожке колеса, ставится на каждую строку своим.
  '--c-color',
  // webapp/src/components/diary/SchemaChipsStep.tsx — цвет домена схемы на
  // выбранном чипе (фон/текст/рамка), свой у каждого домена.
  '--pill-color',
  '--pill-fg',
  '--pill-border',
];

// Свойства площадки: их ставит не наш CSS, а клиент мессенджера
// (telegram-web-app.js). Их отсутствие — штатное состояние в браузере, и
// фолбэк здесь единственный способ не сломать вёрстку.
const HOST_PREFIXES = ['--tg-'];

// Комментарии не считаются: иначе гейт краснел бы на собственное пояснение в
// shared/src/theme/tokens.css и на комментарии-«было …» рядом с починенными
// местами (тот же приём, что в check-render-poison.mjs). `//` после двоеточия
// не трогаем — это `https://`, а не комментарий.
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function walkFiles(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc; // каталога нет (песочница теста) — нечего сканировать
  }
  for (const entry of entries.sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkFiles(full, acc);
    else if (FALLBACK_SCAN_EXT.some((e) => entry.endsWith(e))) acc.push(full);
  }
  return acc;
}

/** Фолбэки в var(), которые гейт считает нарушением: `var(--name, …)`. */
function findFallbacks() {
  const allowed = new Set(FALLBACK_ALLOW);
  const hits = [];
  for (const dir of FALLBACK_SCAN_DIRS) {
    for (const file of walkFiles(join(ROOT, dir))) {
      const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
      lines.forEach((line, i) => {
        for (const m of line.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)\s*,/g)) {
          const name = m[1];
          if (allowed.has(name)) continue;
          if (HOST_PREFIXES.some((p) => name.startsWith(p))) continue;
          hits.push({
            file: relative(ROOT, file),
            line: i + 1,
            name,
          });
        }
      });
    }
  }
  return hits;
}

function readOrNull(relPath) {
  const p = join(ROOT, relPath);
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8');
}

/** Имена кастомных свойств, ОБЪЯВЛЕННЫХ (не просто упомянутых в var())
 * в файле — только строки вида `  --name: значение;`. */
function declaredNames(css) {
  const names = new Set();
  for (const m of css.matchAll(/^\s*(--[a-zA-Z0-9-]+)\s*:/gm)) {
    names.add(m[1]);
  }
  return names;
}

function main() {
  const tokensCss = readOrNull(TOKENS_CSS_PATH);
  if (tokensCss === null) {
    console.error(`❌ Не найден контракт токенов: ${TOKENS_CSS_PATH}`);
    process.exit(1);
    return;
  }
  const valueTokenNames = [...declaredNames(tokensCss)].sort();

  const appCss = {};
  for (const rel of APP_CSS) {
    const content = readOrNull(rel);
    if (content === null) {
      console.error(`❌ Не найден index.css: ${rel}`);
      process.exit(1);
      return;
    }
    appCss[rel] = content;
  }

  const problems = [];

  // 1. Оба index.css обязаны импортировать контракт значений.
  for (const rel of APP_CSS) {
    const importsContract =
      /@import\s+['"][^'"]*['"]/.test(appCss[rel]) &&
      appCss[rel].includes('shared/src/theme/tokens.css');
    if (!importsContract) {
      problems.push(
        `${rel}: не импортирует ${TOKENS_CSS_PATH} — токены акцента/шрифтов` +
          ` неизбежно разъедутся со вторым фронтендом.`,
      );
    }
  }

  // 2. Токены "только имя" — обязаны быть ОБЪЯВЛЕНЫ в обоих файлах.
  const declared = Object.fromEntries(
    APP_CSS.map((rel) => [rel, declaredNames(appCss[rel])]),
  );
  for (const name of SHARED_NAME_ONLY_TOKENS) {
    const missing = APP_CSS.filter((rel) => !declared[rel].has(name));
    if (missing.length > 0) {
      problems.push(
        `${name}: не объявлен в ${missing.join(', ')} (контракт требует` +
          ` присутствия имени в обоих index.css — см. scripts/check-token-contract.mjs).`,
      );
    }
  }

  // 3. Фолбэк в var() — тихая подмена контракта.
  for (const { file, line, name } of findFallbacks()) {
    problems.push(
      `${file}:${line}: фолбэк в var(${name}, …) — значение придёт мимо темы,` +
        ` если токен не объявлен. Убери фолбэк и объяви ${name} (или возьми` +
        ` подходящий существующий токен); свойство, которое задаёт инстанс` +
        ` элемента, — в FALLBACK_ALLOW с причиной.`,
    );
  }

  if (problems.length > 0) {
    console.error('❌ Контракт токенов нарушен:\n');
    for (const p of problems) console.error(`  - ${p}`);
    console.error(
      '\nСм. shared/src/theme/tokens.css (значения + SHARED_NAME_ONLY_TOKENS выше).',
    );
    process.exit(1);
    return;
  }

  console.log(
    `✓ Контракт токенов соблюдён: ${valueTokenNames.length} общих по значению` +
      ` (импорт tokens.css), ${SHARED_NAME_ONLY_TOKENS.length} общих по имени,` +
      ` фолбэков в var() нет (${FALLBACK_ALLOW.length} исключений-инстансов).`,
  );
}

// Запуск только как CLI: pattern-loader.ts импортирует FALLBACK_ALLOW из
// этого файла, и импорт не должен сканировать настоящее дерево.
if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
