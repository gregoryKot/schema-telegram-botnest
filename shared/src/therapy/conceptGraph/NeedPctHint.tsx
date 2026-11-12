import type { ConceptGraphModel } from './conceptGraphTypes';
import { hasNeedRatings } from './diagram/diagramNeedPct';

export type NeedPctHintProps = Pick<ConceptGraphModel, 'needLinks'>;

/** Пока в колесе нет ни одной оценки: где их ставят. */
export const NEED_PCT_EMPTY =
  'Проценты по потребностям ставятся в колесе на холсте: «Графические карты» → «Круг потребностей».';

/** Оценки есть: что значат заливка и число на таблетке. */
export const NEED_PCT_LEGEND =
  'Заливка таблетки и число под названием — насколько потребность удовлетворена в выбранный период; период переключается над подписью круга. Оценки ставятся в колесе на холсте: «Графические карты» → «Круг потребностей».';

/**
 * Строка про проценты потребностей в «Как читать схему» — только у терапевта
 * (клиенту колесо не показывается). Обращения в ней нет: текст один на обе формы.
 */
export function NeedPctHint({ needLinks }: NeedPctHintProps) {
  return (
    <p data-need-pct-hint style={{ margin: 'var(--space-4) 0 0' }}>
      {hasNeedRatings(needLinks) ? NEED_PCT_LEGEND : NEED_PCT_EMPTY}
    </p>
  );
}
