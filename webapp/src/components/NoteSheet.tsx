import { useState } from 'react';
import { useTr } from '../utils/addressForm';
import { api } from '../api';
import { ExScreen } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { detectCrisisAny } from '../utils/crisisMarkers';
import { CrisisCard } from './CrisisCard';
import { DIARY_HUE } from '../lib/tone';
import { DiaryAside } from './diary/DiaryStepCard';
import '../styles/sheet-diary.css';
import { NoteTagsPicker } from './NoteTagsPicker';
import { LimitedTextarea } from '../../../shared/src/components/LimitedTextarea';
import { DAY_NOTE_MAX } from '../../../shared/src/limits/textLimits';
import { useDayNote, type DayNote } from '../hooks/useDayNote';
import { NoteLoadState } from './NoteLoadState';

interface Props {
  date: string;
  onClose: () => void;
}

export function NoteSheet({ date, onClose }: Props) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const [text, setText] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const { status, note, reload } = useDayNote(date);
  const ready = status === 'ready';
  // Ответ сервера ложится в форму, только пока человек ничего не менял (аудит 2026-11, E7).
  const [dirty, setDirty] = useState(false);
  const [applied, setApplied] = useState<DayNote | null>(null);
  if (ready && note && note !== applied) {
    setApplied(note);
    if (!dirty) { setText(note.text ?? ''); setSelectedTags(new Set(note.tags)); }
  }

  function toggleTag(id: string) {
    setDirty(true);
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const hasContent = text.trim().length > 0 || selectedTags.size > 0;

  async function handleSave() {
    if (!ready || !hasContent) return;
    setSaving(true);
    setError(false);
    try {
      await api.saveNote(date, text.trim(), [...selectedTags]);
      goBack();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ExScreen
      onBack={goBack}
      backLabel="Назад"
      eyebrow="Дневник"
      title={<>Заметка<br /><span className="it">к дню</span></>}
      lede={tr('Запиши момент — что происходило и какие были чувства.', 'Запишите момент — что происходило и какие были чувства.')}
      aside={
        <DiaryAside hue={DIARY_HUE.schema} eyebrow="Зачем это?" title="Рефлексия помогает">
          <p className="ds-sub">Регулярные короткие записи помогают увидеть паттерны и понять, что происходит внутри.</p>
        </DiaryAside>
      }
    >
      {status !== 'ready' ? <NoteLoadState status={status} onRetry={reload} /> : <>
        <NoteTagsPicker selectedTags={selectedTags} onToggle={toggleTag} />
        <div className="ds-card sd-note-field">
          <div className="ds-label">Запись</div>
          <LimitedTextarea
            max={Math.max(DAY_NOTE_MAX, applied?.text?.length ?? 0)} // слитая заметка — правка без роста (src/bot/day-note-limit.ts)
            alwaysCount
            value={text}
            onChange={e => { setDirty(true); setText(e.target.value); }}
            placeholder="Что происходило сегодня? Любая мысль..."
            rows={5}
            className="ds-textarea"
          />
        </div>
      </>}

      {detectCrisisAny(text) && <CrisisCard surface="note" />}

      {error && (
        <div role="status" className="sd-save-error">
          {tr('Не удалось сохранить. Попробуй ещё раз.', 'Не удалось сохранить. Попробуйте ещё раз.')}
        </div>
      )}

      <div className="sd-foot">
        <span className="sd-spacer" />
        <button onClick={handleSave} disabled={!ready || !hasContent || saving} className="ds-btn">
          {saving ? '…' : 'Сохранить'}
        </button>
      </div>
    </ExScreen>
  );
}
