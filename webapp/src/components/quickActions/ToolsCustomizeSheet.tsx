// Лист «Какие инструменты показывать» в «Практике»: десять пунктов реестра
// 'tools' в порядке мини-аппа. На сайте у пунктов разные дома, поэтому лист
// делит их на две группы: карточки «Инструментов» (скрываются и
// переставляются) и разделы страницы (только скрываются). Состояние — общий
// useToolsState, оболочка листа — QuickActionCustomizeSheet; знак строки — сущности пункта, как у плитки.
import type { ToolsState } from '../../../../shared/src/quickActions/useToolsState';
import { QUICK_ACTION_SIGN } from '../quickActionSign';
import { QuickActionCustomizeSheet, type SheetGroup } from './QuickActionCustomizeSheet';
const toActions = (rows: ToolsState['rows']) => rows.map((r) => ({ id: r.id, label: r.label, sub: r.sub ?? '', sign: QUICK_ACTION_SIGN[r.id] }));

function buildToolsSheetGroups({ groups }: Pick<ToolsState, 'groups'>): SheetGroup[] {
  return [
    { id: 'cards', title: 'Карточки в «Инструментах»', actions: toActions(groups[0]) },
    {
      id: 'sections',
      title: 'Разделы страницы',
      note: 'Эти пункты можно скрыть или вернуть, их место на странице не меняется.',
      fixedOrder: true,
      actions: toActions(groups[1]),
    },
  ];
}

interface Props {
  tools: Pick<ToolsState, 'groups' | 'hidden' | 'toggle' | 'onReorder'>;
  onClose: () => void;
}

export function ToolsCustomizeSheet({ tools, onClose }: Props) {
  return (
    <QuickActionCustomizeSheet
      surface="tools"
      title="Какие инструменты показывать"
      reorderNoun="карточек"
      groups={buildToolsSheetGroups(tools)}
      hidden={tools.hidden}
      onToggle={tools.toggle}
      onReorder={tools.onReorder}
      onClose={onClose}
    />
  );
}
