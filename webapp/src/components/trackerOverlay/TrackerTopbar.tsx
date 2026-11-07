import type { Need } from '../../types';
import { hueStyle, NEED_HUE } from '../../lib/tone';
import type { NeedId } from '../../../../shared/src/needs/types';

/** Верх вопроса трекера: «Закрыть», точки прогресса (тап — к этой потребности), «Пропустить». */
export function TrackerTopbar({
  needs,
  idx,
  ratings,
  nameOf,
  onClose,
  onPick,
  onSkip,
}: {
  needs: Need[];
  idx: number;
  ratings: Record<string, number>;
  nameOf: (n: Need) => string;
  onClose: () => void;
  onPick: (i: number) => void;
  onSkip: () => void;
}) {
  return (
    <div className="tq-bar">
      <button type="button" className="tq-bar-btn" onClick={onClose}>Закрыть</button>
      <div className="tq-dots" role="group" aria-label="Потребности">
        {needs.map((n, i) => {
          const state = i === idx ? ' is-current' : (ratings[n.id] ?? 0) > 0 ? ' is-done' : '';
          return (
            <button
              key={n.id}
              type="button"
              className="tq-dot-hit"
              aria-label={nameOf(n)}
              aria-current={i === idx ? 'step' : undefined}
              onClick={() => onPick(i)}
            >
              <span className={'tq-dot' + state} style={hueStyle(NEED_HUE[n.id as NeedId])} />
            </button>
          );
        })}
      </div>
      <button type="button" className="tq-bar-btn tq-skip" onClick={onSkip}>Пропустить</button>
    </div>
  );
}
