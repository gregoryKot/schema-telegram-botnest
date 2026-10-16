import { useState } from 'react';
import { pressable } from '../../utils/a11y';
import { SectionLabel } from '../SectionLabel';
import { useTr } from '../../utils/addressForm';
import { useBackLayer } from '../../hooks/backLayers';
import { buildModeCheckin, type ModeCheckinItem } from './modeCheckinData';

const SCRIM = {
  position: 'fixed',
  inset: 0,
  zIndex: 400,
  animation: 'fade-in 150ms ease',
} as const;

// Чек-ин «Режим прямо сейчас»: выбор ощущения → режим и что помогает. Оба шага —
// один слой «Назад» (useBackLayer): кнопка «Назад» хоста закрывает чек-ин, а не
// справочник схем под ним. На экране результата «Назад» закрывает весь чек-ин,
// а не возвращает к выбору — как и тап по фону и «Понятно».
export function ModeCheckinSheet({ onClose }: { onClose: () => void }) {
  const tr = useTr();
  useBackLayer(onClose);
  const [mode, setMode] = useState<ModeCheckinItem | null>(null);

  if (mode) {
    return (
      <div
        style={{
          ...SCRIM,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
        {...pressable(onClose)}
        aria-label="Закрыть"
      >
        <div
          role="presentation"
          onClick={(e) => e.stopPropagation()}
          style={{
            background:
              'linear-gradient(145deg, color-mix(in srgb, var(--accent) 18%, transparent), color-mix(in srgb, var(--accent-blue) 8%, transparent))',
            border:
              '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
            borderRadius: 'var(--r-20)',
            padding: '32px 24px 24px',
            width: '100%',
            maxWidth: 320,
            textAlign: 'center',
            animation: 'sheet-up 0.2s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
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
            {mode.mode}
          </div>
          <div
            style={{
              background: 'rgba(var(--fg-rgb),0.06)',
              borderRadius: 'var(--r-14)',
              padding: '14px 16px',
              marginBottom: 24,
              textAlign: 'left',
            }}
          >
            <div
              style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 6 }}
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
              {mode.tip}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '14px 0',
              border: 'none',
              borderRadius: 'var(--r-14)',
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

  return (
    <div
      style={{
        ...SCRIM,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
      {...pressable(onClose)}
      aria-label="Закрыть"
    >
      <div
        role="presentation"
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
              borderRadius: 'var(--r-2)',
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
            gap: 'var(--space-8)',
          }}
        >
          {buildModeCheckin(tr).map((item) => (
            <div
              key={item.label}
              onClick={() => setMode(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setMode(item);
                }
              }}
              style={{
                background: 'rgba(var(--fg-rgb),0.05)',
                borderRadius: 'var(--r-14)',
                padding: '12px 8px',
                textAlign: 'center',
                cursor: 'pointer',
                border: '1px solid rgba(var(--fg-rgb),0.06)',
              }}
            >
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
