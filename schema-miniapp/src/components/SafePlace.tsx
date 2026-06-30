import { useState, useEffect } from 'react';
import { BottomSheet } from './BottomSheet';
import { TherapyNote } from './TherapyNote';
import { api } from '../api';

const STORAGE_KEY = 'safe_place';

interface SafePlaceData {
  text: string;
  savedAt: string;
}

function loadLocal(): SafePlaceData | null {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'); } catch { return null; }
}

const PROMPTS = [
  'Вспомни или представь место, где тебе спокойно и безопасно. Реальное или воображаемое.',
  'Что ты там видишь? Какие звуки, запахи, ощущения в теле?',
  'Почему именно здесь ты чувствуешь себя в безопасности?',
];

interface Props { onClose: () => void; onComplete?: () => void; }

export function SafePlace({ onClose, onComplete }: Props) {
  const [saved, setSaved] = useState<SafePlaceData | null>(() => loadLocal());
  const [editing, setEditing] = useState(!loadLocal());
  const [text, setText] = useState(() => loadLocal()?.text ?? '');
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    api.getSafePlace().then(data => {
      if (data) {
        const local: SafePlaceData = {
          text: data.description,
          savedAt: new Date(data.updatedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
        setSaved(local);
        if (!text) setText(data.description);
        setEditing(false);
      }
    }).catch(() => {});
  }, []);

  async function handleSave() {
    if (!text.trim()) return;
    const trimmed = text.trim();
    const data: SafePlaceData = {
      text: trimmed,
      savedAt: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSaved(data);
    // Save to server
    api.saveSafePlace(trimmed).catch(() => {});
    setJustSaved(true);
    setEditing(false);
    onComplete?.();
    setTimeout(() => setJustSaved(false), 1800);
  }

  if (!editing && saved) {
    return (
      <BottomSheet onClose={onClose}>
        <div style={{ paddingTop: 4 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
              🏡
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Моё безопасное место</div>
              <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>Прочти — и почувствуй</div>
            </div>
          </div>

          <div style={{ background: 'color-mix(in srgb, var(--accent-green) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 12%, transparent)', borderRadius: 16, padding: '16px', marginBottom: 16 }}>
            <div style={{ fontSize: 15, color: 'rgba(var(--fg-rgb),0.85)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{saved.text}</div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center', marginBottom: 16 }}>
            {justSaved ? '✓ Сохранено' : `Обновлено ${saved.savedAt}`}
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button onClick={() => { setText(saved.text); setEditing(true); }} style={{ flex: 1, padding: '13px 0', borderRadius: 14, border: '1px solid rgba(var(--fg-rgb),0.1)', background: 'transparent', color: 'var(--text-sub)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Изменить
            </button>
            <button onClick={onClose} style={{ flex: 1, padding: '13px 0', borderRadius: 14, border: 'none', background: 'color-mix(in srgb, var(--accent-green) 15%, transparent)', color: 'var(--accent-green)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Готово
            </button>
          </div>

          <TherapyNote compact />
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
            🏡
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Безопасное место</div>
            <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>Напиши — чтобы возвращаться в трудный момент</div>
          </div>
        </div>

        {/* Prompts */}
        <div style={{ background: 'color-mix(in srgb, var(--accent-green) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 12%, transparent)', borderRadius: 14, padding: '12px 14px', marginBottom: 16 }}>
          {PROMPTS.map((p, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: i < PROMPTS.length - 1 ? 8 : 0 }}>
              {p}
            </div>
          ))}
        </div>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Это небольшой уютный лес недалеко от дома. Я слышу птиц..."
          rows={8}
          style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(var(--fg-rgb),0.04)', border: `1px solid ${text.trim() ? 'color-mix(in srgb, var(--accent-green) 25%, transparent)' : 'rgba(var(--fg-rgb),0.1)'}`, borderRadius: 14, padding: '13px 14px', color: 'var(--text)', fontSize: 14, lineHeight: 1.7, resize: 'none', outline: 'none', fontFamily: 'inherit', marginBottom: 14 }}
        />

        <button
          onClick={handleSave}
          disabled={!text.trim()}
          style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', background: text.trim() ? 'color-mix(in srgb, var(--accent-green) 15%, transparent)' : 'rgba(var(--fg-rgb),0.06)', color: text.trim() ? 'var(--accent-green)' : 'rgba(var(--fg-rgb),0.25)', fontSize: 15, fontWeight: 600, cursor: text.trim() ? 'pointer' : 'default', transition: 'all 0.25s', marginBottom: 16 }}
        >
          Сохранить
        </button>

        <TherapyNote compact />
      </div>
    </BottomSheet>
  );
}
