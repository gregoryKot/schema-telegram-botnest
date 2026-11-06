import { useSyncExternalStore } from 'react';

// Режим «Показ экрана» в кабинете терапевта: пока он включён, сайдбар и «Перейти к…»
// не показывают имена клиентов — терапевт делится экраном с клиентом на сессии, и тот
// не должен видеть, кто ещё ходит к этому терапевту. Удобство устройства (показывают
// экран с конкретного компьютера), на сервер не уходит. Модуль — единственный писатель
// ключа (scripts/local-cache-baseline.json, kind local); остальные зовут setScreenShare.
// Соседние вкладки узнают о переключении из события storage.

export const SCREEN_SHARE_KEY = 'cabinet_screen_share';

const listeners = new Set<() => void>();

export function readScreenShare(): boolean {
  return localStorage.getItem(SCREEN_SHARE_KEY) === '1';
}

export function setScreenShare(on: boolean): void {
  if (on) localStorage.setItem(SCREEN_SHARE_KEY, '1');
  else localStorage.removeItem(SCREEN_SHARE_KEY);
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  const onStorage = (e: StorageEvent) => { if (e.key === SCREEN_SHARE_KEY || e.key === null) notify(); };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(notify);
    window.removeEventListener('storage', onStorage);
  };
}

/** Включён ли «Показ экрана» на этом устройстве; меняется сразу во всех местах и вкладках. */
export function useScreenShare(): boolean {
  return useSyncExternalStore(subscribe, readScreenShare, () => false);
}
