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
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

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
      ` (импорт tokens.css), ${SHARED_NAME_ONLY_TOKENS.length} общих по имени.`,
  );
}

main();
