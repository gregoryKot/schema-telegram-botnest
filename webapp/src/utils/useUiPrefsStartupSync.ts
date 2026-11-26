import { useEffect, useState } from 'react';
import type { UiPrefsPatch } from '../../../shared/src/prefs/uiPrefsSync';

const STARTUP_TIMEOUT_MS = 5000;

interface Deps {
  load: () => Promise<{ uiPrefs?: UiPrefsPatch | null }>;
  sync: (prefs: UiPrefsPatch | null | undefined) => void;
  reset: () => void;
  timeoutMs?: number;
}

/**
 * Стартовая синхронизация настроек экранов: закрывает пуш (reset), берёт
 * серверные uiPrefs и применяет их (sync) — только потом отдаёт true. Экраны
 * читают localStorage в инициализаторах состояния, поэтому до true их нельзя
 * монтировать. Сервер не ответил за timeoutMs — тоже true (кабинет не должен
 * висеть на медленной сети), но пуш остаётся закрытым, пока ответ не придёт и
 * не будет применён: неполный набор ключей не затрёт чужие. Отказ запроса —
 * true, пуш закрыт до следующей загрузки страницы.
 */
export function useUiPrefsStartupSync({
  load,
  sync,
  reset,
  timeoutMs = STARTUP_TIMEOUT_MS,
}: Deps): boolean {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let alive = true;
    reset();
    const timer = setTimeout(() => setSettled(true), timeoutMs);
    load()
      .then((s) => {
        if (alive) sync(s.uiPrefs);
      })
      .catch((e) => console.error('uiPrefs startup sync failed', e))
      .finally(() => {
        clearTimeout(timer);
        if (alive) setSettled(true);
      });
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // load/sync/reset — функции модуля (стабильные): эффект идёт один раз на вход в кабинет.
  }, [load, sync, reset, timeoutMs]);

  return settled;
}
