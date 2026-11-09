import { createContext, useContext, useMemo, type CSSProperties } from 'react';
import { useTr } from '../../utils/addressForm';
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { Strokes } from '../../components/art/PaperArt';
import type { ArtProps } from '../../components/art/paper';
import { SignScene } from '../../components/art/SceneParts';
import type { TrackerSummary } from './todayFeedModel';
import { strokeValues } from './strokeValues';
import { trackerCta } from './trackerCta';

// Полоски дня — знак трекера с данными (Strokes values): высота — оценка, пустое место — тон
// бумаги. SignScene ждёт компонент, а оценки меняются: компонент один, оценки — из контекста,
// иначе новый компонент на каждый рендер перемонтировал бы рисунок.
const DayValues = createContext<readonly (number | null)[]>([]);
function DayStrokes({ size }: ArtProps) {
  return <Strokes size={size} values={useContext(DayValues)} />;
}

interface Props {
  ratings: Record<string, number>;
  tracker: TrackerSummary;
  meta: string;
  onClick: () => void;
}

/** Блок трекера на главной «Сегодня» — вся кнопка; «кнопка» внутри — span (вложенная button
 *  невалидна), без aria-hidden: имя несёт действие. Телефон и планшет — блок между линиями
 *  (эталон владельца 2026-11-04); компьютер — лист соломы с полосками дня крупно и тенью-вырезкой
 *  (client-today.css). */
export function TrackerBlock({ ratings, tracker, meta, onClick }: Props) {
  const tr = useTr();
  const values = useMemo(() => strokeValues(ratings), [ratings]);
  const done = tracker.total > 0 && tracker.filled >= tracker.total;
  return (
    <button type="button" className="pp-block pp-block--btn ct-main" style={{ '--h': ENTITY_LOOK.tracker.hue } as CSSProperties} onClick={onClick}>
      <span className="pp-hero">
        <span className="pp-hero-body">
          <span className="ds-label">Трекер</span>
          <span className="pp-hero-title">{tr('Как ты сегодня?', 'Как вы сегодня?')}</span>
          <span className="pp-hero-text">Пять потребностей. Одна минута для себя.</span>
          <span className="pp-meta">{meta}</span>
        </span>
        <DayValues.Provider value={values}>
          <SignScene Art={DayStrokes} className="ct-strokes" />
        </DayValues.Provider>
      </span>
      <span className={`ds-btn ds-btn--lg pp-cta${done ? ' ds-btn--secondary' : ''}`}>
        {trackerCta(tracker)} →
      </span>
    </button>
  );
}
