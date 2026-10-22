// patch() раньше показывало «Сохранено ✓» независимо от результата
// api.updateSettings — отказ сети выглядел как успех, а оптимистичный тумблер
// оставался в новом положении. Теперь отказ откатывает settings к прежнему
// значению и показывает видимую ошибку (см. webapp/SettingsSheet.tsx — та же
// правка, правило №3 CLAUDE.md).
import type { Dispatch, SetStateAction } from 'react';
import { useTimedFlag } from '../../../../shared/src/hooks/useTimedFlag';
import { api, UserSettings } from '../../api';

export function usePatchSettings(
  settings: UserSettings | null,
  setSettings: Dispatch<SetStateAction<UserSettings | null>>,
  onSaved: () => void,
) {
  const [saveError, flashSaveError] = useTimedFlag(2400);

  async function patch(update: Partial<UserSettings>) {
    if (!settings) return;
    const prev = settings;
    setSettings((s) => (s ? { ...s, ...update } : s));
    try {
      await api.updateSettings(update);
      onSaved();
    } catch {
      setSettings(prev);
      flashSaveError();
    }
  }

  return { patch, saveError };
}
