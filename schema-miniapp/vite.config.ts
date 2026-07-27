/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/app/',
  // shared/ импортирует react: без dedupe он резолвится в КОРНЕВОЙ
  // node_modules → два инстанса React (hooks dispatcher = null).
  resolve: { dedupe: ['react', 'react-dom'] },
  // dev-сервер должен читать ../shared (реэкспорты выходят за root)
  server: { fs: { allow: ['..'] } },
  // Тестовое окружение (environment/globals) НЕ задаётся здесь глобально —
  // каждый *.test.ts(x) сам объявляет `// @vitest-environment jsdom` пер-файл
  // (см. CLAUDE.md / существующие тесты). Настраиваем только coverage —
  // по образцу webapp/vite.config.ts (фронтенд-coverage-храповик).
  test: {
    coverage: {
      provider: 'v8',
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
});
