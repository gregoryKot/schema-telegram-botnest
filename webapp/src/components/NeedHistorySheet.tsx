import { useState } from 'react';
import { useTr } from '../utils/addressForm';
import { COLORS } from '../types';
import type { Need, DayHistory } from '../types';
import { NEED_DATA } from '../needData';
import { ExScreen } from './exercises/ExScreen';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { getTherapistContact } from '../utils/therapistContact';

const DISCLAIMER_CONTENT = [
  'Дневник помогает видеть паттерны и чуть лучше понимать себя.',
  'Советы внутри – это приглашение к размышлению, не инструкция.',
  'Если чувствуешь, что что-то важное требует внимания – терапия это место, где можно разобраться по-настоящему. Безопасно, глубоко, рядом живой человек.',
];

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
  const data = NEED_DATA[need.id];
  if (!data) return null;
  const color = COLORS[need.id] ?? '#888';

  const scores = history.map(d => d.ratings[need.id] ?? 0);
  const n = scores.length;
  const recentAvg = n > 0 ? scores.slice(0, Math.min(3, n)).reduce((s, v) => s + v, 0) / Math.min(3, n) : 0;
  const olderAvg  = n > 0 ? scores.slice(-Math.min(3, n)).reduce((s, v) => s + v, 0) / Math.min(3, n) : 0;
  const trendDiff = recentAvg - olderAvg;
  const trendLabel = trendDiff > 0.5 ? '↑ Растёт' : trendDiff < -0.5 ? '↓ Падает' : '→ Стабильно';
  const trendColor = trendDiff > 0.5 ? 'var(--c-moss)' : trendDiff < -0.5 ? 'var(--c-rose)' : 'var(--text-sub)';
  const trendSign = trendDiff >= 0 ? '+' : '';

  const tipKey = value <= 3 ? 'low' : value <= 6 ? 'medium' : 'high';
  const tipPool = data.tips[tipKey];
  const [tipIdx] = useState(() => Math.floor(Math.random() * tipPool.length));
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
      eyebrow={`${data.emoji} ${need.chartLabel}`}
      eyebrowColor={color}
      title={<>Динамика<br /><span className="it">потребности</span></>}
      lede={data.explanation}
      aside={
        <div className="aside-card" style={{ borderColor: `${color}40`, background: `${color}08`, position: 'sticky', top: 40 }}>
          <div className="aside-card-eyebrow" style={{ color }}>За 7 дней</div>
          <div style={{ fontSize: 28, fontWeight: 700, color, marginBottom: 2 }}>{trendLabel}</div>
          <div style={{ fontSize: 13, color: trendColor, marginBottom: 16 }}>
            {trendSign}{trendDiff.toFixed(1)} к предыдущей неделе
          </div>
          {reversed.length > 1 && (
            <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ marginBottom: 16 }}>
              <defs>
                <linearGradient id={`sh-area-${need.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <path d={areaPath} fill={`url(#sh-area-${need.id})`} />
              <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {lastPt && <circle cx={lastPt.x} cy={lastPt.y} r={3} fill={color} />}
              {childhoodValue !== undefined && (() => {
                const cy = yFor(childhoodValue);
                return <>
                  <line x1={0} y1={cy} x2={W} y2={cy} stroke={color} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.45} />
                  <text x={W - 2} y={cy - 3} textAnchor="end" fontSize={8} fill={color} fillOpacity={0.6}>детство {childhoodValue}</text>
                </>;
              })()}
            </svg>
          )}
          {childhoodValue !== undefined && (
            <div style={{ paddingTop: 14, borderTop: `1px solid ${color}22` }}>
              <div className="aside-card-eyebrow">В детстве</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 36, color }}>{childhoodValue}</span>
                <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>/10</span>
                {recentAvg > 0 && (
                  <span style={{ fontSize: 13, color: 'var(--text-sub)', marginLeft: 4 }}>
                    → сейчас {recentAvg.toFixed(1)} {recentAvg > childhoodValue ? '↑' : recentAvg < childhoodValue ? '↓' : ''}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-sub)', lineHeight: 1.55, marginTop: 6 }}>
                {childhoodValue <= 4
                  ? 'Давняя чувствительная зона – вероятно паттерн, а не ситуация'
                  : 'В детстве удовлетворялась. Если сейчас низко – скорее истощение'}
              </p>
            </div>
          )}
        </div>
      }
    >
      {/* Tags */}
      {data.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 36 }}>
          {data.tags.map(tag => (
            <span key={tag} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 999, background: `${color}18`, color, fontWeight: 500 }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Tip */}
      <div className="prompt">
        <div className="prompt-num">·</div>
        <div>
          <div className="prompt-label">{tr('Попробуй сегодня', 'Попробуйте сегодня')}</div>
          <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.65 }}>
            {tip}
            <button
              onClick={() => setShowDisclaimer(true)}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: 'var(--surface-2)', color: 'var(--text-faint)', fontSize: 10, fontWeight: 700, cursor: 'pointer', border: 'none', marginLeft: 6, verticalAlign: 'middle' }}
            >?</button>
          </p>
        </div>
      </div>

      {/* Disclaimer modal */}
      {showDisclaimer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end' }} onClick={() => setShowDisclaimer(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '24px 24px 48px', width: '100%', maxWidth: 560, margin: '0 auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--surface-3)', margin: '0 auto 20px' }} />
            <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 16 }}>О советах</div>
            {DISCLAIMER_CONTENT.map((p, i) => (
              <p key={i} style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.7, marginBottom: 14 }}>{p}</p>
            ))}
            <a href={getTherapistContact().url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', fontSize: 14, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
              → Поговорить с психологом
            </a>
          </div>
        </div>
      )}
    </ExScreen>
  );
}
