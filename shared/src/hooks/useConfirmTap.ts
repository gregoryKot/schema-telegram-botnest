import { useCallback, useEffect, useRef, useState } from 'react';

// Двухтапное подтверждение для необратимых действий над строкой списка
// (удаление). Первый тап переводит строку в состояние «подтвердите» на
// CONFIRM_MS, второй тап (по той же строке, в это окно) вызывает action.
// Тап по другой строке или таймаут сбрасывают состояние без вызова action.
//
// Общий хук (правило №3 / «одна механика — один компонент»): дизайн-аудит
// 2026-08 (К3) нашёл голое удаление без подтверждения в PracticesList —
// хитбокс 30×30 и один тап стирали практику безвозвратно. Переехал в shared,
// когда та же механика понадобилась в JourneyDeleteButton «Моего пути».
// Потребители: schema-miniapp/src/components/PracticesList.tsx (через тонкий
// ре-экспорт schema-miniapp/src/hooks/useConfirmTap.ts) и
// shared/src/journey/JourneyDeleteButton.tsx.

const CONFIRM_MS = 3000;

export function useConfirmTap<T>(
  action: (id: T) => void,
  timeoutMs = CONFIRM_MS,
) {
  const [pendingId, setPendingId] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  // Размонтировали список посреди окна подтверждения — таймер не должен
  // стрелять в setState уже ушедшего компонента.
  useEffect(() => clearTimer, [clearTimer]);

  const tap = useCallback(
    (id: T) => {
      setPendingId((current) => {
        if (current === id) {
          clearTimer();
          action(id);
          return null;
        }
        clearTimer();
        timer.current = setTimeout(() => setPendingId(null), timeoutMs);
        return id;
      });
    },
    [action, clearTimer, timeoutMs],
  );

  const isPending = useCallback((id: T) => pendingId === id, [pendingId]);

  return { tap, isPending };
}
