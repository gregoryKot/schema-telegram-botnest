import type { CSSProperties, ReactNode } from 'react';
import type { Need } from '../../types';
import { NeedArt } from '../art/NeedArt';
import { Strokes } from '../art/PaperArt';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { glue } from '../../../../shared/src/utils/typo';
import { pressable } from '../../utils/a11y';
import { needLevel } from './historyMath';
import { dayStrokeValues } from '../../../../shared/src/needs/dayStrokes';
import { inkVars } from './needInk';
import { DayWheel } from './DayWheel';
import { AttentionCard } from './AttentionCard';
import { DayNote } from './DayNote';
interface Props {
  date: string;
  needs: Need[];
  ratings: Record<string, number>;
  prevRatings: Record<string, number>;
  childhoodRatings: Partial<Record<string, number>>;
  isToday: boolean;
  ratedCount: number;
  historyLen: number;
  needsLow: Need[];
  isTherapist: boolean;
  bookingLink: ReactNode;
  noteText: string | null;
  noteTags: string[];
  onTapNeed: (n: Need) => void;
  onIndexInfo: () => void;
  onOpenNote: () => void;
  onOpenSchemas?: () => void;
  onOpenChildhoodWheel?: () => void;
  onBackfill?: (date: string) => void;
}

/** Вид «День»: лист дня с колесом (на компьютере — колонкой слева), оценки, внимание, заметка. */
export function HistoryDayView(p: Props) {
  const low = p.needsLow[0];
  return (
    <div className="sd-day-grid">
      <div className="sd-day-side">
        <DayWheel date={p.date} needs={p.needs} ratings={p.ratings} prevRatings={p.prevRatings} childhoodRatings={p.childhoodRatings}
          onTapNeed={p.onTapNeed} onIndexInfo={p.onIndexInfo} onOpenSchemas={p.onOpenSchemas} onOpenChildhoodWheel={p.onOpenChildhoodWheel} />
      </div>
      <div className="sd-col">
        {p.onBackfill && !p.isToday && (
          <div className="pp-paper sd-fill-day" style={{ '--h': ENTITY_LOOK.tracker.hue } as CSSProperties} {...pressable(() => p.onBackfill?.(p.date))}>
            <span className="sd-fill-day-sign" aria-hidden="true"><Strokes values={dayStrokeValues(p.ratings)} size="row" /></span>
            <div className="ds-list-body">
              <div className="ds-list-title">{p.ratedCount === 0 ? 'Заполнить этот день' : 'Дополнить оценки'}</div>
              <div className="ds-sub">{p.ratedCount === 0 ? 'Оценки не заполнены' : `Заполнено ${p.ratedCount} из ${p.needs.length}`}</div>
            </div>
            <span className="ds-chev" aria-hidden="true" />
          </div>
        )}
        <div className="ds-card ds-card--flush">
          {p.needs.map(n => {
            const val = p.ratings[n.id] ?? 0;
            const lvl = needLevel(val);
            return (
              <div key={n.id} className="ds-list-row ds-list-row--hover sd-need-row" style={inkVars(n.id) as CSSProperties} {...pressable(() => p.onTapNeed(n))}>
                <span className="pp-row-art"><NeedArt id={n.id} size="row" /></span>
                <span className="sd-need-name">{n.chartLabel}</span>
                {lvl && <span className={'sd-need-level ds-idx-' + lvl.level}>{lvl.label}</span>}
                <span className={'ds-num sd-need-val' + (val > 0 ? '' : ' is-empty')}>{val > 0 ? val : '–'}</span>
              </div>
            );
          })}
        </div>
        {low && (
          <AttentionCard need={low}>
            <div className="ds-label">Стоит уделить внимание</div>
            <div className="sd-low-name">{low.chartLabel}</div>
            <div className="ds-sub">
              Остаётся низкой несколько дней подряд.{!p.isTherapist && ' Терапевт поможет разобраться.'}
            </div>
            {p.bookingLink}
          </AttentionCard>
        )}
        <DayNote text={p.noteText} tags={p.noteTags} onOpen={p.onOpenNote} />
        {p.historyLen < 3 && (
          <div className="sd-hint">
            {glue(`Ещё ${3 - p.historyLen} ${3 - p.historyLen === 1 ? 'день' : 'дня'} – и паттерн начнёт проявляться`)}
          </div>
        )}
      </div>
    </div>
  );
}
