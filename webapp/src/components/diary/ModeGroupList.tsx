import { PickGroups } from '../exercises/PickGroups';
import { MODE_PICK_GROUPS } from '../exercises/cardFlow/cardEntities';

/** Полный список режимов по группам — для тех, кто знает название (дневник режимов, «другие режимы»
 * разбора, мастер из ⌘K). Группа — бумага MODE_GROUP_HUE со знаком группы (как в «Справочнике»
 * терапевта), строки — белый список без точек, выбранная — бумага группы с галочкой. Раскладка —
 * общая PickGroups (exercises/PickGroups.tsx): тот же выбор у карточки режима в упражнениях. */
export function ModeGroupList({ modeId, onPick }: { modeId: string; onPick: (id: string) => void }) {
  return <PickGroups groups={MODE_PICK_GROUPS} selectedId={modeId} onPick={onPick} />;
}
