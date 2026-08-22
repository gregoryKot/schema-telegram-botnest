// Список «Прошлые разборы» под формой (PhraseCheck.tsx). Строки нажимаемые —
// открывают карточку разбора (HistoryCard.tsx) с возможностью отредактировать
// ответ и поделиться. Зона тапа ≥44px, клавиатурный доступ — через pressable
// (правило «одна механика — один компонент», утилита a11y).
import { pressable } from '../../utils/a11y';
import type { PhraseMarkId } from '../../../../shared/src/phraseCheck/criteria';

export interface PhraseCheckHistoryRow {
  id: number;
  phrase: string;
  marks: PhraseMarkId[];
  rewrite: string | null;
}

export function PhraseCheckHistoryList({
  history,
  onOpen,
}: {
  history: PhraseCheckHistoryRow[];
  onOpen: (id: number) => void;
}) {
  if (history.length === 0) return null;
  return (
    <div style={{ marginTop: 20 }}>
      <div className="section-label" style={{ marginBottom: 8 }}>
        Прошлые разборы
      </div>
      {history.map((h) => (
        <div
          key={h.id}
          {...pressable(() => onOpen(h.id))}
          aria-label={`Открыть разбор: ${h.phrase}`}
          style={{
            padding: '10px 14px',
            minHeight: 44,
            boxSizing: 'border-box',
            background: 'rgba(var(--fg-rgb),0.03)',
            border: '1px solid rgba(var(--fg-rgb),0.06)',
            borderRadius: 'var(--r-12)',
            marginBottom: 7,
            fontSize: 13,
            lineHeight: 1.45,
            color: 'var(--text-sub)',
            cursor: 'pointer',
          }}
        >
          «{h.phrase}»
          {h.rewrite && (
            <div style={{ color: 'var(--accent-green)', marginTop: 4 }}>
              → «{h.rewrite}»
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
