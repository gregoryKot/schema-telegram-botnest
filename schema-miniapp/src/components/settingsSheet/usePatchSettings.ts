// patch() раньше показывало «Сохранено ✓» независимо от результата
// api.updateSettings — отказ сети выглядел как успех, а оптимистичный тумблер
// оставался в новом положении. Теперь отказ откатывает settings к прежнему
// значению и показывает видимую ошибку (см. webapp/SettingsSheet.tsx — та же
// правка, правило №3 CLAUDE.md).
import { useState, type Dispatch, type SetStateAction } from 'react';
import { api, UserSettings } from '../../api';

export function usePatchSettings(
  settings: UserSettings | null,
  setSettings: Dispatch<SetStateAction<UserSettings | null>>,
  onSaved: () => void,
) {
  const [saveError, setSaveError] = useState(false);

  async function patch(update: Partial<UserSettings>) {
    if (!settings) return;
    const prev = settings;
    setSettings((s) => (s ? { ...s, ...update } : s));
    try {
      await api.updateSettings(update);
      onSaved();
    } catch {
      setSettings(prev);
      setSaveError(true);
      setTimeout(() => setSaveError(false), 2400);
    }
  }

  return { patch, saveError };
}
