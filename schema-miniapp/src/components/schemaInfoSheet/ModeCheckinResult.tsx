import { SectionLabel } from '../SectionLabel';
import type { ModeCheckinItem } from './modeCheckinData';

interface Props {
  item: ModeCheckinItem;
  onClose: () => void;
}

export function ModeCheckinResult({ item, onClose }: Props) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        animation: 'fade-in 150ms ease',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background:
            'linear-gradient(145deg, color-mix(in srgb, var(--accent) 18%, transparent), rgba(79,163,247,0.08))',
          border:
            '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
          borderRadius: 24,
          padding: '32px 24px 24px',
          width: '100%',
          maxWidth: 320,
          textAlign: 'center',
          animation: 'sheet-up 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div style={{ fontSize: 56, marginBottom: 12 }}>{item.emoji}</div>
        <SectionLabel purple mb={8}>
          Режим
        </SectionLabel>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 16,
          }}
        >
          {item.mode}
        </div>
        <div
          style={{
            background: 'rgba(var(--fg-rgb),0.06)',
            borderRadius: 14,
            padding: '14px 16px',
            marginBottom: 24,
            textAlign: 'left',
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: 'var(--accent)',
              marginBottom: 6,
            }}
          >
            Что помогает
          </div>
          <div
            style={{
              fontSize: 14,
              color: 'rgba(var(--fg-rgb),0.8)',
              lineHeight: 1.6,
            }}
          >
            {item.tip}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '14px 0',
            border: 'none',
            borderRadius: 14,
            background: 'color-mix(in srgb, var(--accent) 25%, transparent)',
            color: 'var(--accent)',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Понятно
        </button>
      </div>
    </div>
  );
}
