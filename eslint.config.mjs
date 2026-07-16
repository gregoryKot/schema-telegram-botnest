// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // .claire/.claude — воркспейсы агент-сессий: их содержимое различается
    // между машинами и давало environment-зависимые счётчики храповика.
    // dist — сборочный вывод, scripts/deploy — plain-Node утилиты вне tsconfig:
    // типизированный линтер их не парсит и выдаёт только parse-ошибки-шум.
    ignores: [
      'eslint.config.mjs',
      '.claire/**',
      '.claude/**',
      '**/dist/**',
      'scripts/**',
      'deploy/**',
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
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  {
    // Тесты: паттерн проекта — сервис инстанцируется с поддельной Prisma
    // на any (см. CLAUDE.md «Тесты»), плюс jest-глобалы без типов в typed-линте.
    // unsafe-* здесь — заведомый шум, который наказывал храповиком каждый
    // новый spec (а тесты обязательны). Глушим ТОЛЬКО в тестах; для
    // продакшен-кода правила действуют в полную силу.
    files: ['**/*.spec.ts', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
);
