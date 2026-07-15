import { COLORS, YESTERDAY } from '../types';
import { NeedRatingBar } from './NeedRatingBar';

// P1/P2 (UI-аудит СДВГ): оценка ставится ДИСКРЕТНЫМ ТАПОМ (общий контрол
// NeedRatingBar — тот же, что в карточке-детали), а не перетаскиванием.
// Открытие карточки-объяснения — отдельной явной кнопкой «?» с зоной ≥44px.

const HINTS: Record<string, string> = {
  attachment: 'близость · связь',
  autonomy: 'свобода · выбор',
  expression: 'честность · голос',
  play: 'игра · лёгкость',
  limits: 'уважение · защита',
};

function NeedIcon({ id, color }: { id: string; color: string }) {
  const props = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: color,
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (id) {
    case 'attachment':
      return (
        <svg {...props}>
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      );
    case 'autonomy':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      );
    case 'expression':
      return (
        <svg {...props}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'play':
      return (
        <svg {...props}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case 'limits':
      return (
        <svg {...props}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    default:
      return null;
  }
}

interface Props {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
  onOpenDetail?: () => void;
  justSaved?: boolean;
}

export function NeedSlider({
  id,
  label,
  value,
  onChange,
  onOpenDetail,
  justSaved,
}: Props) {
  const color = COLORS[id] ?? '#888';
  const v = value ?? 0;
  const yv = YESTERDAY[id] ?? 0;

  return (
    <div style={{ marginBottom: 22 }}>
      {/* Header: иконка + название, справа оценка и кнопка объяснения */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            flexShrink: 0,
            background: color + '1f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <NeedIcon id={id} color={color} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 500,
              color: 'var(--text)',
              lineHeight: 1.2,
            }}
          >
            {label}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 3 }}>
            {HINTS[id] ?? ''}
          </div>
        </div>

        {/* Оценка */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 2,
            flexShrink: 0,
          }}
        >
          {justSaved && (
            <span
              aria-hidden
              style={{
                fontSize: 13,
                color,
                marginRight: 2,
                animation: 'fade-in 0.2s ease',
              }}
            >
              ✓
            </span>
          )}
          {v > 0 ? (
            <>
              <span style={{ fontSize: 19, fontWeight: 700, color }}>{v}</span>
              <span style={{ fontSize: 12, color: 'var(--text-sub)' }}>
                /10
              </span>
            </>
          ) : (
            <span style={{ fontSize: 15, color: 'var(--text-faint)' }}>—</span>
          )}
        </div>

        {/* Явная кнопка объяснения — зона ≥44px */}
        <button
          onClick={onOpenDetail}
          aria-label="Что это, примеры и советы"
          style={{
            width: 44,
            height: 44,
            flexShrink: 0,
            marginRight: -10,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: 'rgba(var(--fg-rgb),0.08)',
              color: 'var(--text-sub)',
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ?
          </span>
        </button>
      </div>

      <NeedRatingBar
        color={color}
        value={value}
        yesterday={yv}
        onChange={onChange}
      />
    </div>
  );
}
