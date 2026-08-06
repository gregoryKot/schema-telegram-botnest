// Сохранение проверки убеждения: localStorage сразу (офлайн-первое
// сохранение), переход на финальный экран/onComplete — только после
// подтверждения сервера. Раньше отказ api.createBeliefCheck() глотался
// (.catch(()=>{})), и «Готово» показывалось независимо от результата —
// та же денежная ошибка, что чинили в LetterToSelf/SafePlace.
import { useRef, useState } from 'react';
import { api } from '../../api';
import { STORAGE_KEY, BeliefEntry, loadLocal } from './storage';

interface SaveInput {
  belief: string;
  forList: string[];
  againstList: string[];
  reframe: string;
}

export function useSaveBeliefCheck(
  onSaved: () => void,
  onComplete?: () => void,
) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const savedEntryRef = useRef<BeliefEntry | null>(null);

  async function save(input: SaveInput) {
    if (saving) return;
    setSaving(true);
    setSaveError(false);
    // Повторный клик после отказа не должен плодить дубли в localStorage.
    if (!savedEntryRef.current) {
      const entry: BeliefEntry = {
        id: Date.now().toString(),
        date: new Date().toLocaleDateString('ru-RU', {
          day: 'numeric',
          month: 'long',
        }),
        belief: input.belief.trim(),
        for: input.forList,
        against: input.againstList,
        reframe: input.reframe.trim(),
      };
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([entry, ...loadLocal()].slice(0, 20)),
      );
      savedEntryRef.current = entry;
    }
    const entry = savedEntryRef.current;
    try {
      await api.createBeliefCheck({
        belief: entry.belief,
        evidenceFor: entry.for,
        evidenceAgainst: entry.against,
        reframe: entry.reframe || undefined,
      });
      onComplete?.();
      onSaved();
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return { saving, saveError, save };
}
