import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// shared/ не собирается само (нет dev/build — оба фронтенда резолвят его
// относительными импортами, README.md). Этот конфиг только для тестов
// (этап 2.2 TEST_IMPROVEMENT_PLAN.md): shared раньше проверялся лишь
// транзитивно через тесты webapp/schema-miniapp, своих тестов не было.
export default defineConfig({
  plugins: [react()],
  // environment/globals НЕ глобально: каждый *.test.ts(x) сам ставит `// @vitest-environment jsdom`.
  // Очистка DOM после теста — setupFiles (test-support/rtlCleanup.ts), не память автора.
  test: {
    setupFiles: ['./src/test-support/rtlCleanup.ts'],
    coverage: {
      provider: 'v8',
      // json-summary — обязателен: его читает
      // scripts/check-frontend-coverage-ratchet.mjs (по образцу webapp/miniapp).
      reporter: ['text', 'json-summary'],
      include: ['src/**'],
      // *.test-helpers.ts — тестовая обвязка (зоны, смена клиента), не код
      // продукта: её зовут тесты фронтов, а сьюта shared — нет.
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/*.test-helpers.ts',
      ],
    },
  },
});
