import { useState, useEffect } from 'react';
import { useTr } from '../utils/addressForm';
import { api } from '../api';
import { ExScreen } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { detectCrisisAny } from '../utils/crisisMarkers';
import { CrisisCard } from './CrisisCard';
import { NoteTagsPicker } from './NoteTagsPicker';

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
      eyebrowColor="var(--accent)"
      title={<>Заметка<br /><span className="it">к дню</span></>}
      lede={tr('Фиксируй момент – что происходило, что чувствовал.', 'Фиксируйте момент – что происходило, что чувствовали.')}
      aside={
        <div className="aside-card" style={{
          borderColor: 'color-mix(in srgb, var(--accent) 25%, transparent)',
          background: 'color-mix(in srgb, var(--accent) 5%, transparent)',
          position: 'sticky', top: 40,
        }}>
          <div className="aside-card-eyebrow" style={{ color: 'var(--accent)' }}>Зачем это?</div>
          <h3 style={{ fontSize: 18 }}>Рефлексия помогает</h3>
          <p className="body">Регулярные короткие записи помогают увидеть паттерны и понять, что происходит внутри.</p>
        </div>
      }
    >
      {/* Tags */}
      <NoteTagsPicker selectedTags={selectedTags} onToggle={toggleTag} />

      {/* Text */}
      <div className="prompt">
        <div className="prompt-num">·</div>
        <div style={{ width: '100%' }}>
          <div className="prompt-label">Запись</div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Что происходило сегодня? Любая мысль..."
            maxLength={500}
            rows={5}
            className={'paper-input ' + (text.trim() ? 'is-filled' : '')}
          />
          <div style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'right', marginTop: 4 }}>
            {text.length}/500
          </div>
        </div>
      </div>

      {detectCrisisAny(text) && <CrisisCard surface="note" />}

      {error && (
        <div style={{ fontSize: 13, color: 'var(--c-rose)', textAlign: 'center', marginBottom: 12 }}>
          {tr('Не удалось сохранить. Попробуй ещё раз.', 'Не удалось сохранить. Попробуйте ещё раз.')}
        </div>
      )}

      <div className="ex-foot">
        <span className="spacer" />
        <button
          onClick={handleSave}
          disabled={!hasContent || saving}
          className="ex-btn ex-btn-primary"
          style={{ opacity: hasContent ? 1 : 0.35 }}
        >
          {saving ? '…' : 'Сохранить'}
        </button>
      </div>
    </ExScreen>
  );
}
