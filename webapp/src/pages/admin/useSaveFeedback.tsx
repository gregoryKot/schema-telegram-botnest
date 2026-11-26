import { useState, useEffect, useRef } from 'react';

interface Texts {
  /** Подпись успеха (зелёная, гаснет через 1.5 с). */
  saved?: string;
  /** Запасной текст, если упало не Error. */
  fail?: string;
  /** Если задан (здесь или вторым аргументом guard) — ошибка сервера
   *  показывается как «<префикс>: <сообщение>»: голое «Cannot cancel completed
   *  session» без пояснения, что не удалось, читается как мусор. */
  failPrefix?: string;
}

// Сохранить + показать успех/ошибку (было без try/catch — провал молча тонул).
// Вынесено из BookingSection.tsx (правило №10) и параметризовано: цены и
// записи показывают свои тексты через один механизм (правило «одна механика —
// один компонент»).
export function useSaveFeedback({
  saved: savedText = 'Цена сохранена ✓',
  fail = 'Не удалось сохранить цену',
  failPrefix,
}: Texts = {}) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Таймер сброса «✓» чистится при анмаунте: без этого setState стрелял по
  // снятому компоненту (в CI это роняло vitest: «window is not defined»).
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const guard = async (fn: () => Promise<void>, prefix = failPrefix) => {
    setError(null);
    try {
      await fn(); setSaved(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 1500);
    }
    catch (e) {
      setSaved(false);
      setError(e instanceof Error ? (prefix ? `${prefix}: ${e.message}` : e.message) : fail);
    }
  };
  const feedback = error
    ? <p role="alert" style={{ fontSize: 13, color: 'var(--accent-red)', margin: '8px 0 0' }}>{error}</p>
    : saved ? <p style={{ fontSize: 13, color: 'var(--accent-green)', margin: '8px 0 0' }}>{savedText}</p> : null;
  return { guard, feedback };
}
