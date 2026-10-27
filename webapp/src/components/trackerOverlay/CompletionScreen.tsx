import type { Need } from '../../types';
import { DayShareButton } from '../../share/DayShareButton';
import { useNeedData } from '../../needData';
import { formatDateString } from '../../../../shared/src/utils/calendarDate';
import { DayBars } from './DayBars';
import { completionHeadline, lowestObservation, nextUnrated, summarizeDay } from './trackerFlow';

/** Экран «Готово»: индекс дня (или «N из M», пока оценены не все), пять столбиков, одно наблюдение (если оценены все), куда дальше. */
export function CompletionScreen({
  needs,
  effectiveRatings,
  isBackfill,
  date,
  onDone,
  goBack,
  onReview,
  onOpenNote,
  onOpenHistory,
}: {
  needs: Need[];
  effectiveRatings: Record<string, number>;
  isBackfill: boolean;
  /** Дата backfill-дня (YYYY-MM-DD); undefined = сегодня */
  date?: string;
  onDone?: () => void;
  goBack: () => void;
  /** Вернуться к вопросам: «Поправить ответы» — к первому, «Дооценить» — к первому пустому. */
  onReview: (idx: number) => void;
  onOpenNote?: () => void;
  onOpenHistory?: () => void;
}) {
  const NEED_DATA = useNeedData();
  const ids = needs.map((n) => n.id);
  const { filled, total, index, lowestId } = summarizeDay(ids, effectiveRatings);
  const complete = filled === total;
  const nameOf = (n: Need) => NEED_DATA[n.id]?.name ?? n.chartLabel;
  const lowest = needs.find((n) => n.id === lowestId);
  const when = date ? formatDateString(date, { day: 'numeric', month: 'long' }) : 'сегодня';
  const headline = completionHeadline(filled, total, index);
  const firstEmpty = nextUnrated(ids, effectiveRatings, -1, false);
  const close = isBackfill ? (onDone ?? goBack) : goBack;

  return (
    <div className="tk2-overlay">
      <div className="tq-body">
        <div className="tq-inner tq-done">
          <p className="tq-eyebrow">Трекер · {when}</p>
          <div className="tq-index" aria-label={headline.aria}>{headline.big}</div>
          <p className="tq-index-cap">{headline.caption}</p>
          {complete && lowest ? (
            <p className="tq-obs">{lowestObservation(nameOf(lowest))}</p>
          ) : (
            <p className="tq-obs">Заполнено {filled} из {total} — остальное можно дооценить позже</p>
          )}
          <DayBars needs={needs} ratings={effectiveRatings} />
          <div className="tq-acts">
            <button type="button" className="tq-btn tq-btn--main" onClick={close}>
              {isBackfill ? 'Готово' : 'На главную'}
            </button>
            <button type="button" className="tq-btn" onClick={() => onReview(complete ? 0 : (firstEmpty ?? 0))}>
              {complete ? 'Поправить ответы' : 'Дооценить'}
            </button>
          </div>
          <div className="tq-links">
            {onOpenNote && !isBackfill && (
              <button type="button" className="tq-link" onClick={onOpenNote}>Заметка</button>
            )}
            {onOpenHistory && (
              <button type="button" className="tq-link" onClick={() => { onOpenHistory(); goBack(); }}>История →</button>
            )}
            <DayShareButton needs={needs} ratings={effectiveRatings} date={date} plain />
          </div>
        </div>
      </div>
    </div>
  );
}
