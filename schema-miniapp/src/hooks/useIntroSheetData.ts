import { useState, useEffect, useRef } from 'react';
import { logErr } from '../utils/logErr';
import { loadIntroSheetData } from './introSheetLoad';

// Общая логика "интро-карточки" (ModeIntroSheet / SchemaIntroSheet) —
// автосохранение ответов в localStorage + бэкенд (правило №11 CLAUDE.md).
export interface UseIntroSheetDataArgs<T extends Record<string, string>> {
  storageKey: string;
  emptyData: T;
  loadExisting: () => Promise<T | null>;
  saveNote: (data: T) => Promise<unknown>;
  onComplete?: () => void;
}

export function useIntroSheetData<T extends Record<string, string>>({
  storageKey,
  emptyData,
  loadExisting,
  saveNote,
  onComplete,
}: UseIntroSheetDataArgs<T>) {
  const [data, setData] = useState<T>(emptyData);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    },
    [],
  );

  useEffect(() => {
    loadIntroSheetData<T>(storageKey, loadExisting)
      .then((note) => {
        if (note) setData(note);
      })
      // Сам загрузчик ошибки уже глотает и логирует; этот catch — на случай,
      // если упадёт localStorage (приватный режим). Без него no-floating-promises.
      .catch(logErr('loadIntroSheetData'));
  }, [storageKey]);

  function set(key: keyof T, value: string) {
    const next = { ...data, [key]: value };
    setData(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveNote(next).catch((e) => console.error('autosave failed', e));
    }, 1500);
  }

  async function handleSave(): Promise<boolean> {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    setSaving(true);
    localStorage.setItem(storageKey, JSON.stringify(data));
    try {
      await saveNote(data);
      setSaveError(false);
      setSaved(true);
      onComplete?.();
      setTimeout(() => setSaved(false), 1800);
      return true;
    } catch (e) {
      console.error('saveNote failed', e);
      setSaveError(true);
      return false;
    } finally {
      setSaving(false);
    }
  }

  const hasAny = Object.values(data).some((v) => v.trim().length > 0);

  return { data, set, handleSave, saving, saved, saveError, hasAny };
}
