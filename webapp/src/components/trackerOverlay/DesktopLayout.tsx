import { PickerRail } from './PickerRail';
import type { LayoutProps } from './types';

export function DesktopLayout({
  need,
  color,
  value,
  needName,
  extra,
  idx,
  needsLength,
  handleChange,
  setDetailNeed,
  delta,
  topbar,
  footer,
  steps,
  detailSheet,
}: LayoutProps & { delta: number | null }) {
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
    >
      {topbar}
      {/* Hero header */}
      <div
        style={{
          padding: '24px 80px 20px',
          borderBottom: '1px solid rgba(var(--fg-rgb),0.07)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 40,
          }}
        >
          <div>
            <div
              className="eyebrow"
              style={{
                marginBottom: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                color,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--serif)',
                  fontStyle: 'italic',
                  fontSize: 14,
                  textTransform: 'none',
                  letterSpacing: 0,
                  color: 'var(--text-ghost)',
                }}
              >
                {String(idx + 1).padStart(2, '0')} /{' '}
                {String(needsLength).padStart(2, '0')}
              </span>
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
            <h1
              style={{
                fontFamily: 'var(--serif)',
                fontSize: 64,
                fontWeight: 400,
                lineHeight: 0.96,
                letterSpacing: '-0.025em',
                color: 'var(--text)',
                margin: 0,
              }}
            >
              <button
                onClick={() => setDetailNeed(need)}
                style={{ all: 'unset', cursor: 'pointer' }}
              >
                {needName}
              </button>
              <span style={{ marginLeft: 14, fontSize: 48 }}>
                {need.emoji}
              </span>
            </h1>
            {extra?.desc && (
              <p
                style={{
                  margin: '10px 0 0',
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: 'var(--text-sub)',
                  maxWidth: 520,
                }}
              >
                {extra.desc}
              </p>
            )}
          </div>
          {steps}
        </div>
      </div>
      {/* 3 columns */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1.25fr 1fr',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* Left – question */}
        <div
          style={{
            padding: '28px 28px 28px 80px',
            borderRight: '1px solid rgba(var(--fg-rgb),0.07)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          <div
            className="eyebrow"
            style={{ marginBottom: 16, color: 'var(--text-faint)' }}
          >
            вопрос дня
          </div>
          <p
            style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 21,
              lineHeight: 1.4,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            {extra?.question ?? ''}
          </p>
          {delta !== null && delta !== 0 && (
            <div
              style={{
                marginTop: 'auto',
                paddingTop: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--serif)',
                  fontStyle: 'italic',
                  fontSize: 13,
                  color: 'var(--text-faint)',
                }}
              >
                вчера
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: delta > 0 ? 'var(--c-moss)' : 'var(--c-rose)',
                }}
              >
                {delta > 0 ? '+' : ''}
                {delta}
              </span>
            </div>
          )}
        </div>
        {/* Center – picker */}
        <div
          style={{
            padding: '28px 44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRight: '1px solid rgba(var(--fg-rgb),0.07)',
          }}
        >
          <PickerRail
            value={value}
            onChange={(v) => handleChange(need.id, v)}
            color={color}
          />
        </div>
        {/* Right – examples */}
        <div
          style={{
            padding: '28px 80px 28px 28px',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          <div
            className="eyebrow"
            style={{ marginBottom: 16, color: 'var(--text-faint)' }}
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
                  gridTemplateColumns: '24px 1fr',
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
                    fontSize: 15,
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
