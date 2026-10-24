import { useCallback, useEffect, useRef, useState } from 'react';

// Автосохранение множественного выбора (карточки схем/режимов, любой
// «отметь несколько и закрой» список). Раньше выбор уходил на сервер только
// по явному тапу на кнопку «Сохранить» внизу списка — длинный список,
// закрытый свайпом/крестиком до кнопки, терял отметки (жалоба пользователя,
// закрытый PR #237: отметка карточки и есть решение, отдельное
// подтверждение не нужно).
//
// Тот же приём, что в webapp/src/components/useModeMapAutosave.ts: «взведён
// таймер» = есть несохранённые изменения. toggle перезапускает дебаунс;
// сработавший таймер сам себя гасит (timer.current = null) — unmount после
// этого НЕ шлёт дубль. Не трогали (toggle ни разу не звали) — таймер не
// взведён, unmount ничего не шлёт.
const DEBOUNCE_MS = 600;

export function useAutosavedSelection(
  initial: string[],
  onSave: (ids: string[]) => void,
  debounceMs = DEBOUNCE_MS,
) {
  const [ids, setIds] = useState<string[]>(initial);
  const idsRef = useRef(ids);
  idsRef.current = ids;
  // onSave может быть новым замыканием на каждый рендер родителя — таймер
  // всегда должен звать САМЫЙ СВЕЖИЙ onSave, а не тот, что был на момент
  // scheduleSave.
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Немедленно досылает несохранённое, если таймер ещё взведён. Идемпотентно:
  // повторный вызов при уже погашенном таймере — no-op (не дублирует save).
  const flush = useCallback(() => {
    if (!timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    onSaveRef.current(idsRef.current);
  }, []);

  const toggle = useCallback(
    (id: string) => {
      setIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      );
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null; // сработал — больше не «взведён» для flush()
        onSaveRef.current(idsRef.current);
      }, debounceMs);
    },
    [debounceMs],
  );

  // Закрытие шита любым способом (крестик, свайп, «Назад», системная кнопка
  // браузера) размонтирует компонент — cleanup досылает несохранённое.
  useEffect(() => flush, [flush]);

  return { ids, toggle, flush };
}
