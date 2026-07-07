// Тяжёлые спрайт-листы (клубок, сон, выпад, пёс, соседка). Лежат в ОТДЕЛЬНОМ
// модуле, чтобы Vite вынес их в отдельный async-чанк: главный бандл (меню +
// старт) грузится быстро, а эти ~0.6 МБ догружаются в фоне (см. main.ts).
// Картинки инлайнятся data-URI прямо в этот чанк (assetsInlineLimit) — отдельных
// /game/assets/cat_*.png нет, значит нечему «застрять» в кэше iOS как раньше.
import catPlayUrl  from './assets/cat_play.png';
import catSleepUrl from './assets/cat_sleep.png';
import catDashUrl  from './assets/cat_dash.png';
import neiIdleUrl  from './assets/nei_idle.png';

export const HEAVY_SHEETS: Record<string, { url: string; fw: number; fh: number }> = {
  cat_play:  { url: catPlayUrl,  fw: 257, fh: 257 },
  cat_sleep: { url: catSleepUrl, fw: 190, fh: 190 },
  cat_dash:  { url: catDashUrl,  fw: 269, fh: 269 },
  nei_idle:  { url: neiIdleUrl,  fw: 48,  fh: 48 }, // соседка (пёс-коллега заменён будильником)
};
