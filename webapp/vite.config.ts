/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // shared/ импортирует react: без dedupe он резолвится в КОРНЕВОЙ
  // node_modules → два инстанса React (hooks dispatcher = null).
  resolve: { dedupe: ['react', 'react-dom'] },
  server: {
    // dev-сервер должен читать ../shared (реэкспорты выходят за root)
    fs: { allow: ['..'] },
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  // Тестовое окружение (environment/globals) НЕ задаётся здесь глобально —
  // каждый *.test.ts(x) сам объявляет `// @vitest-environment jsdom` пер-файл
  // (см. CLAUDE.md / существующие тесты). Настраиваем только coverage.
  test: {
    // Запас на медленный раннер (самый долгий тест локально — 1.6с). Прежние
    // 15000 стояли ради `findByText(…, {timeout: 8000})` — их больше нет.
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      // json-summary — обязателен: его читает scripts/check-frontend-coverage-ratchet.mjs.
      reporter: ['text', 'json-summary'],
      include: ['src/**'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
    },
  },
  build: {
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'vendor-react';
          }
          if (id.includes('schemaTherapyData') || id.includes('needData')) {
            return 'schema-data';
          }
        },
      },
    },
  },
});
