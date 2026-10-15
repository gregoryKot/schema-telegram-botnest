/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { requireBotUsernamePlugin } from '../shared/src/build/requireBotUsername.ts';

export default defineConfig({
  plugins: [react(), requireBotUsernamePlugin()],
  // shared/ импортирует react: без dedupe он резолвится в КОРНЕВОЙ
  // node_modules → два инстанса React (hooks dispatcher = null).
  resolve: { dedupe: ['react', 'react-dom'] },
  server: {
    // dev-сервер должен читать ../shared (реэкспорты выходят за root)
    fs: { allow: ['..'] },
    port: 5174,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  // environment/globals НЕ глобально: каждый *.test.ts(x) сам ставит `// @vitest-environment jsdom`.
  // Очистка DOM после теста — setupFiles (test-support/rtlCleanup.ts), не память автора.
  test: {
    setupFiles: ['./src/test-support/rtlCleanup.ts'],
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
