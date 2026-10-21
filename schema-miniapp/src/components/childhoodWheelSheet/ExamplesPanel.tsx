import { exampleTone } from '../../../../shared/src/childhoodWheel/childhoodWheel';
import { pressable } from '../../utils/a11y';
import type { NeedMetaEntry } from './types';

const TONE_COLOR = {
  low: 'var(--accent-red)',
  mid: 'var(--accent-yellow)',
  high: 'var(--accent-green)',
} as const;

// Примеры «как это выглядит в жизни» под ползунком потребности: раскрывается
// один пример за раз. Сами истории – в shared (общие с сайтом).
export function ExamplesPanel({
  examples,
  openIdx,
  setOpenIdx,
}: {
  examples: NeedMetaEntry['examples'];
  openIdx: number | null;
  setOpenIdx: (i: number | null) => void;
}) {
  return (
    <div
      style={{
        marginTop: 10,
        borderRadius: 'var(--r-12)',
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
      {examples.map((ex, i) => {
        const badgeColor = TONE_COLOR[exampleTone(ex.score)];
        const isOpen = openIdx === i;
        return (
          <div
            key={i}
            {...pressable(() => setOpenIdx(isOpen ? null : i))}
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
            <div className="u-ac8">
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 'var(--r-20)',
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
