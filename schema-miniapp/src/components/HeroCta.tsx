// Крупная акцентная CTA-карточка (дизайн-макет): uppercase-лейбл, чип
// с оценкой времени, заголовок, подпись, белая кнопка. Одна на все экраны
// («Сегодня», «Паттерны», «Режимы») — правило «одна механика — один компонент».
import { pressable } from '../utils/a11y';

interface Props {
  label: string;
  chip: string;
  title: string;
  sub: string;
  buttonLabel: string;
  onClick: () => void;
}

export function HeroCta({
  label,
  chip,
  title,
  sub,
  buttonLabel,
  onClick,
}: Props) {
  return (
    <div
      {...pressable(onClick)}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 24,
        padding: 20,
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        background: 'var(--accent)',
        color: 'var(--on-accent)',
        boxShadow:
          '0 14px 34px color-mix(in srgb, var(--accent) 35%, transparent)',
        animation: 'slide-up 0.3s ease both',
      }}
    >
      {/* Декоративный «дышащий» круг (как на экране «Помощь») */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: -34,
          top: -34,
          width: 140,
          height: 140,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.10)',
          animation: 'hero-breathe 6s ease-in-out infinite',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              opacity: 0.85,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              background: 'rgba(255,255,255,0.22)',
              padding: '4px 10px',
              borderRadius: 99,
              flexShrink: 0,
            }}
          >
            {chip}
          </div>
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            marginTop: 10,
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>
        <div
          style={{ fontSize: 13, opacity: 0.9, marginTop: 6, lineHeight: 1.45 }}
        >
          {sub}
        </div>
        <button
          style={{
            marginTop: 15,
            width: '100%',
            background: '#fff',
            color: 'var(--accent)',
            fontSize: 15,
            fontWeight: 800,
            padding: 13,
            borderRadius: 14,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {buttonLabel}
          <span style={{ fontSize: 17 }}>→</span>
        </button>
      </div>
    </div>
  );
}
