import { useState } from 'react';
import { useTr } from '../utils/addressForm';
import { Need, DayHistory, COLORS } from '../types';
import { useNeedData } from '../needData';
import { BottomSheet } from './BottomSheet';
import { SectionLabel } from './SectionLabel';
import { NeedSheetHeader } from './NeedSheetHeader';
import { NeedDisclaimerSheet } from './NeedDisclaimerSheet';

interface Props {
  need: Need;
  value: number;
  history: DayHistory[];
  childhoodValue?: number;
  onClose: () => void;
}

export function NeedHistorySheet({
  need,
  value,
  history,
  childhoodValue,
  onClose,
}: Props) {
  const tr = useTr();
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const NEED_DATA = useNeedData();
  // Случайная доля для выбора совета — фиксируется один раз при монтировании.
  // Хук объявляется ДО раннего `return null` ниже (rules-of-hooks); индекс
  // выводится из неё уже после гварда, по актуальному пулу.
  const [tipRand] = useState(() => Math.random());
  const data = NEED_DATA[need.id];
  if (!data) return null;
  const color = COLORS[need.id] ?? '#888';

  // Trend
  const scores = history.map((d) => d.ratings[need.id] ?? 0);
  const n = scores.length;
  const recentCount = Math.min(3, n);
  const olderCount = Math.min(3, n);
  const recentAvg =
    recentCount > 0
      ? scores.slice(0, recentCount).reduce((s, v) => s + v, 0) / recentCount
      : 0;
  const olderAvg =
    olderCount > 0
      ? scores.slice(-olderCount).reduce((s, v) => s + v, 0) / olderCount
      : 0;
  const trendDiff = recentAvg - olderAvg;
  const trendLabel =
    trendDiff > 0.5 ? 'Растёт' : trendDiff < -0.5 ? 'Падает' : 'Стабильно';
  const trendSign = trendDiff >= 0 ? '+' : '';

  // Random tip from level-appropriate pool — stable for this sheet instance
  const tipKey = value <= 3 ? 'low' : value <= 6 ? 'medium' : 'high';
  const tipPool = data.tips[tipKey];
  const tipIdx = Math.floor(tipRand * tipPool.length);
  const tip = tipPool[tipIdx];

  // Sparkline
  const reversed = [...history].reverse();
  const W = 200,
    H = 48;
  const xStep = reversed.length > 1 ? W / (reversed.length - 1) : W / 2;
  const yFor = (v: number) =>
    v === 0 ? H - 2 : H - 8 - ((v - 1) / 9) * (H - 12) + 4;
  const pts = reversed.map((d, i) => ({
    x: i * xStep,
    y: yFor(d.ratings[need.id] ?? 0),
  }));
  const polyStr = pts
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const linePath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const lastPt = pts.length > 0 ? pts[pts.length - 1] : null;
  const areaPath = lastPt
    ? `${linePath} L ${lastPt.x.toFixed(1)} ${H} L 0 ${H} Z`
    : '';

  return (
    <BottomSheet onClose={onClose}>
      <NeedSheetHeader
        need={need}
        data={data}
        color={color}
        onClose={onClose}
        keyboardAccessible
      />

      {/* Section 1: 7-day sparkline */}
      <div style={{ marginBottom: 24 }}>
        <SectionLabel>За 7 дней</SectionLabel>
        <div
          style={{
            background: 'rgba(var(--fg-rgb),0.04)',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <svg
            width={200}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            style={{ flex: 1 }}
          >
            <defs>
              <linearGradient
                id={`sheet-area-${need.id}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#sheet-area-${need.id})`} />
            <polyline
              points={polyStr}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {lastPt && (
              <circle cx={lastPt.x} cy={lastPt.y} r={3} fill={color} />
            )}
            {childhoodValue !== undefined &&
              (() => {
                const cy = yFor(childhoodValue);
                return (
                  <>
                    <line
                      x1={0}
                      y1={cy}
                      x2={W}
                      y2={cy}
                      stroke={color}
                      strokeWidth={1}
                      strokeDasharray="4 3"
                      strokeOpacity={0.45}
                    />
                    <text
                      x={W - 2}
                      y={cy - 3}
                      textAnchor="end"
                      fontSize={8}
                      fill={color}
                      fillOpacity={0.6}
                    >
                      детство {childhoodValue}
                    </text>
                  </>
                );
              })()}
          </svg>
          <div style={{ flexShrink: 0, textAlign: 'right' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color }}>
              {trendLabel}
            </div>
            <div
              style={{ fontSize: 12, color: 'var(--text-sub)', marginTop: 2 }}
            >
              {trendSign}
              {trendDiff.toFixed(1)} за неделю
            </div>
          </div>
        </div>
      </div>

      {/* Childhood context — shown if data exists */}
      {childhoodValue !== undefined && (
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              background:
                childhoodValue <= 4
                  ? 'color-mix(in srgb, var(--accent-red) 8%, transparent)'
                  : 'color-mix(in srgb, var(--accent-green) 8%, transparent)',
              border: `1px solid ${childhoodValue <= 4 ? 'color-mix(in srgb, var(--accent-red) 20%, transparent)' : 'color-mix(in srgb, var(--accent-green) 20%, transparent)'}`,
              borderRadius: 14,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 28, flexShrink: 0 }}>🌱</div>
            <div>
              <div
                style={{
                  fontSize: 12,
                  color:
                    childhoodValue <= 4
                      ? 'var(--accent-red)'
                      : 'var(--accent-green)',
                  fontWeight: 500,
                  marginBottom: 3,
                }}
              >
                Детство: {childhoodValue}/10
                {recentAvg > 0 && childhoodValue > 0 && (
                  <span
                    style={{
                      color: 'var(--text-sub)',
                      fontWeight: 400,
                      marginLeft: 8,
                    }}
                  >
                    → сейчас {recentAvg.toFixed(1)}{' '}
                    {recentAvg > childhoodValue
                      ? '↑'
                      : recentAvg < childhoodValue
                        ? '↓'
                        : ''}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-sub)',
                  lineHeight: 1.5,
                }}
              >
                {childhoodValue <= 4
                  ? 'Эта потребность давно чувствительна — вероятно, это не просто плохой период, а паттерн. Схема-терапия работает именно с этим.'
                  : 'В детстве эта зона была достаточно удовлетворена. Если сейчас низко — скорее всего ситуативное истощение.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 2: Random tip */}
      <div style={{ marginBottom: 24 }}>
        <SectionLabel>
          {tr('Попробуй сегодня', 'Попробуйте сегодня')}
        </SectionLabel>
        <div
          style={{
            background: 'rgba(var(--fg-rgb),0.04)',
            borderRadius: 14,
            padding: '14px 16px',
          }}
        >
          <div
            style={{
              fontSize: 15,
              color: 'rgba(var(--fg-rgb),0.85)',
              lineHeight: 1.6,
            }}
          >
            {tip}
            <span
              onClick={(e) => {
                e.stopPropagation();
                setShowDisclaimer(true);
              }}
              role="button"
              tabIndex={0}
              aria-label="Пояснение"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowDisclaimer(true);
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: 'rgba(var(--fg-rgb),0.1)',
                color: 'var(--text-sub)',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer',
                marginLeft: 6,
                verticalAlign: 'middle',
              }}
            >
              ?
            </span>
          </div>
        </div>
      </div>

      {showDisclaimer && (
        <NeedDisclaimerSheet onClose={() => setShowDisclaimer(false)} />
      )}

      {/* Section 3: Explanation */}
      <div>
        <SectionLabel>Об этой потребности</SectionLabel>
        <div
          style={{ fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.6 }}
        >
          {data.explanation}
        </div>
      </div>
    </BottomSheet>
  );
}
