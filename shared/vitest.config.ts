import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// shared/ не собирается само (нет dev/build — оба фронтенда резолвят его
// относительными импортами, README.md). Этот конфиг только для тестов
// (этап 2.2 TEST_IMPROVEMENT_PLAN.md): shared раньше проверялся лишь
// транзитивно через тесты webapp/schema-miniapp, своих тестов не было.
export default defineConfig({
  plugins: [react()],
  // Тестовое окружение (environment/globals) НЕ задаётся здесь глобально —
  // каждый *.test.ts(x) сам объявляет `// @vitest-environment jsdom` пер-файл
  // (см. CLAUDE.md / webapp/vite.config.ts). Настраиваем только coverage.
  test: {
    coverage: {
      provider: 'v8',
      // json-summary — обязателен: его читает
      // scripts/check-frontend-coverage-ratchet.mjs (по образцу webapp/miniapp).
      reporter: ['text', 'json-summary'],
      include: ['src/**'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
  },
});
