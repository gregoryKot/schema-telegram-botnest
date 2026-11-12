// Готовы ли шрифты карточки шаринга (Literata, Manrope — kit/paperFrame.ts, loadCardFonts):
// canvas без загруженного шрифта молча рисует Georgia, поэтому карточку рисуют сразу и
// перерисовывают, когда флаг стал true (флаг — в зависимостях эффекта отрисовки). Не дождались за
// тайм-аут — ждём, пока браузер догрузит шрифты (document.fonts.ready), и пробуем ещё раз.
import { useEffect, useState } from 'react';
import { loadCardFonts } from './kit/paperFrame';

export function useCardFontsReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const retryWhenLoaded = () =>
      document.fonts?.ready?.then(() => (alive ? loadCardFonts() : false)).then((ok) => alive && ok && setReady(true));
    void loadCardFonts().then((ok) => {
      if (!alive) return;
      if (ok) setReady(true);
      else void retryWhenLoaded();
    });
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}
