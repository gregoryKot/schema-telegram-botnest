import type { Need } from '../../types';
import { useNeedData } from '../../needData';
import { formatDateString } from '../../../../shared/src/utils/calendarDate';
import { glue } from '../../../../shared/src/utils/typo';
import { TherapyLine } from '../therapy/TherapyLine';
import { useTherapyBridgeTexts } from '../therapy/useTherapyBridgeTexts';
import { SpreadLayout } from '../paper/SpreadLayout';
import { DayBars } from './DayBars';
import { CompletionLinks } from './CompletionLinks';
import '../../styles/tracker-done.css';
import { completionHeadline, lowestObservation, nextUnrated, summarizeDay } from './trackerFlow';

// QA B-З9: на 5xx и без сети оценка ложится в очередь, а экран писал «Готово», не сказав, что
// сервер её ещё не видел. Очередь уходит сама — на старте и по возврату сети (useOutboxFlushOnOnline).
const QUEUED_TEXT = glue('Оценки пока не дошли до сервера. Они сохранены на этом устройстве и отправятся сами');

/** Экран «Готово»: лист шалфея без знака-полосок (картинка листа — сами столбики) — индекс дня (или «N из M», пока оценены не все), одно наблюдение (если оценены все),
 *  пять столбиков; рядом (на компьютере — разворотом справа, на телефоне — под листом) куда дальше. */
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
  queued,
}: {
  needs: Need[];
  effectiveRatings: Record<string, number>;
  isBackfill: boolean;
  /** Дата backfill-дня (YYYY-MM-DD); undefined = сегодня */
  date?: string;
  onDone?: () => void;
  goBack: (then?: unknown) => void; // then-функция — соседний лист после закрытия
  /** Вернуться к вопросам: «Поправить ответы» — к первому, «Дооценить» — к первому пустому. */
  onReview: (idx: number) => void;
  onOpenNote?: () => void;
  onOpenHistory?: () => void;
  /** Хотя бы одна оценка не дошла до сервера и ждёт в очереди (shared/src/api/ratingApi.ts). */
  queued?: boolean;
}) {
  const NEED_DATA = useNeedData();
  const bridge = useTherapyBridgeTexts();
  const ids = needs.map((n) => n.id);
  const { filled, total, index, lowestId } = summarizeDay(ids, effectiveRatings);
  const complete = filled === total;
  const nameOf = (n: Need) => NEED_DATA[n.id]?.name ?? n.chartLabel;
  const lowest = needs.find((n) => n.id === lowestId);
  const when = date ? formatDateString(date, { day: 'numeric', month: 'long' }) : 'сегодня';
  const headline = completionHeadline(filled, total, index);
  const firstEmpty = nextUnrated(ids, effectiveRatings, -1, false);
  const close = isBackfill ? (onDone ?? goBack) : goBack;

  const sheet = (
    <div className="tq-day pp-paper">
      <p className="tq-eyebrow">Трекер · {when}</p>
      <div className="tq-index" aria-label={headline.aria}>{headline.big}</div>
      <p className="tq-index-cap">{headline.caption}</p>
      <p className="tq-obs">
        {glue(complete && lowest ? lowestObservation(nameOf(lowest)) : 'Остальное можно дооценить позже — хоть вечером, хоть завтра из истории.')}
      </p>
      {queued && <p className="tq-index-cap" role="status">{QUEUED_TEXT}</p>}
      <DayBars needs={needs} ratings={effectiveRatings} />
    </div>
  );
  return (
    <div className="tk2-overlay">
      <div className="tq-body">
        <div className="tq-fin">
          <SpreadLayout side={sheet}>
            <div className="tq-acts">
              <button type="button" className="ds-btn tq-fin-btn" onClick={close}>{isBackfill ? 'Готово' : 'На главную'}</button>
              <button type="button" className="ds-btn ds-btn--secondary tq-fin-btn" onClick={() => onReview(complete ? 0 : (firstEmpty ?? 0))}>
                {complete ? 'Поправить ответы' : 'Дооценить'}
              </button>
            </div>
            <CompletionLinks
              needs={needs} ratings={effectiveRatings} date={date} isBackfill={isBackfill} onOpenNote={onOpenNote}
              onOpenHistory={onOpenHistory && (() => goBack(onOpenHistory))}
            />
            <TherapyLine place="tracker_done" text={index !== null && index <= 4 ? bridge.lineTrackerLow : bridge.lineTracker} />
          </SpreadLayout>
        </div>
      </div>
    </div>
  );
}
