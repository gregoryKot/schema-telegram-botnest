import { useCallback, useEffect, useState } from 'react';
import { api, reportClientError } from '../../api';
import type { UserTask } from '../../api';

// Загрузка + мутации «Практик на сегодня». Раньше completeTask/refetch после
// создания задания глотали сбой молча: пользователь заканчивал упражнение
// или создавал цель, экран закрывался, а на сервере ничего не менялось —
// список выглядел так, будто действие прошло. Фоновая начальная загрузка
// (mount/refreshKey) экран не роняет и баннер не показывает (см.
// TodaySection.test.tsx — «ошибки API не роняют экран»), но и не молчит
// полностью: сбой уходит в reportClientError, чтобы он был виден в логах,
// а не терялся навсегда. Действие, которое юзер только что выполнил сам
// (completeTask/afterCreate) — обязано сказать явно, через taskError.
export function useTaskActions(refreshKey: number | undefined) {
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [taskHistory, setTaskHistory] = useState<UserTask[]>([]);
  const [taskError, setTaskError] = useState(false);

  const load = useCallback(
    () => Promise.all([api.getTasks(), api.getTaskHistory()]).then(([t, h]) => {
      setTasks(t);
      setTaskHistory(h);
    }),
    [],
  );

  useEffect(() => {
    load().catch(() => reportClientError({ message: 'today tasks background load failed', section: 'today.tasks' }));
  }, [refreshKey, load]);

  const completeTask = useCallback(
    (id: number, onDone?: () => void) => {
      setTaskError(false);
      return api.completeTask(id, true)
        .then(load)
        .then(() => onDone?.())
        .catch(() => setTaskError(true));
    },
    [load],
  );

  const afterCreate = useCallback(
    (onDone?: () => void) => {
      setTaskError(false);
      return load().then(() => onDone?.()).catch(() => setTaskError(true));
    },
    [load],
  );

  return { tasks, taskHistory, taskError, completeTask, afterCreate };
}
