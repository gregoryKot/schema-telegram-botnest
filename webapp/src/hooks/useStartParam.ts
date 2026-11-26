import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getHost } from '../../../shared/src/host';
import { freshHostParam } from '../../../shared/src/host/handledHostParam';
import {
  LAUNCH_KEYS, parseStartParam, takeLaunchParam, urlStartParam, type StartAction,
} from '../../../shared/src/host/startParam';

/** Куда ведёт действие само по себе, без экрана поверх: «Записи», «Ещё» (там «Задания»), сверка входа на сайт. */
const PATH_OF: Partial<Record<StartAction['kind'], string>> = { diaries: '/diary', tasks: '/more' };
const pathOf = (a: StartAction): string | undefined =>
  a.kind === 'login' ? `/auth/confirm?code=${a.code}` : PATH_OF[a.kind];

/**
 * Параметр запуска разбирается ОДИН раз за жизнь страницы и только когда `enabled` (человек вошёл
 * и принял согласия). Источник по порядку: `start_param` хоста (ссылка t.me), `?startapp=` адреса
 * (кнопка уведомления внутри мессенджера открывает адрес как есть, и в браузере), отложенный до входа
 * (`rememberLaunchParam` у RequireAuth). Неизвестное значение игнорируется. Чтобы перезагрузка не
 * открывала согласие второй раз, параметр после разбора убирается из адреса, а параметр хоста
 * помнится на время вкладки (`freshHostParam`: из подписанных данных запуска его не убрать).
 * Действие выполняет `onAction`; присоединения к паре/терапевту он обязан показывать экраном согласия
 * (M1), а не исполнять. `onHandled` — разбор закончен: очередь входов знает, что ссылка не придёт.
 */
export function useStartParam(enabled: boolean, onAction: (a: StartAction) => void, onHandled?: () => void): void {
  const done = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!enabled || done.current) return;
    done.current = true;
    const pending = takeLaunchParam(); // забираем всегда: отложенное не должно сработать второй раз
    const action = parseStartParam(freshHostParam(getHost().startParam()) ?? urlStartParam(location.search) ?? pending);
    const q = new URLSearchParams(location.search);
    const hadParam = LAUNCH_KEYS.some((k) => q.has(k));
    LAUNCH_KEYS.forEach((k) => q.delete(k));
    const search = q.toString();
    const path = action && pathOf(action);
    if (path) {
      navigate(path, { replace: true });
    } else if (hadParam) {
      navigate({ pathname: location.pathname, search: search ? `?${search}` : '', hash: location.hash }, { replace: true });
    }
    if (action && action.kind !== 'diaries') onAction(action);
    onHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- разбор намеренно одноразовый (done-ref): ни location, ни onAction не должны его перезапускать
  }, [enabled]);
}
