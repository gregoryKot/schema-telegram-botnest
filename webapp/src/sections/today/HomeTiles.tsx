import { haptic } from '../../haptic';
import { useTr } from '../../utils/addressForm';
import type { TrackerSummary } from './todayFeedModel';
import { NEED_COLOR_ORDER } from '../../../../shared/src/needs/needColors';
import { isRated } from '../../../../shared/src/needs/ratingRecord';
import { Strokes, Ribbon, Pebbles } from '../../components/art/PaperArt';
import { HomeSquare } from './HomeSquare';
import { trackerCta } from './trackerCta';

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

/** Оттенки цветной бумаги квадратов (референс: шалфей и персик), не hue сущностей. */
const SQUARE_HUE = { case: 135, diary: 45 } as const;
// Главная по референсу владельца 2026-11-04 (бумажная аппликация, styles/paper.css). Блок трекера —
// вся кнопка; «кнопка» внутри — span (вложенная button невалидна), без aria-hidden: имя несёт действие.
export function HomeTiles({ ratings, tracker, trackerMeta, caseMeta, diaryMeta, onTracker, onCase, onDiary }: Props) {
  const tr = useTr();
  const tap = (fn: () => void) => () => { haptic.tap(); fn(); };
  const done = tracker.total > 0 && tracker.filled >= tracker.total;
  return (
    <div className="ct-home">
      <button type="button" className="pp-block pp-block--btn ct-main" onClick={tap(onTracker)}>
        <span className="pp-hero">
          <span className="pp-hero-body">
            <span className="ds-label">Трекер</span>
            <span className="pp-hero-title">{tr('Как ты сегодня?', 'Как вы сегодня?')}</span>
            <span className="pp-hero-text">Пять потребностей. Одна минута для себя.</span>
            <span className="pp-meta">{trackerMeta}</span>
          </span>
          <Strokes size="hero" marks={NEED_COLOR_ORDER.map(id => ({ id, dense: isRated(ratings, id) }))} />
        </span>
        <span className={`ds-btn ds-btn--lg pp-cta${done ? ' ds-btn--secondary' : ''}`}>
          {trackerCta(tracker)} →
        </span>
      </button>

      <div className="pp-squares">
        <HomeSquare hue={SQUARE_HUE.case} art={<Ribbon />} title="Что случилось" text="Разобрать то, что задело." meta={caseMeta} onClick={tap(onCase)} />
        <HomeSquare hue={SQUARE_HUE.diary} art={<Pebbles />} title="Дневник" text="Оставить здесь то, что на уме." meta={diaryMeta} onClick={tap(onDiary)} />
      </div>
    </div>
  );
}
