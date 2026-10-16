import type { Need } from '../../types';
import { useNeedData } from '../../needData';
import { NeedScale } from '../../components/NeedScale';
import { NEED_HUE, hueStyle } from '../../lib/tone';
import type { NeedId } from '../../../../shared/src/needs/types';
import { pressable } from '../../utils/a11y';
import { useTr } from '../../utils/addressForm';
import { deltaView } from './model';

interface Props {
  needs: Need[];
  ratings: Record<string, number>;
  yesterdayRatings: Record<string, number>;
  /** Нет обработчика оценки — сегмент ведёт в трекер на эту потребность. */
  onRate?: (needId: string, value: number) => void;
  onOpenNeed: (needId: string) => void;
  onOpenTracker: () => void;
}

// «Потребности сегодня»: строка на потребность — название с квадратиком тона,
// шкала на 10 сегментов (клик ставит оценку), значение и дельта к вчера.
export function NeedsCard({ needs, ratings, yesterdayRatings, onRate, onOpenNeed, onOpenTracker }: Props) {
  const tr = useTr();
  const NEED_DATA = useNeedData();
  return (
    <section className="ds-card ct-section ct-needs">
      <div className="ds-head-row">
        <h3 className="ds-h2">Потребности сегодня</h3>
        <span className="ct-head-aside">
          {onRate && <span className="ds-sub ct-hint">{tr('нажми на шкалу', 'нажмите на шкалу')}</span>}
          <button type="button" className="ds-link" onClick={onOpenTracker}>Изменить →</button>
        </span>
      </div>
      {needs.map(n => {
        const value = ratings[n.id];
        const delta = deltaView(value, yesterdayRatings[n.id]);
        const name = NEED_DATA[n.id]?.name ?? n.chartLabel;
        const hue = NEED_HUE[n.id as NeedId];
        return (
          <div key={n.id} className="ct-need-row">
            <span className="ct-need-name" {...pressable(() => onOpenNeed(n.id))}>
              <span className="ds-dot tone-fill" style={hueStyle(hue)} />
              {name}
            </span>
            <NeedScale
              value={value}
              hue={hue}
              label={name}
              yesterday={yesterdayRatings[n.id]}
              onChange={v => (onRate ? onRate(n.id, v) : onOpenNeed(n.id))}
            />
            <span className={'ds-num ct-need-value' + (value === undefined ? ' is-empty' : '')}>
              {value ?? '–'}
              {delta && <span className={'ct-delta ' + (delta.up ? 'is-up' : 'is-down')}>{delta.text}</span>}
            </span>
          </div>
        );
      })}
    </section>
  );
}
