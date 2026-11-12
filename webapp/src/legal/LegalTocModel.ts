// Модель оглавления юридического документа (LegalToc.tsx): пункты строятся из глав (Chapter n/title/id) —
// текст пункта тот же, что у заголовка главы, ссылка — на её якорь. Отдельный модуль: файл компонента
// экспортирует только компоненты (быстрое обновление Vite).
import { Children, isValidElement, type ReactNode } from 'react';

export interface TocItem { id: string; label: string }

/** Якорь главы: свой id (`cookies` — на него ведёт баннер cookie) или номер главы. */
export const chapterId = (n: string, id?: string) => id ?? `ch-${n}`;

/** Пункты оглавления из детей документа: только главы (элементы с n и title), по порядку. */
export function tocFromChapters(children: ReactNode): TocItem[] {
  return Children.toArray(children).flatMap((c) => {
    if (!isValidElement<{ n?: unknown; title?: unknown; id?: string }>(c)) return [];
    const { n, title, id } = c.props;
    return typeof n === 'string' && typeof title === 'string' ? [{ id: chapterId(n, id), label: `${n}. ${title}` }] : [];
  });
}
