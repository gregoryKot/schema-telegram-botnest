import type { TherapyRelationInfo } from '../../api';
import { pressable } from '../../utils/a11y';
import { upcomingSession } from '../../../../shared/src/therapy/upcomingSession';
import { meetingTitle, type SparkBar } from './model';
import { formatWeekDelta, weekDeltaTone } from './weekDeltaFormat';

interface IndexProps {
  score: number | null;
  weekDelta: number | null;
  bars: SparkBar[];
  onOpenHistory?: () => void;
}

// «Индекс сегодня»: тёмная карточка, число Literata 60 + столбики за 14 дней.
export function IndexCard({ score, weekDelta, bars, onOpenHistory }: IndexProps) {
  return (
    <div className="ds-card ds-card--ink ct-index" {...(onOpenHistory ? pressable(onOpenHistory) : {})}>
      <div className="ds-label ct-on-ink">Индекс сегодня</div>
      <div className="ct-index-row">
        <span className="ds-num ct-index-num">{score !== null ? score.toFixed(1) : '–'}</span>
        <span className={'ct-index-delta is-' + weekDeltaTone(weekDelta)}>
          {formatWeekDelta(weekDelta)} за неделю
        </span>
      </div>
      {bars.length > 1 && (
        <>
          <div className="ds-spark ct-spark" aria-hidden>
            {bars.map((b, i) => (
              <i key={i} className={b.level === 'none' ? '' : `is-${b.level}`} style={{ height: `${Math.max(b.height, 6)}%` }} />
            ))}
          </div>
          <div className="ct-spark-cap">{bars.length} дней</div>
        </>
      )}
    </div>
  );
}

// «Встреча с терапевтом»: только когда есть терапевт (роль клиента).
export function MeetingCard({ relation, now }: { relation: TherapyRelationInfo | null; now: number }) {
  if (!relation?.partnerName || relation.role !== 'client') return null;
  const at = upcomingSession(relation.nextSession, relation.meetingDays);
  return (
    <div className="ds-card ds-card--accent ct-meeting">
      <div className="ds-label ct-on-accent">Встреча с терапевтом</div>
      {at && <div className="ds-num ct-meeting-title">{meetingTitle(at, now)}</div>}
      <div className="ct-meeting-name">{relation.partnerName}</div>
      <a className="ct-write" href={`tg://user?id=${relation.partnerId}`}>Написать</a>
    </div>
  );
}
