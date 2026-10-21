// Состояние «Инструментов» — общее для площадок (как usePlusMenuState у «плюса»):
// десять строк из toolRows, скрытые пункты и порядок (ключи
// quick_actions_hidden_tools / quick_actions_order_tools). Мини-апп показывает
// из них плоский список, сайт раскладывает по своим разделам «Практики» —
// логика одна, разметка у каждой своя.
import { TOOLS_ACTIONS_HIDDEN_KEY } from './quickActionPrefs';
import { TOOLS_ACTIONS_ORDER_KEY } from './quickActionOrder';
import { useHiddenActions } from './useHiddenActions';
import { useQuickActionOrder } from './useQuickActionOrder';
import { buildToolRows, type ToolRowDef, type ToolRowsProps } from './toolRows';
import type { QuickActionId } from './quickActions';

export interface ToolsState {
  /** Все десять строк в сохранённом порядке (скрытые тоже — для листа). С
   * `orderable` сначала идут переставляемые, потом остальные. */
  rows: ToolRowDef[];
  /** Те же строки двумя группами [переставляемые, остальные]; без `orderable`
   * — одна группа. Порядок перестановки считается внутри своей группы. */
  groups: ToolRowDef[][];
  /** Id скрытых пунктов. */
  hidden: string[];
  /** Показан ли пункт. */
  isShown: (id: string) => boolean;
  toggle: (id: string, hidden: boolean) => void;
  onReorder: (id: string, toIndex: number) => 'up' | 'down' | false;
}

/** orderable — id пунктов, у которых на площадке есть что переставлять (на
 * сайте — карточки библиотеки); остальные пункты только скрываются. */
export function useToolsState(
  props: ToolRowsProps,
  onChanged?: () => void,
  orderable?: readonly QuickActionId[],
): ToolsState {
  const [hidden, toggle] = useHiddenActions(
    TOOLS_ACTIONS_HIDDEN_KEY,
    onChanged,
  );
  const all = buildToolRows(props);
  const { ordered, onReorder } = useQuickActionOrder(
    TOOLS_ACTIONS_ORDER_KEY,
    orderable
      ? [
          all.filter((r) => orderable.includes(r.id)),
          all.filter((r) => !orderable.includes(r.id)),
        ]
      : [all],
    onChanged,
  );
  return {
    rows: ordered.flat(),
    groups: ordered,
    hidden,
    isShown: (id) => !hidden.includes(id),
    toggle,
    onReorder,
  };
}
