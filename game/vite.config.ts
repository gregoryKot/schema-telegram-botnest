import { defineConfig } from 'vite';

export default defineConfig({
  base: '/game/', // прод-путь schemehappens.ru/game/ (dev: localhost:5173/game/)
  server: { port: 5173 },
  build: {
    outDir: 'dist',
    // Все спрайты кота инлайним как data-URI прямо в JS-бандл (его хеш меняется
    // каждую сборку). Отдельные файлы /game/assets/cat_*.png имеют СТАБИЛЬНЫЙ
    // контент-хеш (картинка не меняется) → один и тот же URL во всех деплоях.
    // iOS Safari намертво закэшировал для этого URL старый SPA-fallback (HTML
    // вместо PNG, ещё с тех пор когда /game не отдавался) — спрайт не
    // декодируется, «клубка нет». Инлайн убирает отдельные запросы совсем:
    // картинка едет внутри свежего бандла и физически не может «не загрузиться».
    // cat_play(235K)/cat_dash(194K)/cat_sleep(150K) < 300K → инлайнятся.
    assetsInlineLimit: 300 * 1024,
  },
});
