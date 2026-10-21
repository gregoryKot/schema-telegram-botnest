import { useSyncExternalStore } from 'react';

// Реестр открытых листов и экранов-оверлеев. Каждый лист обязан звать
// useHistorySheet (гейт check-history-sheet), а тот отмечается здесь, поэтому
// «открыт ли хоть один лист» известно без списка компонентов: плавающая «+»
// прячется по этому признаку одним механизмом.

const open = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Отметить лист открытым; возвращает снятие отметки (cleanup эффекта). */
export function markSheetOpen(id: string): () => void {
  open.add(id);
  emit();
  return () => {
    open.delete(id);
    emit();
  };
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
};

export function useAnySheetOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open.size > 0, () => false);
}
