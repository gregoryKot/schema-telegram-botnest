import { useLayoutEffect, useSyncExternalStore } from 'react';

// Силуэт первой загрузки кабинета (AppShellSkeleton) — не лист: скролл он не
// держит и в реестр листов (openSheets) не идёт, но баннер куки ждёт и его.
// Модального слоя («ты/вы») ещё нет, и баннер мелькал у новичка до вопроса
// (QA 2026-11). Публичных страниц это не касается — силуэт рисует только
// AppShell. useLayoutEffect — чтобы баннер спрятался до отрисовки кадра.

let mounted = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
};

/** Зовёт силуэт кабинета: пока он смонтирован, useShellLoading() === true. */
export function useMarkShellLoading(): void {
  useLayoutEffect(() => {
    mounted += 1;
    emit();
    return () => {
      mounted -= 1;
      emit();
    };
  }, []);
}

export function useShellLoading(): boolean {
  return useSyncExternalStore(subscribe, () => mounted > 0, () => false);
}
