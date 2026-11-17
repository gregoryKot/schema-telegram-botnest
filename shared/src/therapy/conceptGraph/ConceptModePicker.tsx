import { MODE_GROUPS } from '../../schemaTherapy/schemaTherapyData';
import { ConceptToggleChip } from './ConceptToggleChip';
import { ConceptGroup } from './ConceptGroup';
import { modeGroupLook } from '../../theme/entityLook';

/**
 * Выбор режимов в концептуализации: чипы по группам. Единственная копия на
 * оба вида вкладки и на «+ режим» в клетке графа (правило «одна механика — один
 * компонент»).
 *
 * `groupIds` — показать только эти группы (клетка графа предлагает режимы
 * своей клетки); выбранные режимы остаются видны, тап снимает/ставит.
 * `onlyIds` — только эти режимы (режимы клиента в «Что делали»), пустая группа скрыта.
 *
 * Опознаватель режима — знак его группы в шапке группы (ConceptGroup: лист
 * бумаги группы, как у клиента); выбранный чип — бумага группы с галочкой.
 */
export function ConceptModePicker({
  activeModeIds,
  onToggle,
  groupIds,
  onlyIds,
}: {
  activeModeIds: string[];
  onToggle: (id: string) => void;
  groupIds?: string[];
  onlyIds?: ReadonlySet<string>;
}) {
  const groups = groupIds
    ? MODE_GROUPS.filter((g) => groupIds.includes(g.id))
    : MODE_GROUPS;
  return (
    <div className="cg-groups">
      {groups.map((group) => {
        const look = modeGroupLook(group.id);
        const items = group.items.filter((m) => !onlyIds || onlyIds.has(m.id));
        if (items.length === 0) return null;
        return (
          <ConceptGroup key={group.id} look={look} title={group.group}>
            {items.map((mode) => (
              <ConceptToggleChip
                key={mode.id}
                label={mode.name}
                color={group.color}
                hue={look.hue}
                active={activeModeIds.includes(mode.id)}
                onClick={() => onToggle(mode.id)}
              />
            ))}
          </ConceptGroup>
        );
      })}
    </div>
  );
}
