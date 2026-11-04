import { haptic } from '../../haptic';
import type { TrackerSummary } from './todayFeed';
import { NeedGarden, RippleArt, LeafArt } from './HomeArt';
import { HomeTileRow } from './HomeTileRow';

interface Props {
  ratings: Record<string, number>;
  tracker: TrackerSummary;
  trackerMeta: string;
  caseMeta: string;
  /** null — дневники ещё грузятся: вместо текста плашка-скелетон, ничего выдуманного. */
  diaryMeta: string | null;
  onTracker: () => void;
  onCase: () => void;
  onDiary: () => void;
}

/** Подпись единственной кнопки экрана — по состоянию трекера за сегодня. */
export function trackerCta({ filled, total }: TrackerSummary): string {
  if (filled === 0 || total === 0) return 'Заполнить за минуту';
  if (filled < total) return 'Продолжить';
  return 'Посмотреть сегодня';
}

// Главная «Сегодня» (docs/design/CLIENT_SIMPLE_2026-10.md): одна главная плитка — трекер,
// с картинкой и единственной залитой кнопкой экрана; «Что случилось» и дневник — тихие
// строки с картинкой слева (HomeTileRow). Плитка — вся кнопка целиком, «кнопка» внутри нарисована
// span-ом: вложенная button невалидна, а тап-цель и так вся карточка; span без aria-hidden,
// чтобы имя кнопки для скринридера несло действие («Трекер … Заполнить за минуту»).
export function HomeTiles({ ratings, tracker, trackerMeta, caseMeta, diaryMeta, onTracker, onCase, onDiary }: Props) {
  const tap = (fn: () => void) => () => { haptic.tap(); fn(); };
  const done = tracker.total > 0 && tracker.filled >= tracker.total;
  return (
    <div className="ct-tiles">
      <button type="button" className="ct-tile ct-tile--main" onClick={tap(onTracker)}>
        <NeedGarden ratings={ratings} />
        <span className="ct-tile-body">
          <span className="ct-tile-title">Трекер</span>
          <span className="ct-tile-text">Пять потребностей, один вопрос за раз.</span>
          <span className="ct-tile-meta">{trackerMeta}</span>
        </span>
        <span className={`ds-btn ds-btn--lg ct-tile-cta${done ? ' ds-btn--secondary' : ''}`}>
          {trackerCta(tracker)}
        </span>
      </button>

      <HomeTileRow art={<RippleArt />} title="Что случилось" text="Момент, после которого стало не по себе." meta={caseMeta} onClick={tap(onCase)} />
      <HomeTileRow art={<LeafArt />} title="Дневник" text="Одна мысль, схема, режим или спасибо." meta={diaryMeta} onClick={tap(onDiary)} />
    </div>
  );
}
