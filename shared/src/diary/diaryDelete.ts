// Удаление записи дневника — одно на обе площадки (правило №3). QA клиента
// 2026-11, З2: при 500 «Удалить навсегда» молча ничего не делало (исключение
// уходило в консоль), а второй клик слал ещё один DELETE и ловил 404 тоже
// необработанным исключением.
import { useRef, useState } from 'react';
import {
  trackEntryDeleted,
  type EntryDeletedTracker,
} from '../analytics/trackEntryDeleted';

export type DiaryEntryType = 'schema' | 'mode' | 'gratitude';

/** Срез api площадки: удаление записей трёх дневников и событие удаления. */
export interface DiaryDeleteApi extends EntryDeletedTracker {
  deleteSchemaDiary(id: number): Promise<unknown>;
  deleteModeDiary(id: number): Promise<unknown>;
  deleteGratitudeDiary(id: number): Promise<unknown>;
}

const statusOf = (err: unknown): number | undefined =>
  typeof err === 'object' && err !== null && 'status' in err
    ? Number(err.status)
    : undefined;

/** Удаляет запись. 404 — записи уже нет (второй клик, другая вкладка): для
 *  человека это успех, но событие entry_deleted не шлётся — удалял не этот
 *  запрос. Любой другой сбой пробрасывается — экран говорит о нём, а запись
 *  остаётся в списке. */
export async function deleteDiaryEntry(
  api: DiaryDeleteApi,
  type: DiaryEntryType,
  id: number,
): Promise<void> {
  try {
    if (type === 'schema') await api.deleteSchemaDiary(id);
    else if (type === 'mode') await api.deleteModeDiary(id);
    else await api.deleteGratitudeDiary(id);
  } catch (err) {
    if (statusOf(err) !== 404) throw err;
    return;
  }
  trackEntryDeleted(api, 'diary');
}

export const deleteFailedText = (tr: (ty: string, vy: string) => string) =>
  tr(
    'Не удалось удалить — запись на месте. Проверь связь и попробуй ещё раз.',
    'Не удалось удалить — запись на месте. Проверьте связь и попробуйте ещё раз.',
  );

/** Состояние кнопки «Удалить навсегда»: пока запрос идёт, повторное нажатие
 *  ничего не шлёт (ref, а не state — два клика в одном такте видят одно
 *  значение); сбой — `failed`, запись остаётся. */
export function useDeleteAction(onDelete: () => void | Promise<void>) {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const run = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await onDelete();
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return { busy, failed, run };
}
