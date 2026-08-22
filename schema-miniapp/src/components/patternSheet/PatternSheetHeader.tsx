// Шапка экрана паттерна: опознаватель (IdentityDot) + название + подпись
// (домен схемы / группа режима) + явная кнопка «Назад» (зона ≥44×44).
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { cm } from '../../sections/schemas/utils';

interface Props {
  color: string;
  name: string;
  subtitle?: string;
  onBack: () => void;
}

export function PatternSheetHeader({ color, name, subtitle, onBack }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-12)',
        marginBottom: 18,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 'var(--r-14)',
          flexShrink: 0,
          background: cm(color, 9),
          border: `1px solid ${cm(color, 16)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IdentityDot color={color} size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text)',
            letterSpacing: '-0.3px',
          }}
        >
          {name}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12, fontWeight: 500, color, marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>
      <button
        onClick={onBack}
        aria-label="Назад"
        style={{
          minWidth: 44,
          minHeight: 44,
          borderRadius: 'var(--r-12)',
          border: '1px solid var(--border-color)',
          background: 'var(--surface-2)',
          color: 'var(--text-sub)',
          fontSize: 20,
          fontFamily: 'inherit',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        ‹
      </button>
    </div>
  );
}
