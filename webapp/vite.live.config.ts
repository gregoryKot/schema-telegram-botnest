// Прод-сборка сайта с прокси /api на живой стенд (:3000) для e2e-browser/live:
// vite preview сам прокси не применяет, а dev-сервер со StrictMode двоит записи
// листов в истории (#912) — проверять связь надо на прод-сборке.
import { mergeConfig } from 'vite';
import base from './vite.config';

export default mergeConfig(base, {
  preview: {
    port: 5174,
    strictPort: true,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
});
