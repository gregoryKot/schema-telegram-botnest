import {
  QUESTIONS,
  TOTAL_PAGES,
  ANSWER_LABELS,
  getSchemaForQuestion,
  type Phase,
} from '../../hooks/useYsqTest';

interface TestPhaseProps {
  page: number;
  currentAnswer: number | undefined;
  slideKey: number;
  slideDir: 'forward' | 'back';
  handleBack: () => void;
  setPhase: (phase: Phase) => void;
  selectAnswer: (qIdx: number, value: number) => void;
}

// ── Full-screen test phase ────────────────────────────────────────────────────
export function TestPhase({
  page,
  currentAnswer,
  slideKey,
  slideDir,
  handleBack,
  setPhase,
  selectAnswer,
}: TestPhaseProps) {
  const qIdx = page;
  const schema = getSchemaForQuestion(qIdx);
  const progressPct = ((page + 1) / TOTAL_PAGES) * 100;

  return (
    <>
      <style>{`
        @keyframes slideFromRight { from { opacity: 0; transform: translateX(28px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideFromLeft  { from { opacity: 0; transform: translateX(-28px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 300,
          background: 'var(--bg)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ flexShrink: 0, padding: '16px 20px 0' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <button
              onClick={handleBack}
              disabled={page === 0}
              aria-label="Назад"
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                border: 'none',
                background:
                  page === 0 ? 'transparent' : 'rgba(var(--fg-rgb),0.08)',
                color: 'var(--text-sub)',
                fontSize: 16,
                cursor: page === 0 ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: page === 0 ? 0 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              ←
            </button>
            <span
              style={{
                fontSize: 13,
                color: 'var(--text-faint)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {page + 1} / {TOTAL_PAGES}
            </span>
            <button
              onClick={() => setPhase('intro')}
              aria-label="Закрыть"
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                border: 'none',
                background: 'rgba(var(--fg-rgb),0.08)',
                color: 'var(--text-sub)',
                fontSize: 17,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>
          <div
            style={{
              height: 3,
              background: 'rgba(var(--fg-rgb),0.08)',
              borderRadius: 3,
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressPct}%`,
                background: 'var(--accent)',
                borderRadius: 3,
                transition: 'width 0.25s ease',
              }}
            />
          </div>
        </div>

        {/* Question — animated on page change */}
        <div
          key={slideKey}
          style={{
            flex: 1,
            padding: '24px 20px 16px',
            overflowY: 'auto',
            animation: `${slideDir === 'forward' ? 'slideFromRight' : 'slideFromLeft'} 0.22s cubic-bezier(0.25,0.46,0.45,0.94)`,
          }}
        >
          {schema && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: schema.color,
                marginBottom: 12,
              }}
            >
              {schema.name}
            </div>
          )}
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--text)',
              lineHeight: 1.45,
            }}
          >
            {QUESTIONS[qIdx]}
          </div>
        </div>

        {/* Answer buttons */}
        <div
          style={{
            padding: '0 16px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            flexShrink: 0,
          }}
        >
          {ANSWER_LABELS.map((label, i) => {
            const value = i + 1;
            const selected = currentAnswer === value;
            return (
              <button
                key={value}
                onClick={() => selectAnswer(qIdx, value)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '13px 16px',
                  borderRadius: 16,
                  border: `1.5px solid ${selected ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.08)'}`,
                  background: selected
                    ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
                    : 'var(--surface)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'background 0.12s, border-color 0.12s',
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    flexShrink: 0,
                    border: `2px solid ${selected ? 'var(--accent)' : 'rgba(var(--fg-rgb),0.2)'}`,
                    background: selected ? 'var(--accent)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.12s',
                  }}
                >
                  {selected && (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#fff',
                      }}
                    />
                  )}
                </div>
                <span
                  style={{
                    fontSize: 15,
                    color: selected ? 'var(--text)' : 'var(--text-sub)',
                    fontWeight: selected ? 500 : 400,
                  }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
