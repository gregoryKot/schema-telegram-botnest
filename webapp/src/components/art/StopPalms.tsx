// «Стоп» в сцене «готово» (Sprout, AppScenes.tsx) — вариант мотива Pause: крупно длинная лента в две
// волны читалась червяком (PAPER_2026-11.md, «Сцены»). Свой файл — общий файл сцен не растёт (ревью g4 r3).
import { INK } from './scenePaper';

/** Короткая лента-импульс одной спокойной волной подходит к дуге мха и не касается её;
 *  дуга-ладони Здорового Взрослого стоит на земле и крупнее ленты. */
export function StopPalms() {
  return (
    <g data-motif="pause">
      <path d="M50 152 C 72 128, 98 160, 128 140" fill="none" stroke={INK.clay} strokeWidth="12" strokeLinecap="round" />
      <path d="M150 90 A 50 50 0 0 1 150 190" fill="none" stroke={INK.moss} strokeWidth="26" strokeLinecap="round" />
    </g>
  );
}
