// Сохранение одного списка «моих» (схем или режимов): оптимистичный локальный выбор + запись в фоне,
// отказ — у того блока, где выбор сделан, «Повторить» шлёт тот же список. Один трекер на список (ревью
// g5 r1): с общим трекером успех записи режимов стирал сбой схем, и список схем так и не доходил до
// сервера. Берут экран «Паттерны» (useSchemasData) и карточка схемы (SchemaDetailSheet).
import { useRef } from 'react';
import { reportClientError } from '../../api';
import { useSaveFailure } from '../../hooks/useSaveFailure';
import { isUnwritableError } from '../../../../shared/src/api/unwritableError';

/**
 * `send` — запись списка на сервер, `failMessage` — строка телеметрии отказа. `run(ids)` пишет список,
 * `retry()` — повтор последнего; `blocked` — 409 «прежний список не читается»: повтор не поможет.
 */
export function useListSave(send: (ids: string[]) => Promise<unknown>, failMessage: string) {
  const save = useSaveFailure();
  const last = useRef<string[] | null>(null);
  const run = (ids: string[]) => {
    last.current = ids;
    save.track(send(ids), () => reportClientError({ message: failMessage, section: 'schemas' }));
  };
  const retry = () => { if (last.current) run(last.current); };
  return { run, retry, failed: save.failed, blocked: save.failed && isUnwritableError(save.error) };
}
