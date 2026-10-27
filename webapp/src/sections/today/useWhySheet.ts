import { useCallback, useState } from 'react';
import { isWhySeen, markWhySeen } from './whySeen';
import { trackHomeTile } from './trackHomeTile';

export type WhyMode = 'auto' | 'manual' | null;

/**
 * Лист «Зачем это всё». Сам открывается один раз новичку — когда экран готов
 * (профиль загружен, иначе лист мигнёт поверх скелетона) и в аккаунте ещё нет
 * ни оценок, ни записей; дальше — по кнопке «Зачем это?». Закрытие (любое)
 * ставит флаг, и автопоказ больше не повторяется.
 */
export function useWhySheet({ ready, hasHistory }: { ready: boolean; hasHistory: boolean }) {
  const [mode, setMode] = useState<WhyMode>(null);
  const [decided, setDecided] = useState(false);
  // Решение принимается один раз, в момент готовности: корректировка состояния в рендере.
  if (ready && !decided) {
    setDecided(true);
    if (!hasHistory && !isWhySeen()) setMode('auto');
  }
  const open = useCallback(() => { trackHomeTile('why'); setMode('manual'); }, []);
  const close = useCallback(() => { markWhySeen(); setMode(null); }, []);
  return { mode, open, close };
}
