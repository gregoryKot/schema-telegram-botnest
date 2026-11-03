import { MODE_GROUPS } from '../../schemaTherapy/schemaTherapyData';
import { ConceptToggleChip } from './ConceptToggleChip';
import { ConceptGroupLabel } from './ConceptGroupLabel';
import { groupLabel } from './conceptInlineStyles';
import { MODE_GROUP_HUE } from '../../theme/entityHue';

/**
 * Выбор режимов в концептуализации: пилюли по группам. Единственная копия на
 * оба фронтенда и на «+ режим» в клетке графа (раньше пилюли были написаны
 * дважды — в мини-аппе и инлайном в webapp, правило «одна механика — один
 * компонент»).
 *
 * `groupIds` — показать только эти группы (клетка графа предлагает режимы
 * своей клетки); выбранные режимы остаются видны, тап снимает/ставит.
 *
 * Опознаватель режима — точка цвета его группы (ConceptToggleChip): эмодзи
 * убраны по всему приложению, а название режима рядом остаётся всегда.
 * Подложки — color-mix: склейка токена с hex-суффиксом альфы даёт невалидный
 * CSS (пилюли оставались без подложки).
 */
export function ConceptModePicker({
  activeModeIds,
  onToggle,
  groupIds,
}: {
  activeModeIds: string[];
  onToggle: (id: string) => void;
  groupIds?: string[];
}) {
  const groups = groupIds
    ? MODE_GROUPS.filter((g) => groupIds.includes(g.id))
    : MODE_GROUPS;
  return (
    <>
      {groups.map((group) => (
        <div key={group.id} style={{ marginBottom: 'var(--space-8)' }}>
          <ConceptGroupLabel
            hue={MODE_GROUP_HUE[group.id]}
            fallback={groupLabel(group.color)}
          >
            {group.group}
          </ConceptGroupLabel>
          <div
            style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)' }}
          >
            {group.items.map((mode) => (
              <ConceptToggleChip
                key={mode.id}
                label={mode.name}
                color={group.color}
                hue={MODE_GROUP_HUE[group.id]}
                active={activeModeIds.includes(mode.id)}
                onClick={() => onToggle(mode.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
