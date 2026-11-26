// Флаг, который сам гаснет через ms (тост «Сохранено ✓», плашка ошибки).
// Родился из красного CI (run 36409902702): голый
// `setX(true); setTimeout(() => setX(false), 1800)` не чистился при
// размонтировании, таймер стрелял после сноса jsdom и ронял весь прогон
// vitest «ReferenceError: window is not defined», хотя все тесты прошли.
// Хук хранит id таймера, перезапускает его при повторном flash() и гасит
// на unmount.
import { useCallback, useEffect, useRef, useState } from 'react';

export function useTimedFlag(ms: number): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const flash = useCallback(() => {
    clearTimeout(timerRef.current);
    setOn(true);
    timerRef.current = setTimeout(() => setOn(false), ms);
  }, [ms]);

  return [on, flash];
}
