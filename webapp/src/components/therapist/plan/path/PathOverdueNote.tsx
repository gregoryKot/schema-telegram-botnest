import { pluralRu } from '../../../../../../shared/src/utils/pluralRu';
import type { PhaseOverdueRow } from './pathView';

interface Props {
  overdue: PhaseOverdueRow;
  busy: boolean;
  onShift: (weeks: number) => void;
}

/** Тихая строка у текущей фазы: идём дольше плана; одна кнопка сдвигает сроки, остальное решает терапевт. */
export function PathOverdueNote({ overdue, busy, onShift }: Props) {
  const { weeks, shiftTo } = overdue;
  return (
    <div className="ph-overdue">
      <span>По плану эта фаза закончилась {weeks} {pluralRu(weeks, 'неделю', 'недели', 'недель')} назад{shiftTo != null ? ' — сдвинуть сроки?' : '.'}</span>
      {shiftTo != null && (
        <button type="button" className="ds-btn ds-btn--sm ds-btn--secondary ph-quiet" disabled={busy} onClick={() => onShift(shiftTo)}>
          Сдвинуть сроки
        </button>
      )}
    </div>
  );
}
