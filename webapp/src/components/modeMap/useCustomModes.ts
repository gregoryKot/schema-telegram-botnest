import { useEffect, useState } from 'react';
import { api, type TherapistCustomMode } from '../../api';

// 'failed' ≠ пустой список — сбой загрузки не равен «режимов нет».
export type CustomModesState = TherapistCustomMode[] | 'failed';

export function useCustomModes() {
  const [modes, setModes] = useState<CustomModesState>([]);
  useEffect(() => {
    api.listCustomModes().then(setModes).catch(() => setModes('failed'));
  }, []);
  return [modes, setModes] as const;
}
