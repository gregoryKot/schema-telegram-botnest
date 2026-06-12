import { defineConfig } from 'vite';

export default defineConfig({
  base: '/game/', // прод-путь schemalab.ru/game/ (dev: localhost:5173/game/)
  server: { port: 5173 },
  build: { outDir: 'dist' },
});
