import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

// Удаление строки из списка-черновика с окном «Отменить» (frontend-ux, EviList
// в «Проверке убеждения»): крестик стирал доказательство одним тапом, а
// крестик на телефоне виден всегда и стоит рядом с текстом — промах пальцем
// означал перенабрать строку. Подтверждение вторым тапом (useConfirmTap)
// замедляет каждое намеренное удаление; окно отмены не мешает намеренному и
// спасает случайное. Строка уходит сразу, UNDO_WINDOW_MS можно вернуть её на
// прежнее место; новое удаление закрывает окно предыдущего. Таймер гасится на
// unmount (урок useTimedFlag: таймер после сноса jsdom ронял прогон vitest).
export const UNDO_WINDOW_MS = 5000;

export function useUndoRemove<T>(
  list: readonly T[],
  setList: Dispatch<SetStateAction<T[]>>,
  windowMs = UNDO_WINDOW_MS,
) {
  const [last, setLast] = useState<{ item: T; index: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const remove = (index: number) => {
    if (index < 0 || index >= list.length) return;
    const item = list[index];
    setList((l) => l.filter((_, j) => j !== index));
    clearTimeout(timer.current);
    setLast({ item, index });
    timer.current = setTimeout(() => setLast(null), windowMs);
  };

  const undo = () => {
    if (!last) return;
    clearTimeout(timer.current);
    const { item, index } = last;
    setList((l) => [...l.slice(0, index), item, ...l.slice(index)]);
    setLast(null);
  };

  return { canUndo: last !== null, remove, undo };
}
