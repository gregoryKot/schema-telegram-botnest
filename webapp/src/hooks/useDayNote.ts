import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

// Заметка дня `date` с сервера — одна загрузка на лист заметки и «Историю»
// (правило №3). Аудит 2026-11, E7/E8: ответ без флага `alive` приходил после
// смены дня и показывал под ним заметку другого дня, а сбой загрузки выглядел
// как пустая заметка — сохранение пустой формы перетирало настоящую.

export type DayNote = { text: string | null; tags: string[] };
export type DayNoteStatus = 'loading' | 'ready' | 'error';
type Answer = { date: string; attempt: number; status: 'ready' | 'error'; note: DayNote | null };

export function useDayNote(date: string | undefined) {
  const [attempt, setAttempt] = useState(0);
  const [answer, setAnswer] = useState<Answer | null>(null);

  useEffect(() => {
    if (!date) return;
    let alive = true;
    api.getNote(date).then(
      (r) => { if (alive) setAnswer({ date, attempt, status: 'ready', note: { text: r.text ?? null, tags: r.tags ?? [] } }); },
      // Сбой перезагрузки того же дня держит прежний текст, а не «пусто».
      () => { if (alive) setAnswer((a) => ({ date, attempt, status: 'error', note: a?.date === date ? a.note : null })); },
    );
    return () => { alive = false; };
  }, [date, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  // Ответ другого дня не показывается под этим; ждём свежий — статус «загрузка».
  const mine = answer && answer.date === date ? answer : null;
  const status: DayNoteStatus = mine && mine.attempt === attempt ? mine.status : 'loading';
  return { status, note: mine ? mine.note : null, reload };
}
