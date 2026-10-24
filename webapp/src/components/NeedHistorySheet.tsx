import { useState } from 'react';
import { useTr } from '../utils/addressForm';
import { hitboxStyle } from '../utils/hitbox';
import type { Need, DayHistory } from '../types';
import { useNeedData } from '../needData';
import { ExScreen } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { NeedAdviceModal } from './NeedAdviceModal';
import { NEED_HUE, hueStyle } from '../lib/tone';
import type { NeedId } from '../../../shared/src/needs/types';
import '../styles/sheet-tracker.css';

interface Props {
  need: Need;
  value: number;
  history: DayHistory[];
  childhoodValue?: number;
  onClose: () => void;
}

export function NeedHistorySheet({ need, value, history, childhoodValue, onClose }: Props) {
  const tr = useTr();
  const goBack = useHistorySheet(onClose);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const NEED_DATA = useNeedData();
  // Случайная доля для выбора совета — фиксируется один раз при монтировании.
  // Хук объявляется ДО раннего `return null` ниже (react-hooks/rules-of-hooks);
  // индекс выводится из неё уже после гварда, по актуальному пулу.
  const [tipRand] = useState(() => Math.random());
  const data = NEED_DATA[need.id];
  if (!data) return null;
  const hue = NEED_HUE[need.id as NeedId];

  const scores = history.map(d => d.ratings[need.id] ?? 0);
  const n = scores.length;
  const recentAvg = n > 0 ? scores.slice(0, Math.min(3, n)).reduce((s, v) => s + v, 0) / Math.min(3, n) : 0;
  const olderAvg  = n > 0 ? scores.slice(-Math.min(3, n)).reduce((s, v) => s + v, 0) / Math.min(3, n) : 0;
  const trendDiff = recentAvg - olderAvg;
  const trendLabel = trendDiff > 0.5 ? '↑ Растёт' : trendDiff < -0.5 ? '↓ Падает' : '→ Стабильно';
  const trendTone = trendDiff > 0.5 ? ' is-up' : trendDiff < -0.5 ? ' is-down' : '';
  const trendSign = trendDiff >= 0 ? '+' : '';

  const tipKey = value <= 3 ? 'low' : value <= 6 ? 'medium' : 'high';
  const tipPool = data.tips[tipKey];
  const tipIdx = Math.floor(tipRand * tipPool.length);
  const tip = tipPool[tipIdx];

  // Sparkline
  const reversed = [...history].reverse();
  const W = 240; const H = 52;
  const xStep = reversed.length > 1 ? W / (reversed.length - 1) : W / 2;
  const yFor = (v: number) => v === 0 ? H - 2 : (H - 8) - ((v - 1) / 9) * (H - 12) + 4;
  const pts = reversed.map((d, i) => ({ x: i * xStep, y: yFor(d.ratings[need.id] ?? 0) }));
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const lastPt = pts.length > 0 ? pts[pts.length - 1] : null;
  const areaPath = lastPt ? `${linePath} L ${lastPt.x.toFixed(1)} ${H} L 0 ${H} Z` : '';

  return (
    <ExScreen
      onBack={goBack}
      backLabel="Назад"
      eyebrow={need.chartLabel}
      title={<>Динамика<br /><span className="it">потребности</span></>}
      lede={data.explanation}
      aside={
        <div className="ds-card tk2-aside" style={hueStyle(hue)}>
          <div className="ds-eyebrow tone-text">За 7 дней</div>
          <div className="tk2-trend tone-text">{trendLabel}</div>
          <div className={'tk2-trend-sub' + trendTone}>
            {trendSign}{trendDiff.toFixed(1)} к предыдущей неделе
          </div>
          {reversed.length > 1 && (
            <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="tk2-chart">
              <path d={areaPath} className="tk2-area" />
              <path d={linePath} className="tk2-line" />
              {lastPt && <circle cx={lastPt.x} cy={lastPt.y} r={3} className="tk2-dot-pt" />}
              {childhoodValue !== undefined && (() => {
                const cy = yFor(childhoodValue);
                return <>
                  <line x1={0} y1={cy} x2={W} y2={cy} className="tk2-ref" strokeWidth={1} />
                  <text x={W - 2} y={cy - 3} textAnchor="end" className="tk2-ref-t">детство {childhoodValue}</text>
                </>;
              })()}
            </svg>
          )}
          {childhoodValue !== undefined && (
            <div className="tk2-child">
              <div className="ds-label">В детстве</div>
              <div className="tk2-aside-nums">
                <span className="ds-num tone-text" style={{ fontSize: 36 }}>{childhoodValue}</span>
                <span className="u-faint13">/10</span>
                {recentAvg > 0 && (
                  <span className="ds-sub">
                    → сейчас {recentAvg.toFixed(1)} {recentAvg > childhoodValue ? '↑' : recentAvg < childhoodValue ? '↓' : ''}
                  </span>
                )}
              </div>
              <p className="ds-sub" style={{ lineHeight: 1.55, margin: '6px 0 0' }}>
                {childhoodValue <= 4
                  ? 'Давняя чувствительная зона – вероятно паттерн, а не ситуация'
                  : 'В детстве удовлетворялась. Если сейчас низко – скорее истощение'}
              </p>
            </div>
          )}
        </div>
      }
    >
      <div className="tk2-opts" style={hueStyle(hue)}>
        {data.tags.length > 0 && (
          <div className="tk2-tags">
            {data.tags.map(tag => (
              <span key={tag} className="ds-chip tone-tint">{tag}</span>
            ))}
          </div>
        )}

        <div className="ds-card">
          <div className="ds-label">{tr('Попробуй сегодня', 'Попробуйте сегодня')}</div>
          <p className="tk2-para" style={{ marginTop: 8, fontSize: 15, lineHeight: 1.65 }}>
            {tip}
            {/* Зона 44×44 вокруг видимых 16×16; marginLeft −8 (= 6 зазор − 14 растяжки) оставляют «?» в строке текста. */}
            <button
              onClick={() => setShowDisclaimer(true)}
              aria-label="Пояснение"
              className="tk2-help"
              style={hitboxStyle(16, 16, 44).outer}
            >
              <span className="tk2-help-in" style={hitboxStyle(16, 16, 44).inner}>?</span>
            </button>
          </p>
        </div>
      </div>

      {showDisclaimer && <NeedAdviceModal onClose={() => setShowDisclaimer(false)} />}
    </ExScreen>
  );
}
