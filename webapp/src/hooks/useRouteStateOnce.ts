// Состояние маршрута → действие один раз на переход: общий поиск (палитра ⌘K) ведёт на адрес с
// состоянием ({ guideSheet }, { assignTask }, { addClient }), экран его разбирает и исполняет.
// «Назад» и обновление страницы действие не повторяют: состояние очищается до исполнения.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * `parse` достаёт цель из location.state (не своя — null), `handle` исполняет её. Сначала состояние
 * очищается (replace), обработчик зовётся следующим шагом: запись истории листа ляжет поверх чистой.
 * `keyOf` различает цели: новая цель с тем же ключом, пока прежняя не очищена, второй раз не исполняется.
 */
export function useRouteStateOnce<T>(parse: (state: unknown) => T | null, handle: (target: T) => void, keyOf: (target: T) => string = () => 'on'): void {
  const location = useLocation();
  const navigate = useNavigate();
  const target = parse(location.state);
  const key = target === null ? null : keyOf(target);
  const pending = useRef<T | null>(null);
  const live = useRef({ handle, target });
  useLayoutEffect(() => { live.current = { handle, target }; });
  useEffect(() => {
    const now = live.current;
    if (now.target !== null) {
      pending.current = now.target;
      navigate(location.pathname + location.search + location.hash, { replace: true, state: null });
      return;
    }
    const next = pending.current;
    pending.current = null;
    if (next !== null) now.handle(next);
    // Только смена цели: адрес между переходом и исполнением не меняется.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
