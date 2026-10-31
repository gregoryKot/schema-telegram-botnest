import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { UserTask } from '../apiTypes';
import { isVirtualId } from '../utils/sameId';

// Действия терапевта над заданием в карточке клиента — одна механика на сайт
// (ClientTasksTab) и мини-апп (TasksSheet), правило №3. QA 2026-10-26:
// задание нельзя было удалить ни в интерфейсе, ни в API, а задание
// офлайн-клиента — закрыть (выполнить его в приложении некому). Подтверждение
// удаления у площадок своё (диалог сайта, двойной тап мини-аппа), запросы и
// список — здесь. API приходит параметром — хук не знает, чей он фронтенд.

export interface TherapistTaskApi {
  deleteTherapyTask: (id: number) => Promise<unknown>;
  completeTask: (id: number, done: boolean) => Promise<unknown>;
}

/** Закрыть задание за клиента терапевт может только у офлайн-клиента. */
export const therapistClosesTask = (t: Pick<UserTask, 'userId' | 'done'>) =>
  t.done === null && isVirtualId(t.userId);

export function useTherapistTaskActions(
  api: TherapistTaskApi,
  setClientTasks: Dispatch<SetStateAction<UserTask[]>>,
) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const apiRef = useRef(api);
  apiRef.current = api;

  /** true — задание удалено и убрано из списка; сбой виден в `error`. */
  const remove = useCallback(
    async (id: number): Promise<boolean> => {
      setBusyId(id);
      setError('');
      try {
        await apiRef.current.deleteTherapyTask(id);
        setClientTasks((prev) => prev.filter((t) => t.id !== id));
        return true;
      } catch {
        setError('Не удалось удалить задание');
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [setClientTasks],
  );

  const markDone = useCallback(
    async (id: number): Promise<void> => {
      setBusyId(id);
      setError('');
      try {
        await apiRef.current.completeTask(id, true);
        const at = new Date().toISOString();
        setClientTasks((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, done: true, completedAt: at } : t,
          ),
        );
      } catch {
        setError('Не удалось отметить задание');
      } finally {
        setBusyId(null);
      }
    },
    [setClientTasks],
  );

  return { busyId, error, remove, markDone };
}
