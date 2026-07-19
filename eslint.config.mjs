// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // .claire/.claude — воркспейсы агент-сессий (различаются между машинами →
    // environment-зависимые счётчики храповика). dist — сборочный вывод.
    // scripts/deploy + plain-Node конфиги (.mjs/.cjs, prisma.config.js) вне
    // tsconfig-проекта: типизированный линтер их не парсит и даёт лишь
    // parse-ошибки-шум. Приложение целиком на .ts/.tsx.
    ignores: [
      'eslint.config.mjs',
      '.claire/**',
      '.claude/**',
      '**/dist/**',
      '**/vite.config.ts',
      'scripts/**',
      'deploy/**',
      '**/*.mjs',
      '**/*.cjs',
      'prisma.config.js',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Правило №9 CLAUDE.md: no-floating-promises — error, новые any — warn.
    // Исторический долг зафиксирован бейслайном (scripts/eslint-baseline.json),
    // храповик scripts/check-eslint-ratchet.mjs не даёт счётчику расти.
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      // async-обработчики событий в JSX (onClick/onKeyDown = async () => …) —
      // штатный и безопасный паттерн React: возвращаемый промис игнорируется
      // фреймворком, а сами хендлеры внутри обёрнуты в try/catch. Точечно
      // отключаем проверку void-return ТОЛЬКО для JSX-атрибутов (документир.
      // опция typescript-eslint), в остальных местах правило действует.
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      "prettier/prettier": ["error", { endOfLine: "auto" }],
      // `_`-префикс — общепринятый маркер «намеренно не используется» (omit
      // через rest, compile-time type-assert `_VerifyTables`); rest-siblings
      // при omit-через-spread тоже не считаем мусором.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // scripts/*.mjs — plain-Node скрипты вне tsconfig: projectService не видит
    // их и давал каждому файлу структурную (parse)-ошибку, из-за чего любой
    // новый скрипт ронял храповик. Линтим без typed-правил.
    files: ['scripts/**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { sourceType: 'module' },
  },
  {
    // Тесты: паттерн проекта — сервис инстанцируется с поддельной Prisma
    // на any (см. CLAUDE.md «Тесты»), плюс jest-глобалы без типов в typed-линте.
    // unsafe-* здесь — заведомый шум, который наказывал храповиком каждый
    // новый spec (а тесты обязательны). Глушим ТОЛЬКО в тестах; для
    // продакшен-кода правила действуют в полную силу.
    // `**/*.e2e-spec.ts` и `test/e2e-support/**` — e2e-смоук (TEST_COVERAGE_PLAN.md,
    // этап 1 п.7): тот же паттерн (in-memory фейк Prisma на any), не матчился
    // старым glob'ом (`app.e2e-spec.ts` не оканчивается на `.spec.ts`).
    files: [
      '**/*.spec.ts',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.e2e-spec.ts',
      '**/*.test-helpers.ts',
      'test/e2e-support/**/*.ts',
    ],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/unbound-method': 'off',
      // Поддельные Prisma-делегаты в тестах — `jest.fn(async () => …)`,
      // чтобы сигнатура совпадала с Promise-возвращающим методом; await внутри
      // мока не нужен. Тот же «заведомый шум», что и unsafe-* выше.
      '@typescript-eslint/require-await': 'off',
    },
  },
);
