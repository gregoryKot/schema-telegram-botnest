// Одна механика — один хук (правило CLAUDE.md): три быстрые практики «Здесь
// и сейчас» (дыхание/заземление/«Стоп») читают и пишут свой счётчик
// прохождений через один общий хук, а не копипастят fetch-логику по экранам.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { QuickPracticeId } from '../../../shared/src/practices/quickPractices';

export interface UseQuickPracticeResult {
  /** Сколько раз пройдена ИМЕННО эта практика. null — ещё грузится/неизвестно
   * (GET упал) — намеренно не 0, чтобы не показать выдуманную цифру (правило
   * «никаких хардкод-заглушек вместо реальных данных»). */
  count: number | null;
  /** Записать прохождение (fire-and-forget); count обновляется значением ИЗ
   * ОТВЕТА сервера (read-after-write), не локальным +1. */
  complete: () => void;
  /** Прохождение в рамках этого открытия практики уже записано. */
  completed: boolean;
}

export function useQuickPractice(id: QuickPracticeId): UseQuickPracticeResult {
  const [count, setCount] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  // Флаг «запрос уже в пути или уже удался» — защита от повторной отправки
  // при повторных вызовах complete() в рамках одного открытия практики.
  const sentRef = useRef(false);

  useEffect(() => {
    let ignore = false;
    api
      .getPracticeSessions()
      .then((counts) => {
        if (!ignore) setCount(counts[id]);
      })
      .catch((e) => console.error('getPracticeSessions failed', e)); // count = null, не 0
    return () => {
      ignore = true;
    };
  }, [id]);

  const complete = useCallback(() => {
    if (sentRef.current) return;
    sentRef.current = true;
    api
      .recordPracticeSession(id)
      .then((res) => {
        setCount(res.count); // read-after-write: берём число из ответа
        setCompleted(true);
      })
      .catch(() => {
        // Запись не критична — глушим молча, но НЕ выставляем completed:
        // пользователь сможет доделать позже (и повторный вызов сработает,
        // раз sentRef сброшен).
        sentRef.current = false;
      });
  }, [id]);

  return { count, complete, completed };
}
