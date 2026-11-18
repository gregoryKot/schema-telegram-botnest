import { useEffect, useState } from 'react';
import { api, reportClientError, type TherapistCustomMode } from '../../api';
import { describeFailure } from '../../../../shared/src/api/describeFailure';

// 'failed' ≠ пустой список — сбой загрузки не равен «режимов нет».
export type CustomModesState = TherapistCustomMode[] | 'failed';

/** id своего режима в палитре карты и в пунктах «Что делали» — не пересекается с id справочника. */
export const customModeId = (m: Pick<TherapistCustomMode, 'id'>): string => `cm_${m.id}`;

export const isCustomModeId = (id: string): boolean => id.startsWith('cm_');

export function useCustomModes() {
  const [modes, setModes] = useState<CustomModesState>([]);
  useEffect(() => {
    api.listCustomModes().then(setModes).catch((e: unknown) => {
      setModes('failed');
      // Строка отказа в палитре — тупик: отчёт наверх (№14), в нём только статус или тип сбоя.
      reportClientError({ message: `custom modes load failed: ${describeFailure(e)}`, section: 'therapist.modeMap' });
    });
  }, []);
  return [modes, setModes] as const;
}
