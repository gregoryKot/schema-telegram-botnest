import { useCallback, useEffect, useRef, useState } from 'react';
import { api, reportClientError, type TherapyClientSummary, type UserId, type UserTask } from '../../api';
import { describeFailure } from '../../../../shared/src/api/describeFailure';
import { taskDigest, type TaskDigest } from '../../../../shared/src/tasks/taskDigest';
import { todayStr } from '../../utils/format';

type AllTasks = { clientId: UserId; tasks: UserTask[] }[];

// Задания всех клиентов терапевта одним запросом — для сводок на «Сегодня» и в списке
// клиентов. Сводка вторична: пока не загрузилась или запрос упал, её просто нет
// (отказ уходит отчётом наверх, №14). Ответ, ушедший до invalidate(), не перезапишет свежий.
export function useClientTaskDigests(fetchAll: () => Promise<AllTasks> = api.getAllTherapyTasks) {
  const [byClient, setByClient] = useState<ReadonlyMap<string, UserTask[]>>(new Map());
  const generation = useRef(0);

  const load = useCallback(() => {
    const mine = ++generation.current;
    fetchAll()
      .then(r => { if (mine === generation.current) setByClient(new Map(r.map(g => [String(g.clientId), g.tasks]))); })
      .catch((e: unknown) => {
        reportClientError({ message: `client task digests load failed: ${describeFailure(e)}`, section: 'therapist.tasks' });
      });
  }, [fetchAll]);
  useEffect(load, [load]);

  /** Сводка клиента; заданий нет или они не загрузились — null. */
  const digestOf = useCallback((c: TherapyClientSummary): TaskDigest | null => {
    const tasks = byClient.get(String(c.telegramId));
    return tasks && tasks.length > 0 ? taskDigest(tasks, c, todayStr()) : null;
  }, [byClient]);

  return { digestOf, invalidate: load };
}

export type ClientTaskDigests = ReturnType<typeof useClientTaskDigests>;
