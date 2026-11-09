// Лист дня в истории: колесо потребностей на бумаге трекера (ENTITY_LOOK.tracker) и ссылки
// «детство →», «Что за этим стоит →». На компьютере лист стоит колонкой слева и не уезжает
// при прокрутке списка справа (history.css, .sd-day-side).
import type { CSSProperties } from 'react';
import type { Need } from '../../types';
import { NeedsWheel } from '../../../../shared/src/components/NeedsWheel';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { Wheel } from '../art/PaperArtSigns';
import { NEED_INK } from './needInk';

interface Props {
  date: string;
  needs: Need[];
  ratings: Record<string, number>;
  prevRatings: Record<string, number>;
  childhoodRatings: Partial<Record<string, number>>;
  onTapNeed: (n: Need) => void;
  onIndexInfo: () => void;
  onOpenSchemas?: () => void;
  onOpenChildhoodWheel?: () => void;
}

export function DayWheel(p: Props) {
  const hasChildhood = Object.keys(p.childhoodRatings).length > 0;
  return (
    <div className="pp-paper sd-wheel" style={{ '--h': ENTITY_LOOK.tracker.hue } as CSSProperties}>
      <div key={p.date}>
        <NeedsWheel needs={p.needs} ratings={p.ratings} prevRatings={p.prevRatings} childhoodRatings={p.childhoodRatings}
          ink={NEED_INK} onClickNeed={p.onTapNeed} onClickCenter={p.onIndexInfo} />
      </div>
      {(hasChildhood || p.onOpenChildhoodWheel || p.onOpenSchemas) && (
        <div className="sd-links">
          {hasChildhood ? (
            <button onClick={p.onOpenChildhoodWheel} className="ds-link sd-link-art"><Wheel size="row" />детство →</button>
          ) : p.onOpenChildhoodWheel ? (
            <button onClick={p.onOpenChildhoodWheel} className="ds-link sd-link-art"><Wheel size="row" />Оценить детство →</button>
          ) : null}
          {p.onOpenSchemas && <button onClick={p.onOpenSchemas} className="ds-link">Что за этим стоит →</button>}
        </div>
      )}
    </div>
  );
}
