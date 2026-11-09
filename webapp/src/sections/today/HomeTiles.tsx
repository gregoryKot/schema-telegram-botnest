import { haptic } from '../../haptic';
import type { TrackerSummary } from './todayFeedModel';
import { HomeSquare } from './HomeSquare';
import { TrackerBlock } from './TrackerBlock';

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

// Главная по референсу владельца 2026-11-04 (бумажная аппликация, styles/paper.css): блок трекера
// и два квадрата цветной бумаги. Вид квадратов — ENTITY_LOOK («Что случилось» — шалфей и лента,
// дневник — персик и камешки). Компьютер (≥1024) — разворот: лист трекера слева, квадраты справа
// горизонтальными плитками (client-today.css).
export function HomeTiles({ ratings, tracker, trackerMeta, caseMeta, diaryMeta, onTracker, onCase, onDiary }: Props) {
  const tap = (fn: () => void) => () => { haptic.tap(); fn(); };
  return (
    <div className="ct-home">
      <TrackerBlock ratings={ratings} tracker={tracker} meta={trackerMeta} onClick={tap(onTracker)} />
      <div className="pp-squares ct-squares">
        <HomeSquare entity="case" title="Что случилось" text="Разобрать то, что задело." meta={caseMeta} onClick={tap(onCase)} />
        <HomeSquare entity="diary" title="Дневник" text="Оставить здесь то, что на уме." meta={diaryMeta} onClick={tap(onDiary)} />
      </div>
    </div>
  );
}
