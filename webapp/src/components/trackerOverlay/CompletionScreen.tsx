import type { Need } from '../../types';

export function CompletionScreen({
  needs,
  effectiveRatings,
  isBackfill,
  onDone,
  goBack,
}: {
  needs: Need[];
  effectiveRatings: Record<string, number>;
  isBackfill: boolean;
  onDone?: () => void;
  goBack: () => void;
}) {
  const allVals = needs.map((n) => effectiveRatings[n.id] ?? 0);
  const avgIdx = allVals.reduce((a, b) => a + b, 0) / allVals.length;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--accent-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            fontSize: 28,
          }}
        >
          ✓
        </div>
        <h2
          style={{
            fontFamily: 'var(--serif)',
            fontSize: 44,
            fontWeight: 400,
            color: 'var(--text)',
            lineHeight: 1.0,
            marginBottom: 20,
            letterSpacing: '-0.02em',
          }}
        >
          Заполнено
        </h2>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'center',
            gap: 4,
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 72,
              color: 'var(--text)',
              lineHeight: 1,
              letterSpacing: '-0.03em',
              fontWeight: 400,
            }}
          >
            {avgIdx.toFixed(1)}
          </span>
          <span
            style={{
              fontSize: 20,
              color: 'var(--text-sub)',
              paddingBottom: 6,
            }}
          >
            /10
          </span>
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-faint)',
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            fontWeight: 600,
            marginBottom: 36,
          }}
        >
          индекс дня
        </div>
        <button
          onClick={isBackfill ? (onDone ?? goBack) : goBack}
          style={{
            padding: '13px 40px',
            borderRadius: 10,
            border: 'none',
            background: 'var(--text)',
            color: 'var(--bg)',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Готово
        </button>
      </div>
    </div>
  );
}
