import { useState, useEffect } from 'react';
import { api } from '../api';
import { GlyphArrowLeft } from './exercises/ExScreen';

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
      onClose();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--bg)', overflowY: 'auto' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg)', borderBottom: '1px solid var(--line)', padding: '12px 24px' }}>
        <button className="ex-btn ex-btn-ghost" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px' }}>
          <GlyphArrowLeft /> Назад
        </button>
      </div>
      <div style={{ maxWidth: 580, margin: '0 auto', padding: '36px 24px 80px' }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 32, fontWeight: 400, color: 'var(--text)', lineHeight: 1.15, marginBottom: 28 }}>
          Заметка к дню
        </h1>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 20 }}>
          {TAGS.map(t => {
            const on = selectedTags.has(t.id);
            return (
              <div
                key={t.id}
                onClick={() => toggleTag(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
                  background: on ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'rgba(var(--fg-rgb),0.05)',
                  border: `1px solid ${on ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'rgba(var(--fg-rgb),0.07)'}`,
                  color: on ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.5)',
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

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Что происходило сегодня? Любая мысль..."
          maxLength={500}
          style={{
            width: '100%', minHeight: 120,
            background: 'rgba(var(--fg-rgb),0.05)',
            border: '1px solid rgba(var(--fg-rgb),0.1)',
            borderRadius: 12, padding: '14px 16px',
            color: 'var(--text)', fontSize: 15, lineHeight: 1.6,
            resize: 'none', outline: 'none', boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
        <div style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'right', marginTop: 4, marginBottom: 24 }}>
          {text.length}/500
        </div>

        {error && (
          <div style={{ fontSize: 13, color: 'rgba(255,100,100,0.8)', marginBottom: 12 }}>
            Не удалось сохранить. Попробуй ещё раз.
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={!hasContent || saving}
          className="ex-btn ex-btn-primary"
          style={{ opacity: hasContent ? 1 : 0.35 }}
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}
