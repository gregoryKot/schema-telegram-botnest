import { useEffect, useRef, useState } from 'react';

/**
 * Множественный выбор, который сохраняется сам (инцидент 2026-08: «Мои режимы»).
 *
 * Экран выбора — список из 35 режимов с кнопкой «Сохранить» в самом низу.
 * Пользователь отмечал своё, закрывал шит свайпом (или тапом мимо) — и выбор
 * молча пропадал: сохранение требовало долистать до конца. Само действие
 * пользователя (отметил режим) и есть решение, отдельного «подтверждаю» ему
 * не нужно.
 *
 * Хук держит выбор и сам зовёт save с дебаунсом; всё, что не успело улететь,
 * долетает при размонтировании (закрыл шит — сохранено). Общий для обоих
 * фронтендов (правило №3 CLAUDE.md) — механика одна, вёрстка у экранов разная.
 */
const SAVE_DELAY_MS = 600;

export function useAutosavedSelection(
  initial: string[],
  save: (ids: string[]) => void,
  delayMs: number = SAVE_DELAY_MS,
) {
  const [ids, setIds] = useState<string[]>(initial);
  const current = useRef<string[]>(initial);
  const pending = useRef<string[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // save может пересоздаваться на каждый рендер родителя — держим свежую
  // ссылку, чтобы дебаунс не зависел от идентичности функции.
  const saveRef = useRef(save);
  saveRef.current = save;

  /** Отправить накопленное немедленно (кнопка «Готово», закрытие экрана). */
  const flush = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const next = pending.current;
    pending.current = null;
    if (next) saveRef.current(next);
  };

  // Размонтирование — последний шанс: закрытие свайпом не должно терять выбор.
  useEffect(() => flush, []);

  const toggle = (id: string) => {
    const prev = current.current;
    const next = prev.includes(id)
      ? prev.filter((x) => x !== id)
      : [...prev, id];
    current.current = next;
    pending.current = next;
    setIds(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, delayMs);
  };

  return { ids, toggle, flush };
}
