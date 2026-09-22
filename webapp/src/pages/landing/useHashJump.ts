import { useEffect } from 'react';

// Инцидент 2026-09-22: объявления Яндекс.Директа ведут на конкретную карточку
// («С чем я работаю» → #anxiety и т.п.), а переход к якорю при первой
// загрузке был написан через `behavior: 'auto'` — это значит «взять из CSS»,
// а в LandingStyles стоит `html { scroll-behavior: smooth; }`. Вместо прыжка
// шла плавная анимация на несколько тысяч пикселей по тяжёлой странице: на
// живом сайте через 8 секунд после захода на /#prices страница всё ещё
// стояла наверху, а когда всё-таки доезжала — картинки успевали догрузиться,
// разметка выше вырастала, и карточка вставала под липкой шапкой вместо
// нужного отступа.
//
// Прыгаем МГНОВЕННО (`behavior: 'instant'`), поэтому смуз-скролл страницы тут
// ни при чём. И прыгаем несколько раз подряд: вёрстка ещё едет после маунта
// (шрифты, картинки, hero-анимации), и один прыжок в самом начале может
// целиться в позицию, которая через долю секунды сместится. Элемент каждый
// раз ищем заново — на повторе он мог перерисоваться.
const RETRY_DELAYS_MS = [0, 200, 600];

export function useHashJump(): void {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const jump = () => {
      if (cancelled) return;
      const el = document.getElementById(id);
      el?.scrollIntoView({ behavior: 'instant', block: 'start' });
    };

    // Живое действие человека — сигнал «дальше сам» — отменяет оставшиеся
    // прыжки, иначе экран дёрнется прямо под рукой во время скролла/тапа.
    const cancel = () => { cancelled = true; };
    window.addEventListener('wheel', cancel, { passive: true });
    window.addEventListener('touchstart', cancel, { passive: true });
    window.addEventListener('keydown', cancel);

    for (const delay of RETRY_DELAYS_MS) timers.push(setTimeout(jump, delay));
    // load может случиться ещё до маунта эффекта (кэш, быстрая сеть) —
    // таймеры выше на этот случай не полагаются на событие вообще.
    window.addEventListener('load', jump);

    return () => {
      cancelled = true;
      for (const t of timers) clearTimeout(t);
      window.removeEventListener('load', jump);
      window.removeEventListener('wheel', cancel);
      window.removeEventListener('touchstart', cancel);
      window.removeEventListener('keydown', cancel);
    };
  }, []);
}
