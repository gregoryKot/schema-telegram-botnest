// Пять строк потребностей в листе «Мой портрет» — те же бары, что в
// PortraitCard (реюз NeedBar, правило «одна механика — один компонент»: вид
// бара не копируется вторым файлом). Тап по строке раскрывает короткое
// объяснение потребности — переиспользуем готовый текст NEEDS_EXPLAINER
// (aboutData.ts, тот же контент, что и в онбординге/AboutSheet), третью
// формулировку не пишем (правило «Онбординг»: контент уже выверен).
//
// Аккордеон: раскрыта только одна строка одновременно (повторный тап
// схлопывает), кнопка на всю ширину строки — минимум 44px высоты (хит-таргет)
// и chevron-аффорданс, чтобы кликабельность была видна.
import { useState } from 'react';
import { NeedBar } from './PortraitCard';
import { NEEDS_EXPLAINER } from '../../aboutData';
import { NEED_ORDER } from '../../../../shared/src/needs/types';
import type { PortraitNeed } from '../../../../shared/src/portrait/portraitData';

interface Props {
  needs: PortraitNeed[];
}

// NEEDS_EXPLAINER — плоский массив без id, порядок совпадает с NEED_ORDER
// (тот же приём зиппинга по индексу, что в AboutSheet/DisclaimerNeedsWhatStep).
const EXPLAINER_TEXT: Record<string, string | undefined> = Object.fromEntries(
  NEED_ORDER.map((id, i) => [id, NEEDS_EXPLAINER[i]?.text]),
);

export function PortraitNeedRows({ needs }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const maxCount = Math.max(1, ...needs.map((n) => n.count));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 4 }}>
      {needs.map((n) => {
        const isOpen = expandedId === n.id;
        const explainer = EXPLAINER_TEXT[n.id];
        return (
          <div key={n.id}>
            <button
              onClick={() =>
                setExpandedId((prev) => (prev === n.id ? null : n.id))
              }
              aria-expanded={isOpen}
              style={{
                width: '100%',
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-8)',
                padding: '6px 2px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <div style={{ flex: 1 }}>
                <NeedBar n={n} maxCount={maxCount} />
              </div>
              <span
                aria-hidden
                style={{
                  fontSize: 11,
                  color: 'var(--text-faint)',
                  flexShrink: 0,
                }}
              >
                {isOpen ? '▲' : '▼'}
              </span>
            </button>
            {isOpen && explainer && (
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--text-sub)',
                  lineHeight: 1.6,
                  padding: '0 2px 12px 2px',
                }}
              >
                {explainer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
