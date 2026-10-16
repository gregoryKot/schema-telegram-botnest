import type { TherapyRelationInfo } from '../../api';
import { pressable } from '../../utils/a11y';
import { useTr } from '../../utils/addressForm';
import { meetingTitle, type SparkBar } from './model';

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
        {weekDelta !== null && (
          <span className={'ct-index-delta ' + (weekDelta > 0 ? 'is-up' : weekDelta < 0 ? 'is-down' : '')}>
            {weekDelta > 0 ? '+' : ''}{weekDelta.toFixed(1)} за неделю
          </span>
        )}
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
  return (
    <div className="ds-card ds-card--accent ct-meeting">
      <div className="ds-label ct-on-accent">Встреча с терапевтом</div>
      {relation.nextSession && <div className="ds-num ct-meeting-title">{meetingTitle(relation.nextSession, now)}</div>}
      <div className="ct-meeting-name">{relation.partnerName}</div>
      <a className="ct-write" href={`tg://user?id=${relation.partnerId}`}>Написать</a>
    </div>
  );
}

// Стрик: цифра --accent-hot 52px.
export function StreakCard({ streak }: { streak: number }) {
  const tr = useTr();
  return (
    <div className="ds-card ct-streak">
      <div className={'ds-num ct-streak-num' + (streak > 0 ? '' : ' is-zero')}>{streak}</div>
      <div>
        <div className="ct-streak-label">
          {streak === 0 ? tr('Оцени потребности – начнётся стрик', 'Оцените потребности – начнётся стрик') : 'дней подряд'}
        </div>
      </div>
    </div>
  );
}
