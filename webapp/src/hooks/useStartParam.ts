import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getHost } from '../../../shared/src/host';
import { parseStartParam, type StartAction } from '../../../shared/src/host/startParam';

const LAUNCH_KEYS = ['startapp', 'start_param'];

/**
 * Параметр запуска (`?startapp=` или `start_param` хоста) разбирается ОДИН раз
 * за жизнь страницы и только когда `enabled` (человек вошёл и принял
 * согласия). Неизвестное значение игнорируется. После разбора параметр
 * убирается из адреса, чтобы перезагрузка не открывала согласие второй раз.
 * Само действие выполняет `onAction`; присоединения к паре/терапевту он
 * обязан показывать экраном согласия (M1), а не исполнять.
 */
export function useStartParam(enabled: boolean, onAction: (a: StartAction) => void): void {
  const done = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!enabled || done.current) return;
    done.current = true;
    const action = parseStartParam(getHost().startParam());
    const q = new URLSearchParams(location.search);
    const hadParam = LAUNCH_KEYS.some((k) => q.has(k));
    LAUNCH_KEYS.forEach((k) => q.delete(k));
    const search = q.toString();
    if (action?.kind === 'diaries') {
      navigate('/diary', { replace: true });
    } else if (hadParam) {
      navigate({ pathname: location.pathname, search: search ? `?${search}` : '', hash: location.hash }, { replace: true });
    }
    if (action && action.kind !== 'diaries') onAction(action);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- разбор намеренно одноразовый (done-ref): ни location, ни onAction не должны его перезапускать
  }, [enabled]);
}
