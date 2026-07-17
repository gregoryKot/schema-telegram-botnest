import { COLORS } from '../../types';
import { NeedId, NeedMetaEntry } from './data';
import { Slider } from './Slider';
import { NeedExamplesPanel } from './NeedExamplesPanel';

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
  value: number;
  onChange: (v: number) => void;
  openExampleId: NeedId | null;
  setOpenExampleId: (id: NeedId | null) => void;
  openExampleIdx: number | null;
  setOpenExampleIdx: (idx: number | null) => void;
}) {
  const color = COLORS[id] ?? '#888';
  const showLow = value <= 5;
  const showHigh = value >= 5;

  return (
    <div style={{ marginBottom: 28 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: color + '1f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          {meta.emoji}
        </div>
        <div style={{ flex: 1 }}>
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
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => {
              setOpenExampleId(openExampleId === id ? null : id);
              setOpenExampleIdx(null);
            }}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
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
            {value}
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: 'var(--text-sub)',
              }}
            >
              /10
            </span>
          </div>
        </div>
      </div>
      <Slider value={value} color={color} onChange={onChange} />
      {/* Anchors */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
          marginTop: 6,
        }}
      >
        <div
          style={{
            fontSize: 11,
            lineHeight: 1.55,
            padding: '7px 9px',
            borderRadius: 10,
            background:
              showLow && value <= 4
                ? 'color-mix(in srgb, var(--accent-red) 10%, transparent)'
                : 'rgba(var(--fg-rgb),0.03)',
            color:
              showLow && value <= 4
                ? 'color-mix(in srgb, var(--accent-red) 75%, transparent)'
                : 'rgba(var(--fg-rgb),0.25)',
            border:
              showLow && value <= 4
                ? '1px solid color-mix(in srgb, var(--accent-red) 20%, transparent)'
                : '1px solid transparent',
            transition: 'all 0.2s',
          }}
        >
          <span
            style={{
              fontWeight: 600,
              display: 'block',
              marginBottom: 2,
            }}
          >
            0 — дефицит
          </span>
          {meta.anchorLow}
        </div>
        <div
          style={{
            fontSize: 11,
            lineHeight: 1.55,
            padding: '7px 9px',
            borderRadius: 10,
            background:
              showHigh && value >= 8
                ? 'color-mix(in srgb, var(--accent-green) 10%, transparent)'
                : 'rgba(var(--fg-rgb),0.03)',
            color:
              showHigh && value >= 8
                ? 'color-mix(in srgb, var(--accent-green) 75%, transparent)'
                : 'rgba(var(--fg-rgb),0.25)',
            border:
              showHigh && value >= 8
                ? '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)'
                : '1px solid transparent',
            transition: 'all 0.2s',
          }}
        >
          <span
            style={{
              fontWeight: 600,
              display: 'block',
              marginBottom: 2,
            }}
          >
            10 — насыщение
          </span>
          {meta.anchorHigh}
        </div>
      </div>
      {/* Examples panel */}
      {openExampleId === id && (
        <NeedExamplesPanel
          meta={meta}
          openExampleIdx={openExampleIdx}
          setOpenExampleIdx={setOpenExampleIdx}
        />
      )}
    </div>
  );
}
