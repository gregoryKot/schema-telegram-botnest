import { useState, useEffect, useRef } from 'react';

// Общая логика "интро-карточки" (ModeIntroSheet / SchemaIntroSheet):
// автосохранение ответов на вопросы-флэшкарты в localStorage + бэкенд.
// Вынесено по правилу №11 CLAUDE.md (jscpd-свип 2026-07) — было
// продублировано между режимами и схемами почти 1:1.
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
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    },
    [],
  );

  useEffect(() => {
    const fallbackToLocalStorage = () => {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          setData(JSON.parse(stored));
        } catch { /* best-effort: ошибку намеренно игнорируем */ }
      }
    };
    loadExisting()
      .then((note) => {
        if (note) setData(note);
        else fallbackToLocalStorage();
      })
      .catch(fallbackToLocalStorage);
  }, [storageKey]);

  function set(key: keyof T, value: string) {
    const next = { ...data, [key]: value };
    setData(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveNote(next).catch(() => {});
    }, 1500);
  }

  async function handleSave() {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    setSaving(true);
    localStorage.setItem(storageKey, JSON.stringify(data));
    try {
      await saveNote(data);
    } catch { /* best-effort: ошибку намеренно игнорируем */ }
    setSaving(false);
    setSaved(true);
    onComplete?.();
    setTimeout(() => setSaved(false), 1800);
  }

  const hasAny = Object.values(data).some((v) => v.trim().length > 0);

  return { data, set, handleSave, saving, saved, hasAny };
}
