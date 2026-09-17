// Состояние карточки прошлого разбора (тап по строке в «Прошлые разборы») —
// общее для обоих фронтендов (правило №3). Исходная фраза и приметы критика
// неизменны — цитата момента; правится только ответ Здорового Взрослого.
// Read-after-write: onUpdated обновляет список у родителя сразу после PATCH.
// updatePhraseCheck — стабильная ссылка на метод api-модуля площадки.
// Закрытие после сохранения — решение каждого фронтенда (webapp закрывает
// лист сразу, miniapp остаётся открытым и показывает шаринг), поэтому
// save() только сообщает об успехе, а не закрывает сам.
import { useState } from 'react';
import { PHRASE_CRITERIA, type PhraseMarkId } from './criteria';

export interface PhraseHistoryEntry {
  id: number;
  phrase: string;
  marks: PhraseMarkId[];
  rewrite: string | null;
}

export interface PhraseHistoryCardState {
  rewrite: string;
  setRewrite: (v: string) => void;
  saving: boolean;
  error: boolean;
  /** Короткие подписи примет критика для рендера пилюль. */
  markLabels: string[];
  /** true — сохранилось, PhraseCheckHistoryRow у родителя уже обновлён. */
  save: () => Promise<boolean>;
}

export function usePhraseHistoryCard(
  entry: PhraseHistoryEntry,
  updatePhraseCheck: (
    id: number,
    rewrite: string,
  ) => Promise<{ rewrite: string | null }>,
  onUpdated: (id: number, rewrite: string | null) => void,
): PhraseHistoryCardState {
  const [rewrite, setRewriteState] = useState(entry.rewrite ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const markLabels = entry.marks
    .map((id) => PHRASE_CRITERIA.find((c) => c.id === id)?.short)
    .filter((s): s is string => Boolean(s));

  function setRewrite(v: string) {
    setRewriteState(v);
    setError(false);
  }

  async function save(): Promise<boolean> {
    setSaving(true);
    setError(false);
    try {
      const res = await updatePhraseCheck(entry.id, rewrite.trim());
      onUpdated(entry.id, res.rewrite);
      return true;
    } catch {
      setError(true);
      return false;
    } finally {
      setSaving(false);
    }
  }

  return { rewrite, setRewrite, saving, error, markLabels, save };
}
