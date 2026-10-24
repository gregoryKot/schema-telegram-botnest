#!/usr/bin/env node
// Правила гейта размытия — вынесены из check-render-poison.mjs, чтобы движок
// (обход дерева, вырезание комментариев, храповик) не рос вместе со списком
// паттернов (правило №10 CLAUDE.md). Тест render-poison.spec.ts пинит каждый
// паттерн своим образцом через loadNamedPatterns (pattern-loader.ts).
//
// Свойство ищется целиком, не подстрокой (урок инцидента 2026-08-08:
// совпадение подстроки — не проверка имени). Поэтому `-webkit-backdrop-filter`
// и `WebkitBackdropFilter` — ОТДЕЛЬНЫЕ паттерны от голого `backdrop-filter`/
// `backdropFilter`: дефис/заглавная буква перед именем ломают границу
// совпадения общего паттерна, значит нужен свой на вендорный префикс.
//
// Значение `none` НЕ считается нарушением: schema-miniapp/src/utils/
// perfExperiments.ts вкалывает `backdrop-filter:none!important` (и
// `-webkit-`/camelCase-варианты) как ВЫКЛЮЧАТЕЛЬ размытия для замеров
// (эксперимент noblur) — это сам инструмент диагностики, а не поражённый
// код. У `filter: blur(...)` отдельного «none» нет: `filter: none` под
// паттерн и так не попадает, потому что паттерн требует `blur(` следом.
const NOT_NONE = "(?!\\s*['\"]?none\\b)";

// Имя свойства отделяется от значения не только двоеточием: размытие можно
// вернуть императивно (`el.style.backdropFilter = 'blur(4px)'`,
// `setProperty('backdrop-filter', 'blur(4px)')`) или строковым ключом
// (`{ 'backdrop-filter': 'blur(4px)' }`). Кодовая база такие формы уже
// использует — perfExperiments.ts вкалывает стиль строкой, — поэтому
// разделителем считается двоеточие, знак присваивания ИЛИ закрывающая
// кавычка ключа/аргумента (дыры найдены адверсариальным ревью 2026-08-26).
const SEP = "\\s*['\"]?\\s*(?::|=|,)\\s*";

export const PATTERNS = [
  [
    'css-backdrop-filter',
    new RegExp(`(^|[^-\\w])backdrop-filter${SEP}${NOT_NONE}`, 'gi'),
  ],
  [
    'css-backdrop-filter-webkit',
    new RegExp(`-webkit-backdrop-filter${SEP}${NOT_NONE}`, 'gi'),
  ],
  ['jsx-backdrop-filter', new RegExp(`\\bbackdropFilter${SEP}${NOT_NONE}`, 'g')],
  [
    'jsx-backdrop-filter-webkit',
    new RegExp(`\\bWebkitBackdropFilter${SEP}${NOT_NONE}`, 'g'),
  ],
  ['filter-blur', new RegExp(`(^|[^-\\w])filter${SEP}['"]?\\s*blur\\(`, 'gi')],
  [
    'filter-blur-webkit',
    new RegExp(`-webkit-filter${SEP}['"]?\\s*blur\\(`, 'gi'),
  ],
  [
    'filter-blur-jsx-webkit',
    new RegExp(`\\bWebkitFilter${SEP}['"]?\\s*blur\\(`, 'g'),
  ],
];
