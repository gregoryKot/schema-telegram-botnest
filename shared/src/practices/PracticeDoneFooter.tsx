// Подвал завершённой быстрой практики «Здесь и сейчас»: счётчик прохождений +
// кнопка «Поделиться». Общий для трёх практик (правило «одна механика — один
// компонент») — QuickPracticeFlow кладёт его в doneExtra пошагового листа,
// BreathingCard показывает под карточкой (у дыхания нет done-экрана).
// Вёрстка здесь общая для обеих площадок сознательно: после выноса логики
// она совпала бы построчно, а токены (--text-sub, --accent, --fg-rgb, --space-8)
// объявлены в обоих index.css (гейт check-token-contract.mjs).
import { useEffect } from 'react';
import { pluralRu } from '../utils/pluralRu';

/** Нейтральная подпись для canvas-карточки и текста шаринга — без формы
 * обращения и рода (как в shareTexts.ts: 1-е лицо или безличное). */
export function practiceCountLabel(count: number | null): string | null {
  if (count == null || count <= 0) return null;
  return `прошли ${count} ${pluralRu(count, 'раз', 'раза', 'раз')}`;
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
        <div className="u-sub12">
          Пройдено уже {count} {pluralRu(count, 'раз', 'раза', 'раз')}
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
          borderRadius: 999,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Поделиться
      </button>
    </div>
  );
}
