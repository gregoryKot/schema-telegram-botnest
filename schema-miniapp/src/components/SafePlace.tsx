import { useState, useEffect } from 'react';
import { BottomSheet } from './BottomSheet';
import { TherapyNote } from './TherapyNote';
import { SheetIconHeader } from './SheetIconHeader';
import { api } from '../api';
import { useTr } from '../utils/addressForm';
import { CrisisGate } from './CrisisGate';
import { SaveErrorNote } from './SaveErrorNote';
import { SafePlaceSavedView } from './safePlace/SavedView';

const STORAGE_KEY = 'safe_place';

interface SafePlaceData {
  text: string;
  savedAt: string;
}

function loadLocal(): SafePlaceData | null {
  try {
    return JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? 'null',
    ) as SafePlaceData | null;
  } catch {
    return null;
  }
}

const buildPrompts = (tr: (ty: string, vy: string) => string) => [
  tr(
    'Вспомни или представь место, где тебе спокойно и безопасно. Реальное или воображаемое.',
    'Вспомните или представьте место, где вам спокойно и безопасно. Реальное или воображаемое.',
  ),
  tr(
    'Что ты там видишь? Какие звуки, запахи, ощущения в теле?',
    'Что вы там видите? Какие звуки, запахи, ощущения в теле?',
  ),
  tr(
    'Почему именно здесь ты чувствуешь себя в безопасности?',
    'Почему именно здесь вы чувствуете себя в безопасности?',
  ),
];

interface Props {
  onClose: () => void;
  onComplete?: () => void;
}

export function SafePlace({ onClose, onComplete }: Props) {
  const tr = useTr();
  const PROMPTS = buildPrompts(tr);
  const [saved, setSaved] = useState<SafePlaceData | null>(() => loadLocal());
  const [editing, setEditing] = useState(!loadLocal());
  const [text, setText] = useState(() => loadLocal()?.text ?? '');
  const [justSaved, setJustSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .getSafePlace()
      .then((data) => {
        if (data) {
          const local: SafePlaceData = {
            text: data.description,
            savedAt: new Date(data.updatedAt).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }),
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
          setSaved(local);
          if (!text) setText(data.description);
          setEditing(false);
        }
      })
      .catch((e) => console.error('getSafePlace failed', e));
  }, []);

  // Раньше «✓ Сохранено» показывалось сразу после fire-and-forget
  // api.saveSafePlace().catch(()=>{}) — провал был не виден. localStorage
  // пишется сразу (офлайн-устойчивость), переход в просмотр — только после успеха.
  async function handleSave() {
    if (!text.trim() || saving) return;
    const trimmed = text.trim();
    const data: SafePlaceData = {
      text: trimmed,
      savedAt: new Date().toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSaving(true);
    setError(false);
    try {
      await api.saveSafePlace(trimmed);
      setSaved(data);
      setJustSaved(true);
      setEditing(false);
      onComplete?.();
      setTimeout(() => setJustSaved(false), 1800);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  if (!editing && saved) {
    return (
      <SafePlaceSavedView
        saved={saved}
        justSaved={justSaved}
        onClose={onClose}
        onEdit={() => {
          setText(saved.text);
          setEditing(true);
        }}
      />
    );
  }

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <SheetIconHeader
          title="Безопасное место"
          subtitle={tr(
            'Напиши — чтобы возвращаться в трудный момент',
            'Напишите — чтобы возвращаться в трудный момент',
          )}
        />

        {/* Prompts */}
        <div
          style={{
            background:
              'color-mix(in srgb, var(--accent-green) 6%, transparent)',
            border:
              '1px solid color-mix(in srgb, var(--accent-green) 12%, transparent)',
            borderRadius: 14,
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
          placeholder="Это небольшой уютный лес недалеко от дома. Я слышу птиц..."
          rows={8}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: 'rgba(var(--fg-rgb),0.04)',
            border: `1px solid ${text.trim() ? 'color-mix(in srgb, var(--accent-green) 25%, transparent)' : 'rgba(var(--fg-rgb),0.1)'}`,
            borderRadius: 14,
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
        <CrisisGate texts={[text]} surface="safe_place" />

        {error && (
          <SaveErrorNote
            ty="Не удалось сохранить на сервере. Текст остался на этом устройстве — попробуй ещё раз."
            vy="Не удалось сохранить на сервере. Текст остался на этом устройстве — попробуйте ещё раз."
          />
        )}

        <button
          onClick={handleSave}
          disabled={!text.trim() || saving}
          style={{
            width: '100%',
            padding: '14px 0',
            borderRadius: 14,
            border: 'none',
            background: text.trim()
              ? 'color-mix(in srgb, var(--accent-green) 15%, transparent)'
              : 'rgba(var(--fg-rgb),0.06)',
            color: text.trim()
              ? 'var(--accent-green)'
              : 'rgba(var(--fg-rgb),0.25)',
            fontSize: 15,
            fontWeight: 600,
            cursor: text.trim() && !saving ? 'pointer' : 'default',
            transition: 'all 0.25s',
            marginBottom: 16,
          }}
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>

        <TherapyNote compact />
      </div>
    </BottomSheet>
  );
}
