// Трансформер jest для ESM-пакетов Nest 12 (переезд на NestJS 12, 2026-10-24).
//
// Зачем: с 12-й версии пакеты @nestjs/* (common, core, testing,
// platform-express, config, schedule, serve-static) — только ESM
// (`"type": "module"`). Бэкенд остаётся на CommonJS: в рантайме Node 22.12+
// грузит их через require(esm) сам, а jest — нет. Свой загрузчик модулей jest
// умеет require(esm) только на Node 24.9+ (нужен
// `vm.SourceTextModule#hasAsyncGraph`), а CI, Dockerfile и машины агентов —
// на Node 22. Без этого файла любой спек, импортирующий '@nestjs/common',
// падает с «Must use import to load ES Module».
//
// Что делает: babel переводит import/export в CommonJS (`import()` — в
// `require`), а `import.meta` — в объект-литерал с путём файла, известным на
// этапе трансформации. Строки, а не `require('node:url')` в рантайме: пакеты
// объявляют свой `const require = createRequire(import.meta.url)`, и любой
// вставленный вызов `require` попал бы в его TDZ (так падал serve-static).
// Подключён в `transform` обоих конфигов jest (package.json и
// test/jest-e2e.json) только для перечисленных пакетов — список в
// `transformIgnorePatterns` там же. Переедем на Node 24.9+ — трансформер и
// исключения можно убрать.
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { dirname } = require('node:path');
const { pathToFileURL } = require('node:url');
const babelJest = require('babel-jest').default;

/** `import.meta` → `{ url, dirname, filename }` трансформируемого файла. */
function importMetaToCjs({ types: t }) {
  return {
    name: 'import-meta-to-cjs',
    visitor: {
      MetaProperty(path, state) {
        const { meta, property } = path.node;
        if (meta.name !== 'import' || property.name !== 'meta') return;
        const file = state.filename;
        const prop = (k, v) => t.objectProperty(t.identifier(k), t.stringLiteral(v));
        path.replaceWith(
          t.objectExpression([
            prop('url', pathToFileURL(file).href),
            prop('dirname', dirname(file)),
            prop('filename', file),
          ]),
        );
      },
    },
  };
}

const babelOptions = {
  babelrc: false,
  configFile: false,
  sourceType: 'module',
  // dynamic-import включает в babel 7 перевод `import()` в `require` внутри
  // modules-commonjs: без него `import('class-validator')` в ValidationPipe
  // падает в vm-скрипте jest, и Nest гасит процесс «package is missing».
  plugins: [
    importMetaToCjs,
    '@babel/plugin-transform-dynamic-import',
    '@babel/plugin-transform-modules-commonjs',
  ],
};

const base = babelJest.createTransformer(babelOptions);
// Ключ кэша babel-jest не видит тела плагина (функция в JSON не попадает):
// без соли правка этого файла молча отдавала бы старый результат из кэша
// (в CI кэш живёт, пока не сменится package-lock.json).
const salt = createHash('sha1').update(readFileSync(__filename)).digest('hex');

module.exports = {
  ...base,
  getCacheKey: (...args) => `${base.getCacheKey(...args)}:${salt}`,
  getCacheKeyAsync: async (...args) =>
    `${await base.getCacheKeyAsync(...args)}:${salt}`,
  importMetaToCjs,
  babelOptions,
};
