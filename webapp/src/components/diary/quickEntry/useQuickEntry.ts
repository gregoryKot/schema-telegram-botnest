import { useEffect, useState } from 'react';
import { api } from '../../../api';
import { haptic } from '../../../haptic';
import { todayStr } from '../../../utils/format';
import { clearQuickDraft, loadQuickDraft, saveQuickDraft } from '../../../../../shared/src/utils/quickDraft';
import {
  appendGratitudeItem, modeEntryInput, quickSaveTag, schemaEntryInput, type QuickTag,
} from './quickEntryModel';
import { detectCrisisAny } from '../../../utils/crisisMarkers';
import { trackQuickSave } from './trackQuickSave';

export type QuickStage = 'write' | 'schema' | 'mode' | 'done';
export type QuickError = 'failed' | 'gratitudeFull';

class GratitudeFullError extends Error {}

/**
 * Состояние «Дневника одной страницей»: текст (черновик в localStorage), тег, экран и сохранение.
 * Отказ не закрывает лист и возвращает на первый экран с текстом: иначе он неотличим от успеха.
 */
export function useQuickEntry(onSaved?: () => void) {
  const [text, setText] = useState(loadQuickDraft);
  const [tag, setTag] = useState<QuickTag>('thought');
  const [stage, setStage] = useState<QuickStage>('write');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<QuickError | null>(null);
  // Кризисный текст виден и после очистки поля: карточка остаётся на экране «Записано».
  const [crisis, setCrisis] = useState(false);

  useEffect(() => { saveQuickDraft(text); }, [text]);

  const finish = (savedTag: QuickTag, detailed: boolean) => {
    setCrisis(detectCrisisAny(text));
    clearQuickDraft();
    setText('');
    trackQuickSave(savedTag, detailed);
    setStage('done');
    onSaved?.();
  };

  const run = async (work: () => Promise<unknown>, savedTag: QuickTag = tag) => {
    if (saving || !text.trim()) return;
    setSaving(true);
    setError(null);
    haptic.success();
    try {
      await work();
      finish(savedTag, false);
    } catch (e) {
      haptic.error();
      setError(e instanceof GratitudeFullError ? 'gratitudeFull' : 'failed');
      setStage('write');
    } finally {
      setSaving(false);
    }
  };

  // Сервер заменяет пункты дня целиком: сначала читаем сегодняшние, потом дописываем.
  const saveGratitude = async () => {
    const date = todayStr();
    const entries = await api.getGratitudeDiary();
    const items = appendGratitudeItem(entries.find((e) => e.date === date)?.items ?? [], text);
    if (!items) throw new GratitudeFullError();
    await api.createGratitudeDiary(date, items);
  };

  const saveSchema = (ids: string[]) => run(() => api.createSchemaDiary(schemaEntryInput(text, ids)), quickSaveTag(tag, ids));
  const saveMode = (modeId: string) => run(() => api.createModeDiary(modeEntryInput(text, modeId)));

  /** «Сохранить» на первом экране: мысль и благодарность уходят сразу, схема и режим — на второй экран. */
  const submit = () => {
    if (!text.trim()) return;
    haptic.tap();
    if (tag === 'schema' || tag === 'mode') { setError(null); setStage(tag); }
    else if (tag === 'gratitude') void run(saveGratitude);
    else void saveSchema([]);
  };

  const restart = () => { setTag('thought'); setError(null); setStage('write'); };

  return {
    text, setText, tag, setTag, stage, setStage, saving, error, setError, crisis,
    submit, saveSchema, saveMode, finish, restart,
  };
}
