// Состояние привязки аккаунта: логика отдельно от разметки, чтобы её можно
// было проверить тестом без рендера сцены (правило «новый код с логикой
// приезжает с тестом»).
import { useCallback, useRef, useState } from 'react';
import { getHost } from '../../../shared/src/host';
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
    try {
      const started = await startLink(getHost().id);
      setStart(started);
      setState('waiting');
      openLinkPage(started.userCode);
      setBusy(false);
      const outcome = await pollLink(started);
      setState(outcome === 'linked' ? 'linked' : 'failed');
    } catch {
      setState('failed');
    } finally {
      setBusy(false);
      running.current = false;
    }
  }, []);

  return { state, start, busy, begin };
}
