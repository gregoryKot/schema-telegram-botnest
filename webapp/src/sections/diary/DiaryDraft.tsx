import { useState } from 'react';
import type { DiaryType } from '../../types';
import { loadDraft, formatDraftAge } from '../../utils/drafts';
import { draftPreview } from './diaryModel';
import { draftLook } from './feedLook';
import { FeedSign } from './EntryKindChip';
import { hueStyle } from '../../lib/tone';
import { GlyphX } from '../../components/exercises/ExGlyphs';

const TITLES: Record<DiaryType, string> = { schema: 'Дневник схем', mode: 'Дневник режимов', gratitude: 'Благодарность' };
// Черновик записи (b11): недописанный лист бумаги своего типа (нижний край срезан) — знак, «Черновик» с давностью
// и тип сверху, начало текста и «Продолжить →» снизу; «×» и «удалить» — в одном месте, без прыжка.
export function DiaryDraft({ type, onContinue, onDelete }: { type: DiaryType; onContinue: () => void; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const draft = loadDraft<{ data?: unknown }>(type);
  if (!draft) return null;
  const look = draftLook(type, draft.data), preview = draftPreview(type, draft.data);
  return (
    <div className="pp-paper cd-draft" style={hueStyle(look.hue)}>
      <FeedSign look={look} />
      <div className="cd-draft-head"><span className="cd-draft-meta"><span className="ds-label">Черновик</span>{formatDraftAge(draft.startedAt)}</span><span className="cd-draft-title">{TITLES[type]}</span></div>
      {!confirm
        ? <button type="button" className="cd-draft-x" onClick={() => setConfirm(true)} aria-label="Удалить черновик"><GlyphX /></button>
        : <button type="button" className="ds-link ds-link--danger cd-draft-del" onClick={onDelete}>удалить</button>}
      <div className="cd-draft-foot">{preview && <p className="cd-draft-preview">{preview}</p>}<button type="button" className="ds-link cd-draft-go" onClick={onContinue}>Продолжить →</button></div>
    </div>
  );
}
