import { useState } from 'react';
import { api } from '../api';
import { SectionLabel } from './SectionLabel';
import { useTr } from '../utils/addressForm';
import { CrisisGate } from './CrisisGate';

const buildQuestions = (tr: (ty: string, vy: string) => string) => [
  'Что было самым трудным на этой неделе?',
  tr(
    'Что дало тебе энергию на этой неделе?',
    'Что дало вам энергию на этой неделе?',
  ),
  tr(
    'Было ли что-то, что ты сделал именно так, как хочешь — не потому что нужно или ждут?',
    'Было ли что-то, что вы сделали именно так, как хотите — не потому что нужно или ждут?',
  ),
  tr('Что ты хотел бы сделать иначе?', 'Что вы хотели бы сделать иначе?'),
  'Что хочется взять с собой в следующую неделю?',
  tr(
    'Как ты заботился о себе на этой неделе?',
    'Как вы заботились о себе на этой неделе?',
  ),
  tr('Что ты заметил нового о себе?', 'Что вы заметили нового о себе?'),
  'Какая потребность требовала больше всего внимания?',
];

function getWeekKey() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((now.getTime() - startOfYear.getTime()) / 86400000 +
      startOfYear.getDay() +
      1) /
      7,
  );
  return `weekly_q_${now.getFullYear()}_${week}`;
}

function getQuestion(tr: (ty: string, vy: string) => string): string {
  const now = new Date();
  const week = Math.ceil(
    (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 604800000,
  );
  const questions = buildQuestions(tr);
  return questions[week % questions.length];
}

function shouldShow(): boolean {
  if (localStorage.getItem(getWeekKey())) return false;
  const dow = new Date().getDay(); // 1 = Monday
  return dow === 1;
}

interface Props {
  date: string; // today's date YYYY-MM-DD
  onDismiss: () => void;
}

export function WeeklyQuestion({ date, onDismiss }: Props) {
  const tr = useTr();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const question = getQuestion(tr);

  function handleSave() {
    setSaving(true);
    localStorage.setItem(getWeekKey(), '1');
    api
      .saveNote(date, `[Вопрос недели] ${question}\n\n${text.trim()}`)
      .catch(() => {});
    setSaving(false);
    onDismiss();
  }

  function handleSkip() {
    localStorage.setItem(getWeekKey(), '1');
    onDismiss();
  }

  return (
    <div
      style={{
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, transparent), rgba(79,163,247,0.08))',
        border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
        borderRadius: 16,
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
          borderRadius: 10,
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
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSkip}
          style={{
            flex: 1,
            padding: '9px 0',
            border: 'none',
            borderRadius: 10,
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
            borderRadius: 10,
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
