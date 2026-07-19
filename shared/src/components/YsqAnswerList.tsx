// Список ответов вопроса теста на схемы — один контрол на оба фронтенда
// (правило «одна механика — один компонент»). Осознанные визуальные отличия
// фронтендов приходят пропсами: фон невыбранного ответа и цвет радио-точки.
import { ANSWER_LABELS } from '../hooks/useYsqTest';

export function YsqAnswerList({
  currentAnswer,
  onSelect,
  unselectedBg,
  radioColor,
}: {
  currentAnswer: number;
  onSelect: (value: number) => void;
  /** фон невыбранной кнопки: webapp 'transparent', miniapp 'var(--surface)' */
  unselectedBg: string;
  /** цвет выбранного радио: webapp 'var(--text)', miniapp 'var(--accent)' */
  radioColor: string;
}) {
  return (
    <div
      style={{
        padding: '0 16px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        flexShrink: 0,
      }}
    >
      {ANSWER_LABELS.map((label, i) => {
        const value = i + 1;
        const selected = currentAnswer === value;
        return (
          <button
            key={value}
            onClick={() => onSelect(value)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '13px 16px',
              borderRadius: 16,
              border: `1.5px solid ${selected ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.08)'}`,
              background: selected
                ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                : unselectedBg,
              cursor: 'pointer',
              textAlign: 'left',
              WebkitTapHighlightColor: 'transparent',
              transition: 'background 0.12s, border-color 0.12s',
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                flexShrink: 0,
                border: `2px solid ${selected ? radioColor : 'rgba(var(--fg-rgb),0.2)'}`,
                background: selected ? radioColor : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.12s',
              }}
            >
              {selected && (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#fff',
                  }}
                />
              )}
            </div>
            <span
              style={{
                fontSize: 15,
                color: selected ? 'var(--text)' : 'var(--text-sub)',
                fontWeight: selected ? 500 : 400,
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
