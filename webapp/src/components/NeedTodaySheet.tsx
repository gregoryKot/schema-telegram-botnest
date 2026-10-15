import { useState } from 'react';
import { COLORS, type Need } from '../types';
import { useNeedData } from '../needData';
import { ExScreen, GlyphCheck } from './exercises/ExScreen';
import { NeedAdviceModal } from './NeedAdviceModal';
import { PlanSheet } from './PlanSheet';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { needColor } from '../../../shared/src/needs/needColors';
import { useTr } from '../utils/addressForm';
import { NeedScale } from './NeedScale';
import { NEED_HUE } from '../lib/tone';
import type { NeedId } from '../../../shared/src/needs/types';

interface Props {
  need: Need;
  value: number;
  yesterdayValue?: number;
  onChange: (v: number) => void;
  onClose: () => void;
  onPlanSaved?: (needId: string) => void;
  onOpenHelp?: () => void;
}

export function NeedTodaySheet({ need, value, yesterdayValue, onChange, onClose, onPlanSaved, onOpenHelp }: Props) {
  const goBack = useHistorySheet(onClose);
  const tr = useTr();
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [showReflection, setShowReflection] = useState(false);
  const [showRanges, setShowRanges] = useState(false);
  const NEED_DATA = useNeedData();

  const data = NEED_DATA[need.id];
  if (!data) return null;
  const color = COLORS[need.id] ?? '#888';
  const rangeIdx = value <= 3 ? 0 : value <= 6 ? 1 : 2;
  const RANGE_VALUES = [1, 4, 7];

  return (
    <ExScreen
      onBack={goBack}
      backLabel="Назад к дневнику"
      eyebrow="Оцени сейчас"
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
          <div style={{ marginBottom: 12 }}>
            <NeedScale
              value={value > 0 ? value : undefined}
              hue={NEED_HUE[need.id as NeedId]}
              onChange={onChange}
              label={need.chartLabel}
              size="lg"
              yesterday={yesterdayValue}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-ghost)', marginBottom: 16 }}>
            <span>0</span>
            {typeof yesterdayValue === 'number' && yesterdayValue > 0 ? (
              <span className="u-faint">
                вчера {yesterdayValue}
                {value - yesterdayValue !== 0 && (
                  <span style={{ color, fontWeight: 600 }}>
                    {' '}{value - yesterdayValue > 0 ? `+${value - yesterdayValue}` : value - yesterdayValue}
                  </span>
                )}
              </span>
            ) : <span>5</span>}
            <span>10</span>
          </div>
          {rangeIdx === 2 && (
            <div style={{ padding: '10px 12px', borderRadius: 'var(--r-8)', background: `${color}18`, border: `1px solid ${color}30`, fontSize: 12, color, lineHeight: 1.5 }}>
              {tr('Хороший день – заметь это', 'Хороший день – заметьте это')}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 12 }}>
            {data.tags.map(tag => (
              <span key={tag} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 'var(--r-20)', background: `${color}18`, color }}>
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
        <div className="u-w100">
          <button
            onClick={() => setShowExamples(v => !v)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <div className="prompt-label" style={{ marginBottom: 0 }}>Как это выглядит в жизни</div>
            <span className="u-faint13">{showExamples ? '▴' : '▾'}</span>
          </button>
          {showExamples && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column' }}>
              {data.examples.map((ex, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-10)', padding: '8px 0', borderBottom: i < data.examples.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <span style={{ color, fontSize: 14, flexShrink: 0, lineHeight: 1.5 }}>›</span>
                  <span className="u-sub14-lh15">{ex}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reflection questions */}
      {data.reflection?.length > 0 && (
        <div className="prompt">
          <div className="prompt-num">·</div>
          <div className="u-w100">
            <button
              onClick={() => setShowReflection(v => !v)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <div className="prompt-label" style={{ marginBottom: 0 }}>Вопросы для рефлексии</div>
              <span className="u-faint13">{showReflection ? '▴' : '▾'}</span>
            </button>
            {showReflection && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column' }}>
                {data.reflection.map((q, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-10)', padding: '8px 0', borderBottom: i < data.reflection.length - 1 ? '1px solid var(--line)' : 'none' }}>
                    <span style={{ color, fontSize: 14, flexShrink: 0, lineHeight: 1.5 }}>?</span>
                    <span className="u-sub14-lh15">{q}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ranges */}
      <div className="prompt">
        <div className="prompt-num">·</div>
        <div className="u-w100">
          <button
            onClick={() => setShowRanges(v => !v)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <div className="prompt-label" style={{ marginBottom: 0 }}>Как понять оценку</div>
            <span className="u-faint13">{showRanges ? '▴' : '▾'}</span>
          </button>
          {showRanges && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.ranges.map((range, i) => {
                const active = i === rangeIdx;
                return (
                  <div
                    key={range.label}
                    onClick={() => onChange(RANGE_VALUES[i])}
                    role="button" tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(RANGE_VALUES[i]); } }}
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
          <div className="u-w100">
            <div className="prompt-label">Что с этим сделать?</div>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
              <div
                onClick={() => setShowPlan(true)}
                role="button" tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowPlan(true); } }}
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
                  role="button" tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenHelp(); goBack(); } }}
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
          needColor={needColor(need.id)}
          needLabel={need.chartLabel}
          color={color}
          onClose={() => setShowPlan(false)}
          onSaved={() => { setShowPlan(false); onPlanSaved?.(need.id); goBack(); }}
        />
      )}

      {showDisclaimer && <NeedAdviceModal onClose={() => setShowDisclaimer(false)} />}
    </ExScreen>
  );
}
