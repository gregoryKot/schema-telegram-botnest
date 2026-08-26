import type { ReactNode } from 'react';
import { EvidenceList } from './EvidenceList';
import { cm } from '../../sections/schemas/utils';

// Шаг сбора доказательств проверки убеждения. Один компонент на обе стороны
// («за» и «против»): они различались только цветом, заголовком, подсказкой,
// парой состояний и следующим шагом — код был скопирован целиком.
// Вынесено из BeliefCheck.tsx (правило №10 + «одна механика — один компонент»).
export function EvidenceStep({
  accent,
  title,
  hint,
  items,
  setItems,
  input,
  setInput,
  onAdd,
  onNext,
}: {
  accent: string;
  title: string;
  hint: ReactNode;
  items: string[];
  setItems: React.Dispatch<React.SetStateAction<string[]>>;
  input: string;
  setInput: (v: string) => void;
  onAdd: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <div
        style={{
          background: cm(accent, 6),
          border: `1px solid ${cm(accent, 12)}`,
          borderRadius: 'var(--r-14)',
          padding: '10px 14px',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: accent,
            fontWeight: 600,
            marginBottom: 4,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-sub)',
            lineHeight: 1.5,
          }}
        >
          {hint}
        </div>
      </div>
      <EvidenceList
        items={items}
        setItems={setItems}
        input={input}
        setInput={setInput}
        onAdd={onAdd}
        accentColor={accent}
        surface="belief_check"
      />
      <button
        onClick={onNext}
        style={{
          width: '100%',
          padding: '13px 0',
          borderRadius: 'var(--r-14)',
          border: 'none',
          background: cm('var(--accent-blue)', 15),
          color: 'var(--accent-blue)',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        Дальше →
      </button>
    </>
  );
}
