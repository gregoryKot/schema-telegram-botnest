import { SkeletonLines } from './SkeletonLines';
import { DIARY_KIND_LABEL } from './model';
import type { FeedEntry, FeedKind } from './todayFeed';

const FEED_KIND_LABEL: Record<FeedKind, string> = { ...DIARY_KIND_LABEL, tracker: 'Трекер' };

interface Props {
  entries: FeedEntry[];
  loaded: boolean;
  onOpenDiaries: () => void;
  onOpenTrackerHistory?: () => void;
  onAll: () => void;
}

// Лента «Сегодня»: что уже записано за день. Строка = время · текст · тип.
// Трекер ведёт в историю, записи дневников — в «Дневники». Пусто — подсказка, не выдумка.
export function TodayFeed({ entries, loaded, onOpenDiaries, onOpenTrackerHistory, onAll }: Props) {
  return (
    <section className="ct-section ct-block ct-feed" aria-label="Сегодня">
      <div className="ds-head-row">
        <div className="ds-eyebrow">Сегодня</div>
        <button type="button" className="ct-link" onClick={onAll}>Все записи</button>
      </div>
      {!loaded ? (
        <SkeletonLines />
      ) : entries.length === 0 ? (
        <p className="ds-sub ct-empty">Пока ничего. Любая кнопка выше подойдёт для начала.</p>
      ) : (
        <ul className="ct-feed-list">
          {entries.map(e => (
            <li key={e.key}>
              <button
                type="button"
                className="ct-feed-row"
                onClick={e.kind === 'tracker' && onOpenTrackerHistory ? onOpenTrackerHistory : onOpenDiaries}
              >
                <span className="ct-feed-time">{e.time}</span>
                <span className="ct-feed-text">{e.text}</span>
                <span className="ct-feed-kind">{FEED_KIND_LABEL[e.kind]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
