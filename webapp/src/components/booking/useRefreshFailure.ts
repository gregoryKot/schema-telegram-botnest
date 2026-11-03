import { useCallback, useRef, useState } from 'react';
import { reportClientError } from '../../api';
import { failureDetail } from '../failureDetail';

/**
 * Отказ повторной проверки брони, когда она уже на экране (опрос HELD,
 * «Проверить ещё раз»). Бронь не стирается, но и молчать нельзя (правило №14,
 * аудит 2026-10): `refreshFailed` рисует строку на экране до следующего
 * удачного ответа, наверх уходит один отчёт за жизнь страницы — опрос каждые
 * 5 с иначе засыпал бы отчётами. Токена в сообщении нет.
 */
export function useRefreshFailure() {
  const [refreshFailed, setRefreshFailed] = useState(false);
  const reported = useRef(false);

  const fail = useCallback((err: unknown) => {
    setRefreshFailed(true);
    if (reported.current) return;
    reported.current = true;
    reportClientError({ message: `booking paid page: не удалось обновить показанную бронь по токену: ${failureDetail(err)}`, section: 'booking' });
  }, []);
  const clear = useCallback(() => setRefreshFailed(false), []);

  return { refreshFailed, fail, clear };
}
