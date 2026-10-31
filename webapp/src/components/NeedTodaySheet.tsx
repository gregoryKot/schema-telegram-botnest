import { useState } from 'react';
import type { Need } from '../types';
import { useNeedData } from '../needData';
import { ExScreen, GlyphCheck } from './exercises/ExScreen';
import { NeedAdviceModal } from './NeedAdviceModal';
import { PlanSheet } from './PlanSheet';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
import { NeedScale } from './NeedScale';
import { NEED_HUE, hueStyle } from '../lib/tone';
import { NeedFold } from './NeedFold';
import { rangeCardIndex, wordForValue } from '../../../shared/src/needs/ratingWords';
import '../styles/sheet-tracker.css';
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
  const NEED_DATA = useNeedData();

  const data = NEED_DATA[need.id];
  if (!data) return null;
  const rangeIdx = rangeCardIndex(value);
  const RANGE_VALUES = [2, 6, 8]; // слова «Совсем нет» / «Наполовину» / «В основном да»

  const hue = NEED_HUE[need.id as NeedId];

  return (
    <ExScreen
      onBack={goBack}
      backLabel="Назад к дневнику"
      eyebrow="Оцени сейчас"
      title={<>{need.chartLabel}</>}
      lede={data.question}
      aside={
        <div className="ds-card tk2-aside" style={hueStyle(hue)}>
          <div className="ds-eyebrow tone-text">Сегодня</div>
          <div className="tk2-aside-word tone-text">{wordForValue(value)?.label ?? '—'}</div>
          <div className="u-mb12">
            <NeedScale
              variant="words"
              value={value > 0 ? value : undefined}
              hue={hue}
              onChange={onChange}
              label={need.chartLabel}
              yesterday={yesterdayValue}
            />
          </div>
          {rangeIdx === 2 && (
            <div className="tk2-note tone-tint">
              {tr('Хороший день – заметь это', 'Хороший день – заметьте это')}
            </div>
          )}
          <div className="tk2-tags">
            {data.tags.map(tag => (
              <span key={tag} className="ds-chip ds-chip--sm tone-tint">{tag}</span>
            ))}
          </div>
        </div>
      }
    >
      <div className="tk2-opts" style={hueStyle(hue)}>
        <NeedFold title="Как это выглядит в жизни">
          <div className="tk2-list">
            {data.examples.map((ex, i) => (
              <div key={i} className="tk2-li">
                <span className="tk2-li-mark tone-text">›</span>
                <span className="u-sub14-lh15">{ex}</span>
              </div>
            ))}
          </div>
        </NeedFold>

        {data.reflection?.length > 0 && (
          <NeedFold title="Вопросы для рефлексии">
            <div className="tk2-list">
              {data.reflection.map((q, i) => (
                <div key={i} className="tk2-li">
                  <span className="tk2-li-mark tone-text">?</span>
                  <span className="u-sub14-lh15">{q}</span>
                </div>
              ))}
            </div>
          </NeedFold>
        )}

        <NeedFold title="Как понять оценку">
          <div className="tk2-opts">
            {data.ranges.map((range, i) => {
              const active = i === rangeIdx;
              return (
                <div
                  key={range.label}
                  onClick={() => onChange(RANGE_VALUES[i])}
                  role="button" tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(RANGE_VALUES[i]); } }}
                  className={'ds-card ds-card--row tk2-opt' + (active ? ' is-active' : '')}
                >
                  <div className="ds-head-row">
                    <div className="ds-h3">{range.label}</div>
                    {active && <span className="tone-text"><GlyphCheck /></span>}
                  </div>
                  <div className="ds-sub">{range.description}</div>
                </div>
              );
            })}
          </div>
        </NeedFold>

        {value <= 3 && (
          <div className="ds-card ds-card--row">
            <div className="ds-label">Что с этим сделать?</div>
            <div className="tk2-opts">
              <div
                onClick={() => setShowPlan(true)}
                role="button" tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowPlan(true); } }}
                className="ds-card ds-card--row ds-card--hover tk2-opt"
              >
                <div className="ds-h3">Запланировать шаг на завтра</div>
                <div className="ds-sub">Один маленький шаг – и напомним</div>
              </div>
              {onOpenHelp && (
                <div
                  onClick={() => { onOpenHelp(); goBack(); }}
                  role="button" tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenHelp(); goBack(); } }}
                  className="ds-card ds-card--row ds-card--hover tk2-opt"
                >
                  <div className="ds-h3">Раздел Помощь</div>
                  <div className="ds-sub">Инструменты прямо сейчас</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showPlan && (
        <PlanSheet
          needId={need.id}
          needLabel={need.chartLabel}
          onClose={() => setShowPlan(false)}
          onSaved={() => { setShowPlan(false); onPlanSaved?.(need.id); goBack(); }}
        />
      )}

      {showDisclaimer && <NeedAdviceModal onClose={() => setShowDisclaimer(false)} />}
    </ExScreen>
  );
}
