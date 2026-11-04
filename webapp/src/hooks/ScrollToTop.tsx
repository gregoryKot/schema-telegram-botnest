import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Переход на другой адрес открывается сверху (QA 2026-11, C-З3): окно на сайте
 * одно на все разделы, и «Записи», прокрученные вниз, оставляли «Сегодня» на
 * той же позиции. «Назад»/«Вперёд» (POP) не трогаем: браузер сам возвращает
 * позицию. Тот же адрес (лист кладёт запись с тем же путём) и replace — тоже.
 */
export function shouldResetScroll(prevPath: string, path: string, navType: string): boolean {
  return navType === 'PUSH' && prevPath !== path;
}

export function ScrollToTop() {
  const { pathname } = useLocation();
  const navType = useNavigationType();
  const prev = useRef(pathname);
  useEffect(() => {
    const was = prev.current;
    prev.current = pathname;
    if (!shouldResetScroll(was, pathname, navType)) return;
    window.scrollTo(0, 0);
    // Десктоп: холст раздела прокручивается сам, а не окно.
    document.querySelectorAll<HTMLElement>('.canvas').forEach(el => { el.scrollTop = 0; });
  }, [pathname, navType]);
  return null;
}
