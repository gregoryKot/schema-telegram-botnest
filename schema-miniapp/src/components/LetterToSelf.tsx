import { useState, useEffect } from 'react';
import { BottomSheet } from './BottomSheet';
import { TherapyNote } from './TherapyNote';
import { SheetIconHeader } from './SheetIconHeader';
import { api } from '../api';
import { useTr } from '../utils/addressForm';
import { CrisisGate } from './CrisisGate';
import { SaveErrorNote } from './SaveErrorNote';
import { PastLetters } from './letterToSelf/PastLetters';

const STORAGE_KEY = 'letters_to_self';

interface Letter {
  id: string | number;
  date: string;
  text: string;
}

function loadLocal(): Letter[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Letter[];
  } catch {
    return [];
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

interface Props {
  onClose: () => void;
  onComplete?: () => void;
}

const buildPrompts = (tr: (ty: string, vy: string) => string) => [
  tr(
    'Вспомни момент из детства или юности, когда тебе было по-настоящему тяжело.',
    'Вспомните момент из детства или юности, когда вам было по-настоящему тяжело.',
  ),
  tr(
    'Что тогда происходило? Какие были чувства? Чего тебе не хватало?',
    'Что тогда происходило? Какие были чувства? Чего вам не хватало?',
  ),
  tr(
    'Напиши этому ребёнку письмо — из сегодняшнего дня. Что хочется сказать? Что тогда важно было услышать?',
    'Напишите этому ребёнку письмо — из сегодняшнего дня. Что хочется сказать? Что тогда важно было услышать?',
  ),
];

export function LetterToSelf({ onClose, onComplete }: Props) {
  const tr = useTr();
  const PROMPTS = buildPrompts(tr);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [letters, setLetters] = useState<Letter[]>(() => loadLocal());
  const [viewing, setViewing] = useState<Letter | null>(null);

  useEffect(() => {
    api
      .getLetters()
      .then((rows) => {
        setLetters(
          rows.map((r) => ({
            id: r.id,
            date: fmtDate(r.createdAt),
            text: r.text,
          })),
        );
      })
      .catch((e) => console.error('getLetters failed', e));
  }, []);

  // Раньше «✓ Сохранено» показывалось сразу после fire-and-forget
  // api.createLetter().catch(()=>{}) — провал был не виден. localStorage
  // пишется сразу (офлайн-устойчивость), подтверждение — только после успеха.
  async function handleSave() {
    if (!text.trim() || saving) return;
    const trimmed = text.trim();
    const letter: Letter = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      text: trimmed,
    };
    const updated = [letter, ...loadLocal()].slice(0, 30);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setLetters((prev) => [letter, ...prev]);
    setSaving(true);
    setError(false);
    try {
      await api.createLetter(trimmed);
      setSaved(true);
      onComplete?.();
      setTimeout(() => {
        setSaved(false);
        setText('');
      }, 1800);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  if (viewing) {
    return (
      <BottomSheet onClose={() => setViewing(null)} zIndex={300}>
        <div style={{ paddingTop: 4 }}>
          <div
            style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 12 }}
          >
            {viewing.date}
          </div>
          <div
            style={{
              fontSize: 14,
              color: 'rgba(var(--fg-rgb),0.8)',
              lineHeight: 1.75,
              whiteSpace: 'pre-wrap',
            }}
          >
            {viewing.text}
          </div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <SheetIconHeader
          title="Письмо Уязвимому Ребёнку"
          subtitle="Написать себе из прошлого"
        />

        {/* Prompts */}
        <div
          style={{
            background: 'rgba(251,191,36,0.06)',
            border: '1px solid rgba(251,191,36,0.12)',
            borderRadius: 'var(--r-14)',
            padding: '12px 14px',
            marginBottom: 16,
          }}
        >
          {PROMPTS.map((p, i) => (
            <div
              key={i}
              style={{
                fontSize: 12,
                color: 'var(--text-sub)',
                lineHeight: 1.6,
                marginBottom: i < PROMPTS.length - 1 ? 8 : 0,
              }}
            >
              {p}
            </div>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Здравствуй,..."
          rows={8}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: 'rgba(var(--fg-rgb),0.04)',
            border: `1px solid ${text.trim() ? 'rgba(251,191,36,0.25)' : 'rgba(var(--fg-rgb),0.1)'}`,
            borderRadius: 'var(--r-14)',
            padding: '13px 14px',
            color: 'var(--text)',
            fontSize: 14,
            lineHeight: 1.7,
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            marginBottom: 14,
          }}
        />
        <CrisisGate texts={[text]} surface="letter" />

        {error && (
          <SaveErrorNote
            ty="Не удалось сохранить на сервере. Письмо осталось на этом устройстве — попробуй ещё раз."
            vy="Не удалось сохранить на сервере. Письмо осталось на этом устройстве — попробуйте ещё раз."
          />
        )}

        <button
          onClick={handleSave}
          disabled={!text.trim() || saved || saving}
          style={{
            width: '100%',
            padding: '14px 0',
            borderRadius: 'var(--r-14)',
            border: 'none',
            background: saved
              ? 'color-mix(in srgb, var(--accent-green) 15%, transparent)'
              : text.trim()
                ? 'rgba(251,191,36,0.15)'
                : 'rgba(var(--fg-rgb),0.06)',
            color: saved
              ? 'var(--accent-green)'
              : text.trim()
                ? 'var(--accent-yellow)'
                : 'rgba(var(--fg-rgb),0.25)',
            fontSize: 15,
            fontWeight: 600,
            cursor: text.trim() && !saved && !saving ? 'pointer' : 'default',
            transition: 'all 0.25s',
            marginBottom: 20,
          }}
        >
          {saved
            ? '✓ Сохранено'
            : saving
              ? 'Сохранение...'
              : 'Сохранить письмо'}
        </button>

        <PastLetters letters={letters} onView={setViewing} />

        <div style={{ marginTop: 16 }}>
          <TherapyNote compact />
        </div>
      </div>
    </BottomSheet>
  );
}
