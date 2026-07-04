import { useRef, useCallback, useState, useEffect } from 'react';
import { COLORS } from '../types';
import type { Need } from '../types';
import { useNeedData } from '../needData';
import { ExScreen, GlyphCheck } from './exercises/ExScreen';
import { getTherapistContact } from '../utils/therapistContact';
import { PlanSheet } from './PlanSheet';
import { useHistorySheet } from '../hooks/useHistorySheet';

interface Props {
  need: Need;
  value: number;
  yesterdayValue?: number;
  onChange: (v: number) => void;
  onClose: () => void;
  onPlanSaved?: (needId: string) => void;
  onOpenHelp?: () => void;
}

const DISCLAIMER_CONTENT = [
  'Дневник помогает видеть паттерны и чуть лучше понимать себя.',
  'Советы внутри – это приглашение к размышлению, не инструкция.',
  'Если чувствуешь, что что-то важное требует внимания – терапия это место, где можно разобраться по-настоящему. Безопасно, глубоко, рядом живой человек.',
];

export function NeedTodaySheet({ need, value, onChange, onClose, onPlanSaved, onOpenHelp }: Props) {
  const goBack = useHistorySheet(onClose);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [showRanges, setShowRanges] = useState(false);
  const NEED_DATA = useNeedData();
  const data = NEED_DATA[need.id];
  if (!data) return null;
  const color = COLORS[need.id] ?? '#888';
  const rangeIdx = value <= 3 ? 0 : value <= 6 ? 1 : 2;
  const RANGE_VALUES = [1, 4, 7];

  // Inline slider – prevent iOS scroll container from stealing touch events
  const trackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    el.addEventListener('touchstart', prevent, { passive: false });
    return () => el.removeEventListener('touchstart', prevent);
  }, []);
  const calcValue = useCallback((clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    onChange(Math.round(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * 10));
  }, [onChange]);
  const onPtrDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    calcValue(e.clientX);
  }, [calcValue]);
  const onPtrMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0) return;
    calcValue(e.clientX);
  }, [calcValue]);

  return (
    <ExScreen
      onBack={goBack}
      backLabel="Назад к дневнику"
      eyebrow={`${data.emoji} Оцени сейчас`}
      eyebrowColor={color}
      title={<>{need.chartLabel}</>}
      lede={data.question}
      aside={
        <div className="aside-card" style={{ borderColor: `${color}40`, background: `${color}08`, position: 'sticky', top: 40 }}>
          <div className="aside-card-eyebrow" style={{ color }}>Сегодня</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 64, lineHeight: 1, color }}>{value}</span>
            <span style={{ fontSize: 16, color: 'var(--text-faint)' }}>/10</span>
          </div>
          <div
            ref={trackRef}
            onPointerDown={onPtrDown}
            onPointerMove={onPtrMove}
            style={{ position: 'relative', padding: '12px 0', cursor: 'pointer', touchAction: 'none', userSelect: 'none', marginBottom: 8 }}
          >
            <div style={{ height: 6, borderRadius: 6, background: 'var(--surface-2)', overflow: 'hidden' }}>
              <div style={{ width: `${value * 10}%`, height: '100%', borderRadius: 6, background: `linear-gradient(to right, ${color}55, ${color})` }} />
            </div>
            <div style={{
              position: 'absolute', left: `${value * 10}%`, top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 20, height: 20, borderRadius: '50%',
              background: color, border: '2px solid var(--bg)',
              pointerEvents: 'none',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-ghost)', marginBottom: 16 }}>
            <span>0</span><span>5</span><span>10</span>
          </div>
          {rangeIdx === 2 && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: `${color}18`, border: `1px solid ${color}30`, fontSize: 12, color, lineHeight: 1.5 }}>
              Хороший день – заметь это 🌿
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 12 }}>
            {data.tags.map(tag => (
              <span key={tag} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: `${color}18`, color }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      }
    >
      {/* Mobile slider (shown when aside collapses) */}
      <div style={{ display: 'none' }} className="mobile-slider-placeholder" />

      {/* Examples */}
      <div className="prompt">
        <div className="prompt-num">·</div>
        <div style={{ width: '100%' }}>
          <button
            onClick={() => setShowExamples(v => !v)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <div className="prompt-label" style={{ marginBottom: 0 }}>Как это выглядит в жизни</div>
            <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>{showExamples ? '▴' : '▾'}</span>
          </button>
          {showExamples && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column' }}>
              {data.examples.map((ex, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: i < data.examples.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <span style={{ color, fontSize: 14, flexShrink: 0, lineHeight: 1.5 }}>›</span>
                  <span style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.5 }}>{ex}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ranges */}
      <div className="prompt">
        <div className="prompt-num">·</div>
        <div style={{ width: '100%' }}>
          <button
            onClick={() => setShowRanges(v => !v)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <div className="prompt-label" style={{ marginBottom: 0 }}>Как понять оценку</div>
            <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>{showRanges ? '▴' : '▾'}</span>
          </button>
          {showRanges && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.ranges.map((range, i) => {
                const active = i === rangeIdx;
                return (
                  <div
                    key={range.label}
                    onClick={() => onChange(RANGE_VALUES[i])}
                    className={'mode-card ' + (active ? 'is-selected' : '')}
                    style={{ '--mode-color': color } as React.CSSProperties}
                  >
                    <span className="mode-card-stripe" />
                    <div>
                      <div className="mode-card-name">{range.label}</div>
                      <div className="mode-card-short">{range.description}</div>
                    </div>
                    {active && <span className="mode-check"><GlyphCheck /></span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Plan + Help (low score) */}
      {value <= 3 && (
        <div className="prompt">
          <div className="prompt-num">·</div>
          <div style={{ width: '100%' }}>
            <div className="prompt-label">Что с этим сделать?</div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                onClick={() => setShowPlan(true)}
                className="mode-card"
                style={{ '--mode-color': color } as React.CSSProperties}
              >
                <span className="mode-card-stripe" />
                <div>
                  <div className="mode-card-name">Запланировать шаг на завтра</div>
                  <div className="mode-card-short">Один маленький шаг – и напомним</div>
                </div>
              </div>
              {onOpenHelp && (
                <div
                  onClick={() => { onOpenHelp(); goBack(); }}
                  className="mode-card"
                  style={{ '--mode-color': 'var(--c-rose)' } as React.CSSProperties}
                >
                  <span className="mode-card-stripe" />
                  <div>
                    <div className="mode-card-name">Раздел Помощь</div>
                    <div className="mode-card-short">Инструменты прямо сейчас</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showPlan && (
        <PlanSheet
          needId={need.id}
          needEmoji={data.emoji}
          needLabel={need.chartLabel}
          color={color}
          onClose={() => setShowPlan(false)}
          onSaved={() => { setShowPlan(false); onPlanSaved?.(need.id); goBack(); }}
        />
      )}

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
