import { useEffect, useState } from 'react';
import { api } from '../../../api';
import { haptic } from '../../../haptic';
import { todayStr } from '../../../utils/format';
import { clearQuickDraft, loadQuickDraft, saveQuickDraft } from '../../../../../shared/src/utils/quickDraft';
import {
  appendGratitudeItem, modeEntryInput, quickSaveTag, schemaEntryInput, type QuickSaved, type QuickTag,
} from './quickEntryModel';
import { detectCrisisAny } from '../../../utils/crisisMarkers';
import { noteCrisisSeen } from '../../../../../shared/src/therapy/bridge/therapyBridgeState';
import { trackQuickSave } from './trackQuickSave';
import { isUnwritableError } from '../../../../../shared/src/api/unwritableError';

export type QuickStage = 'write' | 'schema' | 'mode' | 'done';
export type QuickError = 'failed' | 'gratitudeFull' | 'unreadable';

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
  // Что легло — лист «Записано» берёт вид по типу записи (и сцену из её данных).
  const [saved, setSaved] = useState<QuickSaved>({ tag: 'thought' });

  useEffect(() => { saveQuickDraft(text); }, [text]);

  const finish = (savedTag: QuickTag, detailed: boolean, data: Omit<QuickSaved, 'tag'> = {}) => {
    const hasCrisis = detectCrisisAny(text);
    setSaved({ tag: savedTag, ...data });
    setCrisis(hasCrisis);
    if (hasCrisis) noteCrisisSeen();
    clearQuickDraft();
    setText('');
    trackQuickSave(savedTag, detailed);
    setStage('done');
    onSaved?.();
  };

  const run = async (work: () => Promise<Omit<QuickSaved, 'tag'> | void>, savedTag: QuickTag = tag) => {
    if (saving || !text.trim()) return;
    setSaving(true);
    setError(null);
    haptic.success();
    try {
      const data = await work();
      finish(savedTag, false, data ?? {});
    } catch (e) {
      haptic.error();
      // 409 unreadable_data: прежние пункты дня не читаются — повтор не поможет, «проверь связь» соврёт.
      setError(e instanceof GratitudeFullError ? 'gratitudeFull' : isUnwritableError(e) ? 'unreadable' : 'failed');
      setStage('write');
    } finally {
      setSaving(false);
    }
  };

  // Чтение — ради лимита в пять пунктов; base даёт серверу слить день с пунктами другой вкладки.
  const saveGratitude = async () => {
    const date = todayStr();
    const base = (await api.getGratitudeDiary()).find((e) => e.date === date)?.items ?? [];
    const items = appendGratitudeItem(base, text);
    if (!items) throw new GratitudeFullError();
    await api.createGratitudeDiary(date, items, base);
    return { gratitudeCount: items.length };
  };

  const saveSchema = (ids: string[]) =>
    run(async () => { await api.createSchemaDiary(schemaEntryInput(text, ids)); }, quickSaveTag(tag, ids));
  const saveMode = (modeId: string) =>
    run(async () => { await api.createModeDiary(modeEntryInput(text, modeId)); return { modeId }; });

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
    text, setText, tag, setTag, stage, setStage, saving, error, setError, crisis, saved,
    submit, saveSchema, saveMode, finish, restart,
  };
}
