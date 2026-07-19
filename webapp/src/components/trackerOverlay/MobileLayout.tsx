import { PickerRail } from './PickerRail';
import type { LayoutProps } from './types';

export function MobileLayout({
  need,
  color,
  value,
  needName,
  extra,
  handleChange,
  setDetailNeed,
  onTS,
  onTE,
  topbar,
  footer,
  steps,
  detailSheet,
}: LayoutProps & {
  onTS: (e: React.TouchEvent) => void;
  onTE: (e: React.TouchEvent) => void;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onTouchStart={onTS}
      onTouchEnd={onTE}
    >
      {topbar}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div
            className="eyebrow"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color,
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: 3,
                background: 'currentColor',
                display: 'inline-block',
              }}
            />
            <span>{extra?.subtitle ?? ''}</span>
          </div>
          {steps}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 14,
          }}
        >
          <div style={{ flex: 1 }}>
            <button
              onClick={() => setDetailNeed(need)}
              style={{ all: 'unset', cursor: 'pointer' }}
            >
              <h1
                style={{
                  fontFamily: 'var(--serif)',
                  fontSize: 34,
                  fontWeight: 400,
                  lineHeight: 1.0,
                  letterSpacing: '-0.02em',
                  color: 'var(--text)',
                  margin: 0,
                }}
              >
                {needName}
              </h1>
            </button>
            {extra?.desc && (
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-sub)',
                  lineHeight: 1.55,
                  marginTop: 6,
                }}
              >
                {extra.desc}
              </div>
            )}
          </div>
          <span style={{ fontSize: 38, lineHeight: 1, flexShrink: 0 }}>
            {need.emoji}
          </span>
        </div>
        <div
          style={{
            padding: '14px 0',
            borderTop: '1px solid rgba(var(--fg-rgb),0.07)',
            borderBottom: '1px solid rgba(var(--fg-rgb),0.07)',
            marginBottom: 20,
          }}
        >
          <div
            className="eyebrow"
            style={{ marginBottom: 10, color: 'var(--text-faint)' }}
          >
            вопрос дня
          </div>
          <p
            style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 17,
              lineHeight: 1.45,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            {extra?.question ?? ''}
          </p>
        </div>
        <div style={{ marginBottom: 24 }}>
          <PickerRail
            value={value}
            onChange={(v) => handleChange(need.id, v)}
            color={color}
          />
        </div>
        <div
          style={{
            paddingTop: 4,
            borderTop: '1px solid rgba(var(--fg-rgb),0.07)',
          }}
        >
          <div
            className="eyebrow"
            style={{ marginBottom: 12, color: 'var(--text-faint)' }}
          >
            что считается
          </div>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {(extra?.examples ?? []).map((ex, i, arr) => (
              <li
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '20px 1fr',
                  gap: 10,
                  padding: '10px 0',
                  borderBottom:
                    i < arr.length - 1
                      ? '1px solid rgba(var(--fg-rgb),0.07)'
                      : 'none',
                  alignItems: 'start',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--serif)',
                    fontStyle: 'italic',
                    fontSize: 14,
                    color: 'var(--text-ghost)',
                  }}
                >
                  {i + 1}.
                </span>
                <span
                  style={{
                    fontSize: 13,
                    lineHeight: 1.55,
                    color: 'var(--text-sub)',
                  }}
                >
                  {ex}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {footer}
      {detailSheet}
    </div>
  );
}
