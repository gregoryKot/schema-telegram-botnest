// Телефонная раскладка кабинета (≤767px, граница та же, что у CSS-медиазапросов
// кабинета). Нужна там, где на телефоне порядок и состав блоков другой, чем на
// десктопе, и одним CSS его не собрать (дыхание первым, кризисная строка
// раскрывается на месте). Без matchMedia (SSR, jsdom) — десктопная раскладка.
import { useSyncExternalStore } from 'react';

export const PHONE_QUERY = '(max-width: 767px)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const mql = window.matchMedia(PHONE_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(PHONE_QUERY).matches;
}

export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
