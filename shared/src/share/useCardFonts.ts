// Готовы ли шрифты карточки шаринга (Literata, Manrope — kit/paperFrame.ts, loadCardFonts):
// canvas без загруженного шрифта молча рисует Georgia, поэтому карточку рисуют сразу и
// перерисовывают, когда флаг стал true (флаг — в зависимостях эффекта отрисовки).
import { useEffect, useState } from 'react';
import { loadCardFonts } from './kit/paperFrame';

export function useCardFontsReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void loadCardFonts().then((ok) => alive && ok && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}
