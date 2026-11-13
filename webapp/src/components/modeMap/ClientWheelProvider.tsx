import { useMemo, type ReactNode } from 'react';
import type { ModeMapFull } from '../../api';
import { clientWheelLinks } from './clientWheelLinks';
import { WheelContext, type WheelState } from './wheelContext';

/** Карта клиента: сервер кладёт рядом оценки колеса; форму поля проверяет clientWheelLinks. */
export type ClientModeMap = ModeMapFull & { needRatings?: unknown };

const noop = () => {};

// Колесо клиента на его карте: только оценки и только чтение. Узел получает тот же
// контекст, что у терапевта (WheelProvider), поэтому разницы не знает.
export function ClientWheelProvider({ ratings, children }: { ratings: unknown; children: ReactNode }) {
  const value = useMemo<WheelState>(
    () => ({ links: clientWheelLinks(ratings), failed: false, status: 'idle', saved: true, save: noop, retry: noop }),
    [ratings],
  );
  return <WheelContext.Provider value={value}>{children}</WheelContext.Provider>;
}
