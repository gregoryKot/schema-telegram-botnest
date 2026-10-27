import { needColor, NEED_COLOR_ORDER } from '../../../../shared/src/needs/needColors';
import { haptic } from '../../haptic';

interface Props {
  ratings: Record<string, number>;
  trackerMeta: string;
  caseMeta: string;
  /** null — дневники ещё грузятся: вместо текста плашка-скелетон, ничего выдуманного. */
  diaryMeta: string | null;
  onTracker: () => void;
  onCase: () => void;
  onDiary: () => void;
}

// Три плитки главной: трекер, «Что случилось», дневник (docs/design/CLIENT_SIMPLE_2026-10.md).
// Плитка — вся кнопка целиком (высота от 124px), мета-строка берётся из данных.
export function HomeTiles({ ratings, trackerMeta, caseMeta, diaryMeta, onTracker, onCase, onDiary }: Props) {
  const tap = (fn: () => void) => () => { haptic.tap(); fn(); };
  return (
    <div className="ct-tiles">
      <button type="button" className="ct-tile ct-tile--tracker" onClick={tap(onTracker)}>
        <span className="ct-bars" aria-hidden="true">
          {NEED_COLOR_ORDER.map(id => (
            <i key={id} style={ratings[id] !== undefined ? { background: needColor(id) } : undefined} />
          ))}
        </span>
        <span className="ct-tile-body">
          <span className="ct-tile-title">Трекер</span>
          <span className="ct-tile-text">Пять потребностей, один вопрос за раз. Минута.</span>
          <span className="ct-tile-meta">{trackerMeta}</span>
        </span>
      </button>

      <button type="button" className="ct-tile ct-tile--case" onClick={tap(onCase)}>
        <span className="ct-tile-body">
          <span className="ct-tile-title">Что случилось</span>
          <span className="ct-tile-text">Момент, после которого стало не по себе. Три минуты, писать почти не надо.</span>
          <span className="ct-tile-meta">{caseMeta}</span>
        </span>
      </button>

      <button type="button" className="ct-tile ct-tile--diary" onClick={tap(onDiary)}>
        <span className="ct-tile-body">
          <span className="ct-tile-title">Дневник</span>
          <span className="ct-tile-text">Одна мысль, схема, режим или спасибо — что на уме.</span>
          {diaryMeta === null
            ? <span className="ct-tile-meta ct-tile-meta--skeleton" aria-hidden="true" />
            : <span className="ct-tile-meta">{diaryMeta}</span>}
        </span>
      </button>
    </div>
  );
}
