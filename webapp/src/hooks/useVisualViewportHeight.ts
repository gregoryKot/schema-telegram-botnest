import { useEffect, useState } from 'react';

export interface VisualViewportBox { height: number; offsetTop: number }

function read(): VisualViewportBox | null {
  const vv = typeof window === 'undefined' ? null : window.visualViewport;
  return vv ? { height: Math.round(vv.height), offsetTop: Math.round(vv.offsetTop) } : null;
}

/**
 * Видимая область окна: экранная клавиатура сжимает и сдвигает её, а не окно. Лист во весь экран
 * берёт отсюда высоту, чтобы низ не уходил под клавиатуру. Нет visualViewport — null (запасное в CSS).
 */
export function useVisualViewportHeight(): VisualViewportBox | null {
  const [box, setBox] = useState(read);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setBox((prev) => {
      const next = read();
      return prev && next && prev.height === next.height && prev.offsetTop === next.offsetTop ? prev : next;
    });
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return box;
}
