import { useEffect } from 'react';

const NOINDEX = 'noindex, nofollow';

/**
 * Страница не для поиска: пока компонент смонтирован, `<meta name="robots">`
 * = noindex. index.html уже несёт этот тег (index, follow) — правим его, а не
 * добавляем второй; при размонтировании возвращаем прежнее значение (SPA:
 * следующий маршрут индексируется как раньше). Если тега нет — создаём и
 * убираем за собой.
 */
export function useNoIndex(): void {
  useEffect(() => {
    const existing = document.head.querySelector<HTMLMetaElement>("meta[name='robots']");
    const meta = existing ?? document.createElement('meta');
    if (!existing) { meta.name = 'robots'; document.head.appendChild(meta); }
    const prev = meta.content;
    meta.content = NOINDEX;
    return () => {
      if (existing) meta.content = prev;
      else meta.remove();
    };
  }, []);
}
