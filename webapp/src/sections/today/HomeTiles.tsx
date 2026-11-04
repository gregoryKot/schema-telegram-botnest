import { haptic } from '../../haptic';
import { useTr } from '../../utils/addressForm';
import type { TrackerSummary } from './todayFeed';
import { NeedStrokes, RibbonArt, PebblesArt } from './HomeArt';
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

// Главная по референсу владельца 2026-11-04 (бумажная аппликация): трекер — блок между
// линиями с вопросом, картинкой и единственной залитой кнопкой экрана; ниже два квадрата.
// Блок трекера — вся кнопка целиком; «кнопка» внутри — span (вложенная button невалидна),
// без aria-hidden, чтобы имя кнопки несло действие («Трекер … Отметить состояние»).
export function HomeTiles({ ratings, tracker, trackerMeta, caseMeta, diaryMeta, onTracker, onCase, onDiary }: Props) {
  const tr = useTr();
  const tap = (fn: () => void) => () => { haptic.tap(); fn(); };
  const done = tracker.total > 0 && tracker.filled >= tracker.total;
  return (
    <div className="ct-home">
      <button type="button" className="ct-main" onClick={tap(onTracker)}>
        <span className="ct-main-grid">
          <span className="ct-main-body">
            <span className="ds-label">Трекер</span>
            <span className="ct-main-title">{tr('Как ты сегодня?', 'Как вы сегодня?')}</span>
            <span className="ct-main-text">Пять потребностей. Одна минута для себя.</span>
            <span className="ct-tile-meta">{trackerMeta}</span>
          </span>
          <NeedStrokes ratings={ratings} />
        </span>
        <span className={`ds-btn ds-btn--lg ct-main-cta${done ? ' ds-btn--secondary' : ''}`}>
          {trackerCta(tracker)} →
        </span>
      </button>

      <div className="ct-squares">
        <HomeSquare hue={SQUARE_HUE.case} art={<RibbonArt />} title="Что случилось" text="Разобрать то, что задело." meta={caseMeta} onClick={tap(onCase)} />
        <HomeSquare hue={SQUARE_HUE.diary} art={<PebblesArt />} title="Дневник" text="Оставить здесь то, что на уме." meta={diaryMeta} onClick={tap(onDiary)} />
      </div>
    </div>
  );
}
