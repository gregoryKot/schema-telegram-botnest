import { NeedMetaEntry } from './data';

export function NeedExamplesPanel({
  meta,
  openExampleIdx,
  setOpenExampleIdx,
}: {
  meta: NeedMetaEntry;
  openExampleIdx: number | null;
  setOpenExampleIdx: (idx: number | null) => void;
}) {
  return (
    <div
      style={{
        marginTop: 10,
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid color-mix(in srgb, var(--accent) 15%, transparent)',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
          fontSize: 11,
          color: 'var(--text-sub)',
          fontWeight: 500,
        }}
      >
        Примеры — как это выглядит в жизни
      </div>
      {meta.examples.map((ex, i) => {
        const badgeColor =
          ex.score <= 3
            ? 'var(--accent-red)'
            : ex.score < 8
              ? 'var(--accent-yellow)'
              : 'var(--accent-green)';
        const isOpen = openExampleIdx === i;
        return (
          <div
            key={i}
            onClick={() => setOpenExampleIdx(isOpen ? null : i)}
            style={{
              padding: '10px 12px',
              cursor: 'pointer',
              borderTop:
                i === 0 ? 'none' : '1px solid rgba(var(--fg-rgb),0.05)',
              background: isOpen
                ? 'rgba(var(--fg-rgb),0.04)'
                : 'rgba(var(--fg-rgb),0.02)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 20,
                  background: badgeColor + '22',
                  color: badgeColor,
                  flexShrink: 0,
                }}
              >
                ≈{ex.score}/10
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-faint)',
                  marginLeft: 'auto',
                }}
              >
                {isOpen ? '▴' : '▾'}
              </span>
            </div>
            {isOpen && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-sub)',
                  lineHeight: 1.6,
                  marginTop: 8,
                }}
              >
                {ex.text}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
