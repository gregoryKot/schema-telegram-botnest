import type { ReactNode } from 'react';
import type { Need } from '../../types';
import type { NeedId } from '../../../../shared/src/needs/types';
import { NeedsWheel } from '../../../../shared/src/components/NeedsWheel';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { NEED_HUE, hueStyle } from '../../lib/tone';
import { pressable } from '../../utils/a11y';
import { needLevel } from './historyMath';

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

/** Вид «День»: колесо, оценки потребностей, подсказка про низкую, заметка. */
export function HistoryDayView(p: Props) {
  const hasChildhood = Object.keys(p.childhoodRatings).length > 0;
  const low = p.needsLow[0];
  return (
    <div className="sd-col">
      <div key={p.date}>
        <NeedsWheel needs={p.needs} ratings={p.ratings} prevRatings={p.prevRatings}
          childhoodRatings={p.childhoodRatings}
          onClickNeed={p.onTapNeed} onClickCenter={p.onIndexInfo} />
      </div>

      {(hasChildhood || p.onOpenChildhoodWheel || p.onOpenSchemas) && (
        <div className="sd-links">
          {hasChildhood ? (
            <button onClick={p.onOpenChildhoodWheel} className="ds-link">детство →</button>
          ) : p.onOpenChildhoodWheel ? (
            <button onClick={p.onOpenChildhoodWheel} className="ds-link">Оценить детство →</button>
          ) : null}
          {p.onOpenSchemas && <button onClick={p.onOpenSchemas} className="ds-link">Что за этим стоит →</button>}
        </div>
      )}

      {p.onBackfill && !p.isToday && (
        <div className="ds-card ds-card--row ds-card--hover sd-backfill" {...pressable(() => p.onBackfill?.(p.date))}>
          <div>
            <div className="sd-backfill-title">{p.ratedCount === 0 ? 'Заполнить этот день' : 'Дополнить оценки'}</div>
            <div className="ds-sub">{p.ratedCount === 0 ? 'Оценки не заполнены' : `Заполнено ${p.ratedCount} из ${p.needs.length}`}</div>
          </div>
          <span className="ds-sub">→</span>
        </div>
      )}

      <div className="ds-card ds-card--flush">
        {p.needs.map(n => {
          const val = p.ratings[n.id] ?? 0;
          const lvl = needLevel(val);
          return (
            <div key={n.id} className="ds-list-row ds-list-row--hover sd-need-row" style={hueStyle(NEED_HUE[n.id as NeedId])} {...pressable(() => p.onTapNeed(n))}>
              <IdentityDot id={n.id} size={14} />
              <span className="sd-need-name">{n.chartLabel}</span>
              {lvl && <span className={'sd-need-level ds-idx-' + lvl.level}>{lvl.label}</span>}
              <span className={'ds-num sd-need-val' + (val > 0 ? ' tone-text' : ' is-empty')}>{val > 0 ? val : '–'}</span>
            </div>
          );
        })}
      </div>

      {low && (
        <div className="ds-card ds-card--row sd-low" style={hueStyle(NEED_HUE[low.id as NeedId])}>
          <div className="ds-label">Стоит уделить внимание</div>
          <div className="sd-low-name tone-ink">{low.chartLabel}</div>
          <div className="ds-sub">
            Остаётся низкой несколько дней подряд.{!p.isTherapist && ' Терапевт поможет разобраться.'}
          </div>
          {p.bookingLink}
        </div>
      )}

      <div className="ds-card ds-card--row ds-card--hover sd-note" {...pressable(p.onOpenNote)}>
        <span className={'sd-note-text' + (p.noteText ? '' : ' is-empty')}>{p.noteText || 'Добавить заметку к этому дню'}</span>
        {p.noteText && <span className="ds-sub">›</span>}
      </div>
      {p.noteTags.length > 0 && (
        <div className="sd-tags">
          {p.noteTags.map(tag => <span key={tag} className="ds-badge">{tag}</span>)}
        </div>
      )}

      {p.historyLen < 3 && (
        <div className="sd-hint">
          Ещё {3 - p.historyLen} {3 - p.historyLen === 1 ? 'день' : 'дня'} – и паттерн начнёт проявляться
        </div>
      )}
    </div>
  );
}
