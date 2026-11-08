import { useEffect, useState } from 'react';

// Пауза перед «Отправить ещё раз» (U6, аудит 2026-11): после «Письмо
// отправлено» был только «Ввести другой email», и на «письмо не пришло»
// человек вводил тот же адрес заново. 60 секунд — письмо обычно успевает
// дойти, а серверный лимит ручки (STRICT_THROTTLE: 3 в минуту, 10 в час,
// src/auth/auth-throttles.ts) не срабатывает на честных повторах.
export const RESEND_PAUSE_S = 60;

/** `left` — сколько секунд ещё ждать (0 — можно); `start` — начать паузу. */
export function useResendPause(seconds = RESEND_PAUSE_S) {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  // От отметки времени, а не счётчиком тиков: фоновая вкладка тормозит таймеры.
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  useEffect(() => {
    if (until <= Date.now()) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= until) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [until]);
  const start = () => {
    const t = Date.now();
    setNow(t);
    setUntil(t + seconds * 1000);
  };
  return { left, start };
}
