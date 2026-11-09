// Строка «На этом устройстве» в «Настройках → Уведомления»: состояние веб-пушей
// здесь, включение и выключение по клику и что сказать после. Разметка —
// components/settingsSheet/PushDeviceRow.tsx, решения — pushState.ts.
import { useCallback, useEffect, useState } from 'react';
import { pushApi } from './pushApi';
import {
  currentPushSubscription, preliminaryPushState, pushDeviceState, readPushEnv, reconcilePushState, type PushDeviceState,
} from './pushState';
import type { NotifyChannel } from '../../../shared/src/settings/notifyReach';
import { disablePush, enablePush } from './pushSubscription';

/** Строка-предупреждение под тумблером после действия. */
export type PushNotice = 'enable-failed' | 'disable-failed' | 'not-delivered';

export interface PushDevice {
  /** null — выясняем: нужен ключ сервера и подписка браузера. */
  state: PushDeviceState | null;
  busy: boolean;
  notice: PushNotice | null;
  toggle: () => void;
}

async function loadPublicKey(): Promise<string | null> {
  try {
    return (await pushApi.config()).publicKey;
  } catch (e) {
    console.warn('push: GET /api/push/config не ответил — включение не предлагаем', e);
    return null;
  }
}

/** channel — notifyChannel из настроек (сверка, reconcilePushState); onChanged — перечитать
 *  настройки: после включения и выключения канал другой. */
export function usePushDevice(channel: NotifyChannel | null, onChanged: () => Promise<void> | void): PushDevice {
  // Вебвью мессенджера и браузер без API ясны сразу — без запроса и без скелетона.
  const [early] = useState(() => preliminaryPushState(readPushEnv()));
  const [state, setState] = useState<PushDeviceState | null>(early === 'unsupported' ? early : null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<PushNotice | null>(null);

  useEffect(() => {
    if (early === 'unsupported') return;
    let alive = true;
    void (async () => {
      const key = await loadPublicKey();
      const sub = key ? await currentPushSubscription() : null;
      if (!alive) return;
      setPublicKey(key);
      setState(pushDeviceState(readPushEnv(), key, sub !== null));
    })();
    return () => { alive = false; };
  }, [early]);

  const turnOn = useCallback(async (key: string) => {
    let outcome: Awaited<ReturnType<typeof enablePush>>;
    try {
      outcome = await enablePush(key);
    } catch (e) {
      console.error('push: окно разрешения не открылось', e);
      outcome = { kind: 'error' };
    }
    if (outcome.kind === 'denied') setState('denied');
    if (outcome.kind === 'error') setNotice('enable-failed');
    if (outcome.kind !== 'on') return;
    if (!outcome.delivered) setNotice('not-delivered');
    try {
      await onChanged(); // сначала новый канал, иначе сверка на миг показала бы «выключено»
    } finally {
      setState('on');
    }
  }, [onChanged]);

  const turnOff = useCallback(async () => {
    try {
      await disablePush();
    } catch (e) {
      console.error('push: выключить не удалось', e);
      setNotice('disable-failed');
      return;
    }
    setState('off');
    await onChanged();
  }, [onChanged]);

  const shown = reconcilePushState(state, channel);
  const toggle = useCallback(() => {
    if (busy || !publicKey || (shown !== 'on' && shown !== 'off')) return;
    setBusy(true);
    setNotice(null);
    const run = shown === 'off' ? turnOn(publicKey) : turnOff();
    void run
      .catch((e: unknown) => console.error('push: настройки после переключения не перечитались', e))
      .finally(() => setBusy(false));
  }, [busy, publicKey, shown, turnOn, turnOff]);

  return { state: shown, busy, notice, toggle };
}
