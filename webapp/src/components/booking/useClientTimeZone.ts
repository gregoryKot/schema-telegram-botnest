import { useState } from 'react';
import { resolveClientTimeZone } from '../../../../shared/src/booking/clientTimeZone';
import { isValidTimeZone } from '../../../../shared/src/utils/timeZoneNames';
import { readLocal, writeLocal } from '../../../../shared/src/utils/safeLocalStorage';
import { BOOKING_TIME_ZONE_KEY } from '../../../../shared/src/utils/storageKeys';

/**
 * Часовой пояс, в котором показываются слоты записи. Автоопределение при
 * первом рендере (lazy-init state, не useEffect) — ручной выбор из
 * TimeZonePicker переопределяет его и запоминается в localStorage.
 */
export function useClientTimeZone(): [string, (tz: string) => void] {
  const [tz, setTzState] = useState<string>(() => {
    const saved = readLocal(BOOKING_TIME_ZONE_KEY);
    if (saved && isValidTimeZone(saved)) return saved;
    return resolveClientTimeZone();
  });

  const setTz = (next: string) => {
    if (!isValidTimeZone(next)) return;
    setTzState(next);
    writeLocal(BOOKING_TIME_ZONE_KEY, next);
  };

  return [tz, setTz];
}
