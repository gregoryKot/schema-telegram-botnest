// Тяжёлые спрайт-листы (клубок, сон, выпад, пёс, соседка). Лежат в ОТДЕЛЬНОМ
// модуле, чтобы Vite вынес их в отдельный async-чанк: главный бандл (меню +
// старт) грузится быстро, а эти догружаются в фоне (см. main.ts).
// Картинки инлайнятся data-URI прямо в этот чанк (assetsInlineLimit) — отдельных
// /game/assets/cat_*.png нет, значит нечему «застрять» в кэше iOS как раньше.
import catPlayUrl  from './assets/cat_play.png';
import catSleepUrl from './assets/cat_sleep.png';
import catDashUrl  from './assets/cat_dash.png';
import neiIdleUrl  from './assets/nei_idle.png';
import docIdleUrl  from './assets/doc_idle.png';
import docTalkUrl  from './assets/doc_talk.png';

export const HEAVY_SHEETS: Record<string, { url: string; fw: number; fh: number }> = {
  cat_play:  { url: catPlayUrl,  fw: 48, fh: 48 }, // позы в кадре кота, показ ×1.5 как у игрока
  cat_sleep: { url: catSleepUrl, fw: 48, fh: 48 },
  cat_dash:  { url: catDashUrl,  fw: 48, fh: 48 },
  nei_idle:  { url: neiIdleUrl,  fw: 48,  fh: 48 }, // соседка (пёс-коллега заменён будильником)
  doc_idle:  { url: docIdleUrl,  fw: 48, fh: 48 }, // терапевт гл.4: дыхание и кивок
  doc_talk:  { url: docTalkUrl,  fw: 48, fh: 48 }, // терапевт гл.4 говорит
};
