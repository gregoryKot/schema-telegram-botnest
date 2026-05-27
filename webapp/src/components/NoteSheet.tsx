import { useState, useEffect } from 'react';
import { api } from '../api';
import { ExScreen } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';

const TAGS = [
  { id: 'work',       label: 'Работа',      emoji: '💼' },
  { id: 'relations',  label: 'Отношения',   emoji: '🤝' },
  { id: 'health',     label: 'Здоровье',    emoji: '🏃' },
  { id: 'loneliness', label: 'Одиночество', emoji: '🌙' },
  { id: 'rest',       label: 'Отдых',       emoji: '🛋️' },
  { id: 'family',     label: 'Семья',       emoji: '🏠' },
  { id: 'creativity', label: 'Творчество',  emoji: '🎨' },
  { id: 'anxiety',    label: 'Тревога',     emoji: '😰' },
  { id: 'joy',        label: 'Радость',     emoji: '✨' },
  { id: 'body',       label: 'Тело',        emoji: '💆' },
];

interface Props {
  date: string;
  onClose: () => void;
}

export function NoteSheet({ date, onClose }: Props) {
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
      lede="Фиксируй момент — что происходило, что чувствовал."
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
      <div className="prompt">
        <div className="prompt-num">·</div>
        <div style={{ width: '100%' }}>
          <div className="prompt-label">Темы дня</div>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {TAGS.map(t => {
              const on = selectedTags.has(t.id);
              return (
                <div
                  key={t.id}
                  onClick={() => toggleTag(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
                    background: on
                      ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
                      : 'rgba(var(--fg-rgb),0.05)',
                    border: `1px solid ${on
                      ? 'color-mix(in srgb, var(--accent) 40%, transparent)'
                      : 'rgba(var(--fg-rgb),0.07)'}`,
                    color: on ? 'var(--accent)' : 'var(--text-faint)',
                    fontSize: 13, fontWeight: on ? 600 : 400,
                    transition: 'all 0.15s',
                  }}
                >
                  <span>{t.emoji}</span>
                  <span>{t.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

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

      {error && (
        <div style={{ fontSize: 13, color: 'var(--c-rose)', textAlign: 'center', marginBottom: 12 }}>
          Не удалось сохранить. Попробуй ещё раз.
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
