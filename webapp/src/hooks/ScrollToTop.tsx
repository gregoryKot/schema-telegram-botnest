import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { shouldResetScroll } from './shouldResetScroll';

/** Переход на другой адрес открывается сверху (QA 2026-11, C-З3); правило — в shouldResetScroll. */
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
