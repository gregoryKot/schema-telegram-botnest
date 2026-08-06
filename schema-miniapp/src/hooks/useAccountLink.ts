// Состояние привязки аккаунта: логика отдельно от разметки, чтобы её можно
// было проверить тестом без рендера сцены (правило «новый код с логикой
// приезжает с тестом»).
import { useCallback, useRef, useState } from 'react';
import { getHost } from '../../../shared/src/host';
import {
  ACCOUNT_LINK_FAILED_EVENT,
  ACCOUNT_LINK_STARTED_EVENT,
  type AccountLinkFailReason,
  type AccountLinkHost,
} from '../../../shared/src/share/analytics';
import { api } from '../api';
import {
  openLinkPage,
  pollLink,
  startLink,
  type LinkStart,
} from '../utils/deviceLink';

export type LinkState = 'idle' | 'waiting' | 'linked' | 'failed';

export interface AccountLink {
  state: LinkState;
  start: LinkStart | null;
  busy: boolean;
  begin: () => Promise<void>;
}

export function useAccountLink(): AccountLink {
  const [state, setState] = useState<LinkState>('idle');
  const [start, setStart] = useState<LinkStart | null>(null);
  const [busy, setBusy] = useState(false);
  // Второе нажатие не должно запускать второй опрос: у сервера остаётся один
  // активный код на аккаунт, и первый цикл висел бы на мёртвом.
  const running = useRef(false);

  const begin = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    const host = getHost().id as AccountLinkHost;
    // Событие уходит ДО ухода в браузер: без него «начали, но не дошли» ничем
    // не отличается от «даже не пробовали».
    api.trackEvent(ACCOUNT_LINK_STARTED_EVENT, { host });
    try {
      const started = await startLink(host);
      setStart(started);
      setState('waiting');
      openLinkPage(started.userCode);
      setBusy(false);
      const outcome = await pollLink(started);
      if (outcome === 'linked') {
        // Подтверждение считает браузер — здесь только неудачи, иначе один
        // успех посчитался бы дважды.
        setState('linked');
        return;
      }
      setState('failed');
      failed(host, 'expired');
    } catch {
      setState('failed');
      failed(host, 'error');
    } finally {
      setBusy(false);
      running.current = false;
    }
  }, []);

  return { state, start, busy, begin };
}

function failed(host: AccountLinkHost, reason: AccountLinkFailReason): void {
  api.trackEvent(ACCOUNT_LINK_FAILED_EVENT, { host, reason });
}
