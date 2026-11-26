import { useSyncExternalStore } from 'react';
import { heatWeeksForWidth, HEAT_WEEKS } from './profileModel';

function subscribe(cb: () => void) {
  window.addEventListener('resize', cb);
  return () => window.removeEventListener('resize', cb);
}

/** Число недель тепловой карты по ширине окна; снимок — число, поэтому перерисовка только при смене. */
export function useHeatWeeks(): number {
  return useSyncExternalStore(
    subscribe,
    () => heatWeeksForWidth(window.innerWidth),
    () => HEAT_WEEKS,
  );
}
