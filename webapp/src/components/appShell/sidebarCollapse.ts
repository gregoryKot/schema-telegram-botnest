import { useSyncExternalStore } from 'react';
import { readLocal, removeLocal, writeLocal } from '../../../../shared/src/utils/safeLocalStorage';

// Свёрнутое боковое меню на компьютере: вместо колонки 240px — полоска с иконками
// (SidebarRail), освободившееся место забирает контент справа, в том числе холст
// «Графических карт». Меню общее у клиента и терапевта, состояние — одно. Удобство
// устройства (на ноутбуке свернул, на большом мониторе — нет), на сервер не уходит.
// Модуль — единственный писатель ключа (scripts/local-cache-baseline.json, kind local);
// чтение и запись — через safeLocalStorage (try/catch). Без хранилища (приватный режим)
// переключатель всё равно работает до перезагрузки: значение вкладки держит `current`.
// Соседние вкладки узнают о переключении из события storage.

export const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed';

const listeners = new Set<() => void>();
/** Значение, выбранное в этой вкладке; null — читать из хранилища. */
let current: boolean | null = null;

export function readSidebarCollapsed(): boolean {
  return current ?? readLocal(SIDEBAR_COLLAPSED_KEY) === '1';
}

export function setSidebarCollapsed(on: boolean): void {
  current = on;
  if (on) writeLocal(SIDEBAR_COLLAPSED_KEY, '1');
  else removeLocal(SIDEBAR_COLLAPSED_KEY);
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== SIDEBAR_COLLAPSED_KEY && e.key !== null) return;
    current = null; // правда — в хранилище: его поменяла другая вкладка
    notify();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(notify);
    window.removeEventListener('storage', onStorage);
  };
}

/** Свёрнуто ли боковое меню на этом устройстве; меняется сразу во всех местах и вкладках. */
export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(subscribe, readSidebarCollapsed, () => false);
}
