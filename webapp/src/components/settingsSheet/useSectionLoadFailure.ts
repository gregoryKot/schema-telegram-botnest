import { useCallback, useState } from 'react';
import { reportClientError } from '../../api';
import { describeFailure } from '../../../../shared/src/api/describeFailure';

/**
 * Сбой загрузки раздела листа — отдельное состояние, а не «пусто» (иначе вместо статуса открылась
 * бы форма): `fail` — в `.catch` загрузчика, шлёт отчёт наверх (№14); `attempt` — в зависимости
 * эффекта загрузки, `retry` перечитывает. В отчёте только статус или тип сбоя (describeFailure).
 */
export function useSectionLoadFailure(what: string) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const fail = useCallback((e: unknown) => {
    setFailed(true);
    reportClientError({ message: `${what} load failed: ${describeFailure(e)}`, section: 'settings' });
  }, [what]);
  const retry = useCallback(() => { setFailed(false); setAttempt(n => n + 1); }, []);
  return { failed, attempt, fail, retry };
}
