import { useTr } from '../../utils/addressForm';
import type { ModeCheckinItem } from './modeCheckinData';

interface Props {
  items: ModeCheckinItem[];
  onClose: () => void;
  onSelect: (item: ModeCheckinItem) => void;
}

export function ModeCheckinSelector({ items, onClose, onSelect }: Props) {
  const tr = useTr();
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        animation: 'fade-in 150ms ease',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--sheet-bg)',
          borderRadius: '24px 24px 0 0',
          padding: '20px 20px 48px',
          animation: 'sheet-up 300ms cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: 'rgba(var(--fg-rgb),0.12)',
              margin: '0 auto 16px',
            }}
          />
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 4,
            textAlign: 'center',
          }}
        >
          {tr('Как ты сейчас?', 'Как вы сейчас?')}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            marginBottom: 20,
            textAlign: 'center',
          }}
        >
          {tr(
            'Выбери самое близкое ощущение',
            'Выберите самое близкое ощущение',
          )}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 8,
          }}
        >
          {items.map((item) => (
            <div
              key={item.label}
              onClick={() => onSelect(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(item);
                }
              }}
              style={{
                background: 'rgba(var(--fg-rgb),0.05)',
                borderRadius: 14,
                padding: '12px 8px',
                textAlign: 'center',
                cursor: 'pointer',
                border: '1px solid rgba(var(--fg-rgb),0.06)',
              }}
            >
              <div style={{ fontSize: 26, marginBottom: 6 }}>{item.emoji}</div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-sub)',
                  lineHeight: 1.4,
                }}
              >
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
