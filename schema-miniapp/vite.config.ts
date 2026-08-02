/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // PWA-каркас (docs/PWA_PLAN.md фаза 1, docs/MULTI_HOST_PLAN.md шаг 3).
    // injectManifest, не generateSW — фаза 4 добавит свой push-handler в
    // sw.ts, переезд стратегии посреди пути был бы лишней переделкой.
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      // Регистрирует schema-miniapp/src/registerServiceWorker.ts (только в
      // web-хосте, см. её же комментарий) — не сгенерированный клиент плагина.
      injectRegister: false,
      manifest: {
        name: 'Всё по схеме',
        short_name: 'Всё по схеме',
        description:
          'Дневник состояний, тест по схемам и практики между сессиями.',
        lang: 'ru',
        display: 'standalone',
        scope: '/app/',
        start_url: '/app/',
        // Светлая тема мини-аппа (src/index.css, html[data-theme="light"]) —
        // манифест один, тёмную отрабатывает meta theme-color в index.html.
        theme_color: '#f4f0e9',
        background_color: '#f4f0e9',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        // Только оболочка сборки — html/js/css. /api/* НИКОГДА не кэшируется
        // (терапевтические данные — правило PWA_PLAN 1.1/CLAUDE.md): прекэш
        // строится из билд-ассетов (self.__WB_MANIFEST), путей API тут нет
        // и быть не может — этот glob их физически не видит.
        globPatterns: ['**/*.{js,css,html}'],
      },
      devOptions: { enabled: false },
    }),
  ],
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
        // Воркер-скрипт: выполняется в SW-контексте, не в jsdom. Логика —
        // три строчки precache + message-listener, тестировать нечего.
        'src/sw.ts',
      ],
    },
  },
});
