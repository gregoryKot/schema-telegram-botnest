import { SkeletonLines } from './SkeletonLines';
import { ENTRY_KIND_LABEL } from '../diary/entryKind';
import type { FeedEntry } from './todayFeed';
import { RestArt } from './HomeArt';

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
        <div className="ct-empty">
          <RestArt />
          <p className="ds-empty">Пока ничего. Любая кнопка выше подойдёт для начала.</p>
        </div>
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
                <span className="ct-feed-kind">{ENTRY_KIND_LABEL[e.kind]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
