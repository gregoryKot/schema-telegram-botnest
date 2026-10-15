import { MODE_GROUPS } from '../../schemaTherapy/schemaTherapyData';
import { ConceptToggleChip } from './ConceptToggleChip';
import { colorMix } from '../../utils/colorMix';

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
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.07em',
              color: colorMix(group.color, 67),
              textTransform: 'uppercase',
              marginBottom: 'var(--space-6)',
              paddingLeft: 2,
            }}
          >
            {group.group}
          </div>
          <div
            style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-6)' }}
          >
            {group.items.map((mode) => (
              <ConceptToggleChip
                key={mode.id}
                label={mode.name}
                color={group.color}
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
