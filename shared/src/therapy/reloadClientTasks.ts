import type { UserTask } from '../apiTypes';
import type { UserId } from '../userId';
import { reloadKeepingShown } from '../utils/reloadKeepingShown';

/**
 * Задание назначено (TaskCreateSheet) — перечитать задания ЭТОГО клиента.
 * Ответ, пришедший после перехода к другому клиенту, его список не трогает:
 * иначе у второго клиента показались бы задания первого (инцидент 2026-10-26,
 * docs/INCIDENTS.md, класс 18). Сбой перечитывания показанное не стирает.
 */
export function reloadClientTasks(
  clientId: UserId,
  isOpen: (id: UserId) => boolean,
  fetchTasks: (clientId: UserId) => Promise<UserTask[]>,
  show: (tasks: UserTask[]) => void,
): void {
  void reloadKeepingShown(
    () => fetchTasks(clientId),
    (tasks) => {
      if (isOpen(clientId)) show(tasks);
    },
  );
}
