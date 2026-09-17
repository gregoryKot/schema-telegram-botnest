import { useState } from 'react';
import { api } from '../api';
import { SectionLabel } from './SectionLabel';
import { useTr } from '../utils/addressForm';
import { CrisisGate } from './CrisisGate';
import { SaveErrorNote } from './SaveErrorNote';
import { getWeekKey, getQuestion, shouldShow } from './weeklyQuestion.helpers';

interface Props {
  date: string; // today's date YYYY-MM-DD
  onDismiss: () => void;
}

export function WeeklyQuestion({ date, onDismiss }: Props) {
  const tr = useTr();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const question = getQuestion(tr);

  async function handleSave() {
    setSaving(true);
    setSaveError(false);
    try {
      await api.saveNote(date, `[Вопрос недели] ${question}\n\n${text.trim()}`);
      localStorage.setItem(getWeekKey(), '1');
      onDismiss();
    } catch (e) {
      console.error('saveNote (weekly) failed', e);
      setSaveError(true);
      setSaving(false);
    }
  }

  function handleSkip() {
    localStorage.setItem(getWeekKey(), '1');
    onDismiss();
  }

  return (
    <div
      style={{
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, transparent), color-mix(in srgb, var(--accent-blue) 8%, transparent))',
        border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
        borderRadius: 'var(--r-16)',
        padding: '16px 18px',
        marginBottom: 20,
      }}
    >
      <SectionLabel purple>Вопрос недели</SectionLabel>
      <div
        style={{
          fontSize: 15,
          color: 'rgba(var(--fg-rgb),0.85)',
          lineHeight: 1.5,
          marginBottom: 14,
        }}
      >
        {question}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={tr(
          'Напиши, что приходит в голову...',
          'Напишите, что приходит в голову...',
        )}
        maxLength={500}
        rows={3}
        style={{
          width: '100%',
          background: 'rgba(var(--fg-rgb),0.06)',
          border: '1px solid rgba(var(--fg-rgb),0.1)',
          borderRadius: 'var(--r-10)',
          padding: '10px 12px',
          color: 'var(--text)',
          fontSize: 13,
          lineHeight: 1.5,
          resize: 'none',
          outline: 'none',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          marginBottom: 10,
        }}
      />
      <CrisisGate texts={[text]} surface="weekly" />
      {saveError && (
        <SaveErrorNote
          ty="Не сохранилось, попробуй ещё раз"
          vy="Не сохранилось, попробуйте ещё раз"
        />
      )}
      <div style={{ display: 'flex', gap: 'var(--space-8)' }}>
        <button
          onClick={handleSkip}
          style={{
            flex: 1,
            padding: '9px 0',
            border: 'none',
            borderRadius: 'var(--r-10)',
            background: 'rgba(var(--fg-rgb),0.06)',
            color: 'var(--text-sub)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Пропустить
        </button>
        <button
          onClick={handleSave}
          disabled={!text.trim() || saving}
          style={{
            flex: 2,
            padding: '9px 0',
            border: 'none',
            borderRadius: 'var(--r-10)',
            background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
            color: 'var(--accent)',
            fontSize: 12,
            fontWeight: 600,
            cursor: text.trim() ? 'pointer' : 'default',
            opacity: text.trim() ? 1 : 0.35,
          }}
        >
          Сохранить
        </button>
      </div>
    </div>
  );
}

export { shouldShow as shouldShowWeeklyQuestion };
