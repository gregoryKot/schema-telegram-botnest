import { useEffect, useState } from 'react';
import type { UserSettings } from '../apiTypes';
import { notifyReachable } from './notifyReach';

// Дойдёт ли напоминание — для экранов, которые обещают «напомним» (U5, аудит
// 2026-11): без канала (ни Telegram, ни веб-пушей на устройстве) обещание
// врало. Развилка та же, что в «Уведомлениях» (`notifyReachable`, канал —
// notifyChannelOf); лист плана берёт признак из своей загрузки настроек.

/** true/false — ответ сервера; null — ответа ещё нет или запрос упал. */
export function useNotifyReach(
  getSettings: () => Promise<Pick<UserSettings, 'notifyReachable'>>,
): boolean | null {
  const [reach, setReach] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    getSettings()
      .then((s) => {
        if (alive) setReach(notifyReachable(s));
      })
      // Без ответа обещание просто не звучит (null) — лог для разбора.
      .catch((e: unknown) => console.error('getSettings failed', e));
    return () => {
      alive = false;
    };
  }, [getSettings]);
  return reach;
}
