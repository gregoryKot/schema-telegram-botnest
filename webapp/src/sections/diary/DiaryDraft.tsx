import { useState } from 'react';
import type { DiaryType } from '../../types';
import { loadDraft, formatDraftAge } from '../../utils/drafts';
import { draftPreview } from './diaryModel';
import { DIARY_HUE, hueStyle } from '../../lib/tone';

const TITLES: Record<DiaryType, string> = { schema: 'Дневник схем', mode: 'Дневник режимов', gratitude: 'Благодарность' };

// Черновик записи: пунктирная рамка в тоне типа, «продолжить» открывает тот же поток.
export function DiaryDraft({ type, onContinue, onDelete }: {
  type: DiaryType; onContinue: () => void; onDelete: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const draft = loadDraft<{ data?: unknown }>(type);
  if (!draft) return null;
  const preview = draftPreview(type, draft.data);
  return (
    <div className="cd-draft" style={hueStyle(DIARY_HUE.schema)}>
      <span className="cd-draft-tag tone-ink">Черновик</span>
      <span className="cd-draft-title">{TITLES[type]} · {formatDraftAge(draft.startedAt)}</span>
      <button className="ds-link cd-draft-go" onClick={onContinue}>Продолжить →</button>
      {!confirm
        ? <button className="cd-draft-x" onClick={() => setConfirm(true)} aria-label="Удалить черновик">×</button>
        : <button className="ds-link cd-draft-del" onClick={onDelete}>удалить</button>}
      {preview && <div className="cd-draft-preview">{preview}</div>}
    </div>
  );
}
