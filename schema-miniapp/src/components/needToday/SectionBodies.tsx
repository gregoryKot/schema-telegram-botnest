import { useNeedData } from '../../needData';
import { pressable } from '../../utils/a11y';

// Тела раскрывающихся секций листа потребности: примеры из жизни,
// вопросы для рефлексии и шкала оценок. Вынесено из NeedTodaySheet.tsx
// (правило №10); общий скелет раскрывашки — в CollapsibleSection.
type NeedData = ReturnType<typeof useNeedData>[string];

export function ExamplesBody({
  data,
  color,
}: {
  data: NeedData;
  color: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {data.examples.map((ex, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-10)',
            padding: '8px 0',
            borderBottom:
              i < data.examples.length - 1
                ? '1px solid rgba(var(--fg-rgb),0.05)'
                : 'none',
          }}
        >
          <span
            style={{
              color,
              fontSize: 14,
              flexShrink: 0,
              lineHeight: 1.5,
            }}
          >
            ›
          </span>
          <span
            style={{
              fontSize: 14,
              color: 'var(--text-sub)',
              lineHeight: 1.5,
            }}
          >
            {ex}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ReflectionBody({
  data,
  color,
}: {
  data: NeedData;
  color: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {data.reflection.map((q, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-10)',
            padding: '8px 0',
            borderBottom:
              i < data.reflection.length - 1
                ? '1px solid rgba(var(--fg-rgb),0.05)'
                : 'none',
          }}
        >
          <span
            style={{
              color,
              fontSize: 14,
              flexShrink: 0,
              lineHeight: 1.5,
            }}
          >
            ?
          </span>
          <span
            style={{
              fontSize: 14,
              color: 'var(--text-sub)',
              lineHeight: 1.5,
            }}
          >
            {q}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RangesBody({
  data,
  color,
  rangeIdx,
  onChange,
}: {
  data: NeedData;
  color: string;
  rangeIdx: number;
  onChange: (v: number) => void;
}) {
  const RANGE_VALUES = [1, 4, 7];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {data.ranges.map((range, i) => {
        const active = i === rangeIdx;
        return (
          <div
            key={range.label}
            {...pressable(() => onChange(RANGE_VALUES[i]))}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-10)',
              background: active ? color + '33' : 'rgba(var(--fg-rgb),0.04)',
              border: `1px solid ${active ? color + '55' : 'rgba(var(--fg-rgb),0.08)'}`,
              borderRadius: 'var(--r-12)',
              padding: '10px 12px',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: active ? color : 'rgba(var(--fg-rgb),0.2)',
                flexShrink: 0,
                marginTop: 4,
              }}
            />
            <div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: active ? color : 'rgba(var(--fg-rgb),0.35)',
                  marginRight: 6,
                }}
              >
                {range.label}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: active
                    ? 'rgba(var(--fg-rgb),0.85)'
                    : 'rgba(var(--fg-rgb),0.4)',
                  lineHeight: 1.5,
                }}
              >
                {range.description}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
