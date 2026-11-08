import { useEffect, useState } from 'react';
import { api, reportClientError, type UserTask } from '../../api';
import { useTasksChanged } from '../../../../shared/src/tasks/tasksChanged';
import { readLocal, writeLocal } from '../../../../shared/src/utils/safeLocalStorage';

// Новые задания терапевта — счётчик на строке «Задания» в «Ещё» и точка на
// пункте «Ещё» в навигации (аудит 2026-11, U2): уведомление о задании вело на
// «Сегодня», где заданий нет, и узнать о новом было неоткуда. Признака
// «клиент открывал задание» на сервере нет, поэтому «новое» = от терапевта, не
// выполнено и назначено позже отметки. Отметка — самое позднее время
// назначения среди заданий, которые человек видел в «Заданиях»: время сервера,
// а не часы телефона, — убежавшие часы не прячут свежее задание.

export const TASKS_SEEN_KEY = 'tasks_seen_at';
const SEEN_EVENT = 'tasks-seen';

const time = (iso: string | null | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? -Infinity : t;
};

/** Сколько заданий терапевта ещё не видели: не выполнены и назначены после отметки. */
export function countNewTasks(tasks: readonly UserTask[], seenAt: string | null): number {
  const seen = time(seenAt);
  return tasks.filter(t => t.assignedBy !== null && !t.done && time(t.createdAt) > seen).length;
}

/** «Задания» открыты: всё назначенное до сих пор — просмотрено. */
export function markTasksSeen(tasks: readonly UserTask[]): void {
  const latest = tasks.filter(t => t.assignedBy !== null).reduce((m, t) => Math.max(m, time(t.createdAt)), -Infinity);
  if (latest <= time(readLocal(TASKS_SEEN_KEY))) return;
  writeLocal(TASKS_SEEN_KEY, new Date(latest).toISOString());
  window.dispatchEvent(new Event(SEEN_EVENT));
}

/** Число новых заданий; `enabled: false` — не грузить (кабинет терапевта). */
export function useNewTasksCount(enabled = true): number {
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [seenAt, setSeenAt] = useState(() => readLocal(TASKS_SEEN_KEY));
  const [reloadKey, setReloadKey] = useState(0);
  useTasksChanged(() => setReloadKey(k => k + 1));
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    api.getTasks()
      .then(t => { if (alive) setTasks(Array.isArray(t) ? t : []); })
      .catch(() => reportClientError({ message: 'new tasks count load failed', section: 'more.tasks' }));
    return () => { alive = false; };
  }, [enabled, reloadKey]);
  useEffect(() => {
    const onSeen = () => setSeenAt(readLocal(TASKS_SEEN_KEY));
    window.addEventListener(SEEN_EVENT, onSeen);
    return () => window.removeEventListener(SEEN_EVENT, onSeen);
  }, []);
  return enabled ? countNewTasks(tasks, seenAt) : 0;
}
