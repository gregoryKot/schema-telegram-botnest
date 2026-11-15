import { useRef, useState } from 'react';
import { api, reportClientError, type UserTask, type UserId } from '../../api';
import { describeFailure } from '../../../../shared/src/api/describeFailure';

export type BoardTasks = { clientId: UserId; clientName: string; tasks: UserTask[] }[];

// Доска «Задания» кабинета (все клиенты разом). Лист кабинета не
// перемонтируется, когда терапевт уходит в карточку клиента и возвращается, а
// доска грузилась один раз — первым кликом по вкладке. Задание, назначенное,
// отмеченное или удалённое в карточке, на доске не появлялось до перезагрузки
// страницы (QA 2026-11). Теперь любое изменение заданий зовёт invalidate():
// доска, которую уже открывали, перечитывается сразу, пока терапевт в карточке.
// Ответ, ушедший до изменения, доску не перезапишет (generation).
// Сбой ≠ пусто: отказ запроса — `failed`, а не пустая доска, и отчёт наверх (№14).
export function useTasksBoard(fetchAll: () => Promise<BoardTasks> = api.getAllTherapyTasks) {
  const [tasks, setTasks] = useState<BoardTasks | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  const opened = useRef(false);

  function load() {
    opened.current = true;
    const mine = ++generation.current;
    const current = () => mine === generation.current;
    setFailed(false);
    setLoading(true);
    fetchAll()
      .then(r => { if (current()) setTasks(r); })
      .catch((e: unknown) => {
        if (!current()) return; // устаревший отказ: доску перечитывает свежий запрос
        setFailed(true);
        reportClientError({ message: `tasks board load failed: ${describeFailure(e)}`, section: 'therapist.tasks' });
      })
      .finally(() => { if (current()) setLoading(false); });
  }

  /** Клик по вкладке «Задания»: грузим, если доски ещё нет. */
  function open() {
    if (tasks === null && !loading) load();
  }

  /** Задания изменились в карточке клиента: открытая хоть раз доска — заново. */
  function invalidate() {
    if (opened.current) load();
  }

  return { tasks, loading, failed, load, open, invalidate };
}

export type TasksBoard = ReturnType<typeof useTasksBoard>;
