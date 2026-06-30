import { useState, useEffect } from 'react';
import { BottomSheet } from './BottomSheet';
import { TherapyNote } from './TherapyNote';
import { api } from '../api';

const STORAGE_KEY = 'letters_to_self';

interface Letter {
  id: string | number;
  date: string;
  text: string;
}

function loadLocal(): Letter[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

interface Props { onClose: () => void; onComplete?: () => void; }

const PROMPTS = [
  'Вспомни момент из детства или юности, когда тебе было по-настоящему тяжело.',
  'Что тогда происходило? Что ты чувствовал? Чего тебе не хватало?',
  'Напиши этому ребёнку письмо — от себя сегодняшнего. Что ты хочешь ему сказать? Что ему нужно было услышать?',
];

export function LetterToSelf({ onClose, onComplete }: Props) {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  const [letters, setLetters] = useState<Letter[]>(() => loadLocal());
  const [viewing, setViewing] = useState<Letter | null>(null);

  useEffect(() => {
    api.getLetters().then(rows => {
      setLetters(rows.map(r => ({ id: r.id, date: fmtDate(r.createdAt), text: r.text })));
    }).catch(() => {});
  }, []);

  async function handleSave() {
    if (!text.trim()) return;
    const trimmed = text.trim();
    const letter: Letter = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
      text: trimmed,
    };
    // Sync to localStorage
    const updated = [letter, ...loadLocal()].slice(0, 30);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setLetters(prev => [letter, ...prev]);
    // Save to server
    api.createLetter(trimmed).catch(() => {});
    setSaved(true);
    onComplete?.();
    setTimeout(() => { setSaved(false); setText(''); }, 1800);
  }

  if (viewing) {
    return (
      <BottomSheet onClose={() => setViewing(null)} zIndex={300}>
        <div style={{ paddingTop: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 12 }}>{viewing.date}</div>
          <div style={{ fontSize: 14, color: 'rgba(var(--fg-rgb),0.8)', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{viewing.text}</div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
            ✉️
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Письмо Уязвимому Ребёнку</div>
            <div style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}>Написать себе из прошлого</div>
          </div>
        </div>

        {/* Prompts */}
        <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.12)', borderRadius: 14, padding: '12px 14px', marginBottom: 16 }}>
          {PROMPTS.map((p, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.6, marginBottom: i < PROMPTS.length - 1 ? 8 : 0 }}>
              {p}
            </div>
          ))}
        </div>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Дорогой маленький я..."
          rows={8}
          style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(var(--fg-rgb),0.04)', border: `1px solid ${text.trim() ? 'rgba(251,191,36,0.25)' : 'rgba(var(--fg-rgb),0.1)'}`, borderRadius: 14, padding: '13px 14px', color: 'var(--text)', fontSize: 14, lineHeight: 1.7, resize: 'none', outline: 'none', fontFamily: 'inherit', marginBottom: 14 }}
        />

        <button
          onClick={handleSave}
          disabled={!text.trim() || saved}
          style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', background: saved ? 'color-mix(in srgb, var(--accent-green) 15%, transparent)' : text.trim() ? 'rgba(251,191,36,0.15)' : 'rgba(var(--fg-rgb),0.06)', color: saved ? 'var(--accent-green)' : text.trim() ? 'var(--accent-yellow)' : 'rgba(var(--fg-rgb),0.25)', fontSize: 15, fontWeight: 600, cursor: text.trim() && !saved ? 'pointer' : 'default', transition: 'all 0.25s', marginBottom: 20 }}
        >
          {saved ? '✓ Сохранено' : 'Сохранить письмо'}
        </button>

        {/* Past letters */}
        {letters.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 10 }}>
              Прошлые письма
            </div>
            {letters.slice(0, 5).map(l => (
              <div key={l.id} onClick={() => setViewing(l)} style={{ padding: '11px 14px', background: 'rgba(var(--fg-rgb),0.03)', border: '1px solid rgba(var(--fg-rgb),0.06)', borderRadius: 12, marginBottom: 7, cursor: 'pointer' }}>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 4 }}>{l.date}</div>
                <div style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {l.text}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16 }}><TherapyNote compact /></div>
      </div>
    </BottomSheet>
  );
}
