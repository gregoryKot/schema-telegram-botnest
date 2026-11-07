import { useLayoutEffect, type RefObject } from 'react';

/** Верх холста от начала страницы, px: рамка элемента + прокрутка окна. */
export function canvasTop(el: Pick<HTMLElement, 'getBoundingClientRect'>, scrollY: number): number {
  return Math.round(el.getBoundingClientRect().top + scrollY);
}

// Высота холста на телефоне = экран минус то, что над ним и под ним. Низ известен
// (--mobile-nav-h, --safe-bottom), а верх — это реальная шапка карточки клиента,
// и она меняется: имя в две строки, перенос строки встречи, полоса карт. Раньше
// верх оценивали константой 240px, и холст уходил под нижнюю панель на 4–73px
// (QA 2026-11, T-2). Здесь верх замеряется и кладётся в --mm2-top; CSS
// (sheet-modemap.css) вычитает его из 100dvh. Замер — от начала страницы, а не от
// окна, поэтому прокрутка его не меняет; следим за размером всего, что стоит выше холста, и за поворотом экрана.
export function useCanvasTop(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      const next = `${canvasTop(el, window.scrollY)}px`;
      if (el.style.getPropertyValue('--mm2-top') !== next) el.style.setProperty('--mm2-top', next);
    };
    apply();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(apply) : null;
    // Всё, что стоит выше холста: предыдущие соседи самого холста и его предков.
    // Страница целиком не годится — её высота от высоты холста не зависит лишь
    // пока шапка не выросла, а рост шапки и есть то, что нужно поймать.
    for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) {
      for (let sib = n.previousElementSibling; sib; sib = sib.previousElementSibling) ro?.observe(sib);
    }
    ro?.observe(document.body); // новые блоки над холстом
    window.addEventListener('resize', apply);
    return () => { ro?.disconnect(); window.removeEventListener('resize', apply); };
  }, [ref]);
}
