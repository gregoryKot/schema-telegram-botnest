import { useState, useEffect } from 'react';
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

interface Props {
  date: string;
  onClose: () => void;
}

export function NoteSheet({ date, onClose }: Props) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const [text, setText] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [_loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.getNote(date)
      .then(r => {
        setText(r.text ?? '');
        setSelectedTags(new Set(r.tags ?? []));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [date]);

  function toggleTag(id: string) {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const hasContent = text.trim().length > 0 || selectedTags.size > 0;

  async function handleSave() {
    if (!hasContent) return;
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
      {/* Tags */}
      <NoteTagsPicker selectedTags={selectedTags} onToggle={toggleTag} />

      {/* Text */}
      <div className="ds-card sd-note-field">
        <div className="ds-label">Запись</div>
        <LimitedTextarea
          max={DAY_NOTE_MAX}
          alwaysCount
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Что происходило сегодня? Любая мысль..."
          rows={5}
          className="ds-textarea"
        />
      </div>

      {detectCrisisAny(text) && <CrisisCard surface="note" />}

      {error && (
        <div role="status" className="sd-save-error">
          {tr('Не удалось сохранить. Попробуй ещё раз.', 'Не удалось сохранить. Попробуйте ещё раз.')}
        </div>
      )}

      <div className="sd-foot">
        <span className="sd-spacer" />
        <button onClick={handleSave} disabled={!hasContent || saving} className="ds-btn">
          {saving ? '…' : 'Сохранить'}
        </button>
      </div>
    </ExScreen>
  );
}
