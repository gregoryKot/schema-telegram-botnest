import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Конфиг тестов webapp. Отдельный от vite.config.ts, чтобы не тянуть
// jsdom/setup в прод-сборку. Запуск: npm test / npm run test:cov
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Тесты лежат рядом с кодом: foo.ts → foo.test.ts
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/**/*.d.ts',
        'src/main.tsx',
        // Чистые данные без логики
        'src/needData.ts',
        'src/aboutData.ts',
        'src/schemaTherapyData.ts',
      ],
      // Политика храповика: цифры только растут. См. ../TESTING_PLAN.md
      thresholds: { lines: 0, functions: 0, branches: 0, statements: 0 },
    },
  },
});
