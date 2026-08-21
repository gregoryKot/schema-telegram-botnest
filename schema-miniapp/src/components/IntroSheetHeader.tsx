import type { ReactNode } from 'react';
import { cm } from '../sections/schemas/utils';

// Шапка интро-шита (иконка + заголовок + подзаголовок, плашка description,
// explainer) — вынесена из IntroSheetShell.tsx (правило №10 CLAUDE.md: шелл
// подошёл к потолку 218). Различия между режимами/схемами — только пропсы,
// вёрстка не меняется ни на пиксель.
export interface IntroSheetHeaderProps {
  /** Иконка слева от заголовка: эмодзи схемы (строка) или, для режимов,
   *  цветной кружок опознавателя (`<IdentityDot color={...} />`, волна 6). */
  emoji: ReactNode;
  title: string;
  subtitle: string;
  accentColor: string;
  description?: string;
  showDescription: boolean;
  /** Пояснение «откуда это и зачем» (правило онбординга) под шапкой. */
  explainer?: string;
  /** Доп. действие в шапке справа от названия (например «Про режим»). */
  headerAction?: ReactNode;
}

export function IntroSheetHeader({
  emoji,
  title,
  subtitle,
  accentColor,
  description,
  showDescription,
  explainer,
  headerAction,
}: IntroSheetHeaderProps) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            flexShrink: 0,
            background: cm(accentColor, 9),
            border: `1px solid ${cm(accentColor, 16)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
          }}
        >
          {emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '-0.3px',
              margin: 0,
            }}
          >
            {title}
          </h2>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: accentColor,
              marginTop: 2,
            }}
          >
            {subtitle}
          </div>
        </div>
        {headerAction}
      </div>

      {showDescription && (
        <div
          style={{
            background: cm(accentColor, 5),
            border: `1px solid ${cm(accentColor, 13)}`,
            borderRadius: 16,
            padding: '12px 14px',
            marginBottom: 16,
          }}
        >
          <div
            style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}
          >
            {description}
          </div>
        </div>
      )}

      {explainer && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-faint)',
            lineHeight: 1.5,
            marginBottom: 16,
          }}
        >
          {explainer}
        </div>
      )}
    </>
  );
}

/** Круглая кнопка-иконка в шапке (44×44 — минимальная зона нажатия). */
export function HeaderInfoButton({
  onClick,
  label = 'Про режим',
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        width: 44,
        height: 44,
        flexShrink: 0,
        borderRadius: 12,
        border: '1px solid var(--border-color)',
        background: 'var(--surface-2)',
        color: 'var(--text-sub)',
        fontSize: 17,
        cursor: 'pointer',
      }}
    >
      ⓘ
    </button>
  );
}
