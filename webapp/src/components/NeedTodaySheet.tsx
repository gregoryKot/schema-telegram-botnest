import { useState } from 'react';
import type { Need } from '../types';
import { useNeedData } from '../needData';
import { ExScreen, GlyphCheck } from './exercises/ExScreen';
import { PlanSheet } from './PlanSheet';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useTr } from '../utils/addressForm';
import { NeedScale } from './NeedScale';
import { NEED_HUE, hueStyle } from '../lib/tone';
import { NeedFold } from './NeedFold';
import { NeedTodayActions } from './NeedTodayActions';
import { needDataStyle } from './needDataColor';
import { rangeCardIndex, wordForValue } from '../../../shared/src/needs/ratingWords';
import { needLook } from '../../../shared/src/theme/entityLook';
import { glue } from '../../../shared/src/utils/typo';
import '../styles/sheet-tracker.css';
import type { NeedId } from '../../../shared/src/needs/types';
import { api } from '../api';
import { useNotifyReach } from '../../../shared/src/settings/useNotifyReach';
import { planStepHint } from '../../../shared/src/practices/planReminderCopy';

interface Props {
  need: Need;
  value: number;
  yesterdayValue?: number;
  onChange: (v: number) => void;
  onClose: () => void;
  onPlanSaved?: (needId: string) => void;
  onOpenHelp?: () => void;
}

// Лист «Подробнее о потребности» (редизайн 2026-11, APP_2026-11.md, b07): та же шапка, что у вопроса
// трекера, — лист бумаги потребности с её знаком (ExScreen look = needLook), на компьютере
// разворотом слева. Сразу под шапкой — «Сегодня» со шкалой, ниже складки и при низкой оценке
// плитки «Что с этим сделать?». «Хороший день» — бумага потребности, а не розовая плашка.
export function NeedTodaySheet({ need, value, yesterdayValue, onChange, onClose, onPlanSaved, onOpenHelp }: Props) {
  const goBack = useHistorySheet(onClose);
  const tr = useTr();
  const [showPlan, setShowPlan] = useState(false);
  const NEED_DATA = useNeedData();
  const notifyReach = useNotifyReach(api.getSettings); // «напомним» — только если дойдёт (U5)

  const data = NEED_DATA[need.id];
  if (!data) return null;
  const rangeIdx = rangeCardIndex(value);
  const RANGE_VALUES = [2, 6, 8]; // слова «Совсем нет» / «Наполовину» / «В основном да»

  const hue = NEED_HUE[need.id as NeedId];

  return (
    <ExScreen
      onBack={goBack}
      backLabel="Назад к трекеру"
      look={needLook(need.id as NeedId)}
      spread
      eyebrow={tr('Оцени сейчас', 'Оцените сейчас')}
      title={need.chartLabel}
      lede={data.question}
    >
      <div className="tk2-sheet" style={{ ...hueStyle(hue), ...needDataStyle(need.id) }}>
        <section className="tk2-today">
          <div className="tk2-today-head">
            <span className="ds-label">Сегодня</span>
            <span className="tk2-today-word">{wordForValue(value)?.label ?? '—'}</span>
          </div>
          <NeedScale
            value={value > 0 ? value : undefined}
            hue={hue}
            needId={need.id}
            onChange={onChange}
            label={need.chartLabel}
            yesterday={yesterdayValue}
          />
          {rangeIdx === 2 && (
            <p className="pp-paper tk2-good">
              {glue(tr('Хороший день – заметь это', 'Хороший день – заметьте это'))}
            </p>
          )}
          <div className="tk2-tags">
            {data.tags.map(tag => (
              <span key={tag} className="ds-chip tk2-tag">{tag}</span>
            ))}
          </div>
        </section>

        <div className="tk2-folds">
          <NeedFold title="Как это выглядит в жизни">
            <ul className="tk2-list">
              {data.examples.map((ex, i) => <li key={i} className="tk2-li">{glue(ex)}</li>)}
            </ul>
          </NeedFold>

          {data.reflection?.length > 0 && (
            <NeedFold title="Вопросы для рефлексии">
              <ul className="tk2-list tk2-list--q">
                {data.reflection.map((q, i) => <li key={i} className="tk2-li">{glue(q)}</li>)}
              </ul>
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
                    className={'tk2-opt' + (active ? ' is-active' : '')}
                  >
                    <div className="ds-head-row">
                      <div className="ds-h3">{range.label}</div>
                      {active && <GlyphCheck />}
                    </div>
                    <div className="ds-sub">{glue(range.description)}</div>
                  </div>
                );
              })}
            </div>
          </NeedFold>
        </div>

        {value <= 3 && (
          <NeedTodayActions
            planHint={planStepHint(notifyReach)}
            onPlan={() => setShowPlan(true)}
            onHelp={onOpenHelp && (() => { onOpenHelp(); goBack(); })}
          />
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
    </ExScreen>
  );
}
