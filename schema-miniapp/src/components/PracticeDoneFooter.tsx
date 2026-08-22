// Подвал завершённой быстрой практики «Здесь и сейчас»: счётчик прохождений +
// кнопка «Поделиться». Общий для трёх практик (правило «одна механика — один
// компонент») — QuickPracticeSheet кладёт его в doneExtra StepFlowSheet,
// BreathingCard показывает под карточкой (у дыхания нет done-экрана).
import { useEffect } from 'react';
import { plural } from '../sections/today/helpers';

/** Нейтральная подпись для canvas-карточки и текста шаринга — без формы
 * обращения и рода (как в shareTexts.ts: 1-е лицо или безличное). */
export function practiceCountLabel(count: number | null): string | null {
  if (count == null || count <= 0) return null;
  return `прошли ${count} ${plural(count, 'раз', 'раза', 'раз')}`;
}

interface Props {
  count: number | null;
  onShare: () => void;
  /** Зовётся один раз при показе — record прохождения (read-after-write). */
  onShown?: () => void;
}

export function PracticeDoneFooter({ count, onShare, onShown }: Props) {
  useEffect(() => {
    // Записываем прохождение ровно один раз при появлении подвала —
    // повторные маунты в рамках открытой практики гасит сам useQuickPractice.
    onShown?.();
  }, [onShown]);

  return (
    <div
      style={{
        marginTop: 14,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-8)',
      }}
    >
      {count != null && count > 0 && (
        // Безличная формулировка (правило CLAUDE.md об обращении): вилки по
        // роду в проекте нет («проходил»/«проходила» пришлось бы разводить),
        // поэтому фраза не зависит ни от формы обращения, ни от рода.
        <div style={{ fontSize: 12, color: 'var(--text-sub)' }}>
          Пройдено уже {count} {plural(count, 'раз', 'раза', 'раз')}
        </div>
      )}
      <button
        onClick={onShare}
        style={{
          border: 'none',
          background: 'rgba(var(--fg-rgb),0.06)',
          color: 'var(--accent)',
          fontSize: 13,
          fontWeight: 700,
          padding: '9px 18px',
          borderRadius: 99,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Поделиться
      </button>
    </div>
  );
}
