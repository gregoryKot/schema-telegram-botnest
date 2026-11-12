import { useEffect, useRef } from 'react';
import { useNodeActions } from '../modeMapActions';
import type { WheelView } from './needWheel';
import { hasLegacy, mergeLegacy } from './wheelData';
import { useWheel } from './wheelContext';

/**
 * Карты #1065 держали оценки и тексты колеса в узле карты. При открытии такой карты
 * терапевтом значения переезжают в концептуализацию клиента: она сильнее, узел
 * заполняет только пустое. Из карты значения убираются, когда их вернул сервер
 * (`saved`): черновик на экране — ещё не запись, сбой или уход со страницы их не теряет.
 */
export function useWheelLegacyMove(id: string, view: WheelView | undefined): void {
  const actions = useNodeActions();
  const wheel = useWheel();
  const asked = useRef<string | null>(null);
  useEffect(() => {
    if (!wheel?.links || !view || !hasLegacy(view)) return;
    const merged = mergeLegacy(wheel.links, view);
    const sig = JSON.stringify(merged);
    if (sig !== JSON.stringify(wheel.links)) {
      // То же колесо второй раз не шлём (сервер мог вернуть его иначе — не зацикливаемся);
      // другое шлём: второе колесо той же карты могло заменить черновик своим.
      if (asked.current !== sig) { asked.current = sig; wheel.save(merged, { auto: true }); }
      return;
    }
    if (wheel.saved && wheel.status === 'idle') actions?.patchData(id, { wheel: { ...(view.period ? { period: view.period } : {}), ...(view.compare ? { compare: true } : {}) } });
  }, [wheel, view, actions, id]);
}
