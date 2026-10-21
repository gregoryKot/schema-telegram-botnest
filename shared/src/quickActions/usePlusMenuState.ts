// Состояние меню «плюс» — общее для мини-аппа и сайта (правило №3, «одна
// механика — один компонент»): группы из реестра, скрытые пункты, порядок
// (те же ключи localStorage, что раньше жили только в мини-аппе) и итоговые
// видимые группы. Разметка у каждой площадки своя, логика одна.
import type { Tr } from '../practices/quickPractices';
import {
  buildPlusActions,
  type QuickActionGroup,
} from './quickActionsRegistry';
import { PLUS_ACTIONS_HIDDEN_KEY } from './quickActionPrefs';
import { PLUS_ACTIONS_ORDER_KEY } from './quickActionOrder';
import { useHiddenActions } from './useHiddenActions';
import { useQuickActionOrder } from './useQuickActionOrder';

export function usePlusMenuState(tr: Tr, onChanged?: () => void) {
  const groups = buildPlusActions(tr);
  const [hidden, toggle] = useHiddenActions(PLUS_ACTIONS_HIDDEN_KEY, onChanged);
  const { ordered, onReorder } = useQuickActionOrder(
    PLUS_ACTIONS_ORDER_KEY,
    groups.map((g) => g.actions),
    onChanged,
  );
  const orderedGroups: QuickActionGroup[] = groups.map((g, i) => ({
    ...g,
    actions: ordered[i],
  }));
  const visibleGroups = orderedGroups
    .map((g) => ({
      ...g,
      actions: g.actions.filter((a) => !hidden.includes(a.id)),
    }))
    .filter((g) => g.actions.length > 0);
  return { orderedGroups, visibleGroups, hidden, toggle, onReorder };
}
