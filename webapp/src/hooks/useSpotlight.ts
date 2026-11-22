// «Нашёл в поиске → показал в списке»: строка, к которой привёл общий поиск, прокручивается в
// середину и на пару секунд обводится (`[data-spotlit]`, index.css). Одна механика на «Задания» и
// «Историю планов»: строка несёт `spotAttr(ключ)`, экран зовёт `useSpotlight(ключ, готов)`.
import { useEffect } from 'react';
import { scrollIntoViewSafe } from '../../../shared/src/utils/scrollIntoView';

/** Сколько держится обводка. */
export const SPOT_MS = 2400;

export const spotKey = (kind: 'task' | 'plan', id: number) => `${kind}:${id}`;
export const spotAttr = (key: string) => ({ 'data-spot': key });

/** `ready` — список отрисован; строки с таким ключом нет — ничего не происходит. */
export function useSpotlight(key: string | null | undefined, ready: boolean): void {
  useEffect(() => {
    if (!key || !ready) return;
    const el = document.querySelector(`[data-spot="${key}"]`);
    if (!el) return;
    scrollIntoViewSafe(el, { block: 'center' });
    el.setAttribute('data-spotlit', '');
    const timer = setTimeout(() => el.removeAttribute('data-spotlit'), SPOT_MS);
    return () => { clearTimeout(timer); el.removeAttribute('data-spotlit'); };
  }, [key, ready]);
}
