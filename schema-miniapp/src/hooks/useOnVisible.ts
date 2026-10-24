import { useEffect, useRef, useState } from 'react';

// Тикает true один раз, когда узел появляется во вьюпорте (или сразу, если
// IntersectionObserver недоступен). Нужен для ленивой загрузки тепловой
// карты активности профиля: history(112) — самый тяжёлый из запросов вкладки
// «Я» и не нужен для первого экрана (замер 2026-08-22, ProfileSection.tsx —
// см. HeatmapCard.tsx). Общий примитив, не завязан на конкретную карточку —
// можно переиспользовать для любой другой ниже-экрана секции.
export function useOnVisible<T extends Element>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return undefined;
    const node = ref.current;
    // Нет узла (ref ещё не подключён) или нет API (старый WebView) — не
    // оставляем карточку пустой навсегда, считаем видимой сразу.
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return { ref, visible };
}
