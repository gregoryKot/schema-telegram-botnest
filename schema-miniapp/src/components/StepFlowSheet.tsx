// Общий пошаговый лист (правило «одна механика — один компонент»): показывает
// шаги по одному, с точками прогресса и done-экраном в конце. Единственный
// потребитель — QuickPracticeSheet (заземление и техника «Стоп» делят один
// компонент, разница только в id практики). Поведение и стили не менялись.
import { ReactNode, useState } from 'react';
import { BottomSheet } from './BottomSheet';

export interface FlowStep {
  emoji: string;
  title: string;
  hint: string;
}

interface Props {
  title: string;
  subtitle: string;
  steps: FlowStep[];
  done: FlowStep;
  repeatLabel?: string;
  /** Рендерится под hint на done-экране (счётчик прохождений, «Поделиться» и т.п.) */
  doneExtra?: ReactNode;
  onClose: () => void;
}

export function StepFlowSheet({
  title,
  subtitle,
  steps,
  done,
  repeatLabel = 'Ещё круг',
  doneExtra,
  onClose,
}: Props) {
  const [step, setStep] = useState(0);
  const isDone = step >= steps.length;
  const cur = isDone ? done : steps[step];

  return (
    <BottomSheet onClose={onClose} zIndex={200}>
      <div style={{ paddingTop: 4, textAlign: 'center' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-sub)',
            marginTop: 4,
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </div>

        <div style={{ padding: isDone ? '28px 0 8px' : '24px 0 8px' }}>
          <div style={{ fontSize: 44, lineHeight: 1 }}>{cur.emoji}</div>
          <div
            style={{
              fontSize: isDone ? 15 : 16,
              fontWeight: 700,
              color: 'var(--text)',
              marginTop: 12,
              lineHeight: 1.35,
            }}
          >
            {cur.title}
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-sub)',
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            {cur.hint}
          </div>
          {isDone && doneExtra}
        </div>

        {/* Точки прогресса */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            justifyContent: 'center',
            margin: '14px 0 16px',
          }}
        >
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 18 : 7,
                height: 7,
                borderRadius: 4,
                background:
                  i < step
                    ? 'var(--accent-green)'
                    : i === step
                      ? 'var(--accent)'
                      : 'rgba(var(--fg-rgb),0.12)',
                transition: 'all 0.2s',
              }}
            />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: '13px 18px',
              borderRadius: 12,
              border: 'none',
              background: 'rgba(var(--fg-rgb),0.06)',
              color: 'var(--text-sub)',
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Закрыть
          </button>
          <button
            className="btn-primary"
            style={{ flex: 1 }}
            onClick={() => (isDone ? setStep(0) : setStep((s) => s + 1))}
          >
            {isDone
              ? repeatLabel
              : step === steps.length - 1
                ? 'Готово'
                : 'Дальше'}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
