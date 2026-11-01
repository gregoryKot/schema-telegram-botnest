import { COLORS } from '../../types';
import { hitboxStyle } from '../../utils/hitbox';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { LOW_NEED_MAX } from '../../../../shared/src/childhoodWheel/childhoodWheel';
import { AnchorCard } from './AnchorCard';
import { ExamplesPanel } from './ExamplesPanel';
import { Slider } from './Slider';
import type { NeedId, NeedMetaEntry } from './types';

export function NeedFillRow({
  id,
  meta,
  value,
  onChange,
  openExampleId,
  setOpenExampleId,
  openExampleIdx,
  setOpenExampleIdx,
}: {
  id: NeedId;
  meta: NeedMetaEntry;
  value: number | undefined;
  onChange: (v: number) => void;
  openExampleId: NeedId | null;
  setOpenExampleId: React.Dispatch<React.SetStateAction<NeedId | null>>;
  openExampleIdx: number | null;
  setOpenExampleIdx: React.Dispatch<React.SetStateAction<number | null>>;
}) {
  const color = COLORS[id] ?? '#888';
  const showLow = value !== undefined && value <= 5;
  const showHigh = value !== undefined && value >= 5;
  return (
    <div className="u-mb28">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-12)',
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--r-10)',
            background: color + '1f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <IdentityDot id={id} size={12} />
        </div>
        <div className="u-flex1">
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text)',
              lineHeight: 1.2,
            }}
          >
            {meta.label}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-sub)',
              marginTop: 2,
              lineHeight: 1.4,
            }}
          >
            {meta.question}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-8)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => {
              setOpenExampleId(openExampleId === id ? null : id);
              setOpenExampleIdx(null);
            }}
            style={hitboxStyle(24, 24, 44).outer}
          >
            <span
              style={{
                ...hitboxStyle(24, 24, 44).inner,
                borderRadius: '50%',
                background:
                  openExampleId === id
                    ? 'color-mix(in srgb, var(--accent) 30%, transparent)'
                    : 'rgba(var(--fg-rgb),0.08)',
                color:
                  openExampleId === id
                    ? 'var(--accent)'
                    : 'rgba(var(--fg-rgb),0.35)',
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              ?
            </span>
          </button>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color,
              minWidth: 28,
              textAlign: 'right',
            }}
          >
            {value ?? '—'}
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: 'var(--text-sub)',
              }}
            >
              {value === undefined ? ' не оценено' : '/10'}
            </span>
          </div>
        </div>
      </div>
      <Slider
        value={value}
        color={color}
        onChange={onChange}
        label={meta.label}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-8)',
          marginTop: 6,
        }}
      >
        <AnchorCard
          active={showLow && (value ?? 0) <= LOW_NEED_MAX}
          color="var(--accent-red)"
          title="0 — дефицит"
          text={meta.anchorLow}
        />
        <AnchorCard
          active={showHigh && (value ?? 0) >= 8}
          color="var(--accent-green)"
          title="10 — насыщение"
          text={meta.anchorHigh}
        />
      </div>
      {openExampleId === id && (
        <ExamplesPanel
          examples={meta.examples}
          openIdx={openExampleIdx}
          setOpenIdx={setOpenExampleIdx}
        />
      )}
    </div>
  );
}
