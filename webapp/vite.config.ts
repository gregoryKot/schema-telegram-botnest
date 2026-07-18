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
