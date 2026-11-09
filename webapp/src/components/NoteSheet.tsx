import { useState } from 'react';
import { useTr } from '../utils/addressForm';
import { api } from '../api';
import { ExScreen } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { detectCrisisAny } from '../utils/crisisMarkers';
import { CrisisCard } from './CrisisCard';
import { NoteWhy } from './NoteWhy';
import { PaperAlert } from './paper/PaperAlert';
import { formatDateString } from '../../../shared/src/utils/calendarDate';
import { todayStr } from '../../../shared/src/utils/format';
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

  // Прошлый день — дата на листе (ds-label), а не только подпись в истории.
  const day = date === todayStr() ? null : formatDateString(date, { weekday: 'long', day: 'numeric', month: 'long' });

  // Раскладка быстрой записи: лист заметки (ENTITY_LOOK.note) героем, на ≥1024 — разворот,
  // поле-лист на всю ширину, темы дня чипами под полем, «Сохранить» во всю колонку.
  return (
    <ExScreen
      onBack={goBack}
      backLabel="Назад"
      look="note"
      spread
      eyebrow={day ? <>Дневник · {day}</> : 'Дневник'}
      title={<>Заметка <span className="it">к дню</span></>}
      lede={tr('Запиши момент — что происходило и какие были чувства.', 'Запишите момент — что происходило и какие были чувства.')}
      aside={<NoteWhy />}
    >
      {status !== 'ready' ? <NoteLoadState status={status} onRetry={reload} /> : <div className="sd-note-form">
        <LimitedTextarea
          max={Math.max(DAY_NOTE_MAX, applied?.text?.length ?? 0)} // слитая заметка — правка без роста (src/bot/day-note-limit.ts)
          alwaysCount
          value={text}
          onChange={e => { setDirty(true); setText(e.target.value); }}
          placeholder="Что происходило сегодня? Любая мысль..."
          aria-label="Запись"
          rows={6}
          className="sd-note-area"
        />
        {detectCrisisAny(text) && <CrisisCard surface="note" />}
        <NoteTagsPicker selectedTags={selectedTags} onToggle={toggleTag} />
      </div>}

      {error && (
        <PaperAlert role="status" sign="pebbles" className="sd-note-alert"
          title={tr('Не удалось сохранить. Попробуй ещё раз.', 'Не удалось сохранить. Попробуйте ещё раз.')} />
      )}

      <button onClick={handleSave} disabled={!ready || !hasContent || saving} className="ds-btn sd-note-save">
        {saving ? '…' : 'Сохранить'}
      </button>
    </ExScreen>
  );
}
