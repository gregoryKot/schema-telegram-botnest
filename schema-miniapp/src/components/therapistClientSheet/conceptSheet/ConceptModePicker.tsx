import { MODE_GROUPS } from '../../../schemaTherapyData';
import { IdentityDot } from '../../../../../shared/src/components/IdentityDot';

/**
 * Выбор режимов в концептуализации: пилюли по группам. Вынесено из
 * ConceptSheet — тот уже сверх потолка в 300 строк, и правило требует дробить
 * раздутый файл, а не поднимать ему планку (CLAUDE.md, №10).
 *
 * Опознаватель режима — точка цвета его группы: эмодзи убраны по всему
 * приложению, а название режима рядом остаётся всегда (цвет не может быть
 * единственным носителем смысла).
 */
export function ConceptModePicker({
  activeModeIds,
  onToggle,
}: {
  activeModeIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <>
      {MODE_GROUPS.map((group) => (
        <div key={group.id} style={{ marginBottom: 8 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.07em',
              color: group.color + 'aa',
              textTransform: 'uppercase',
              marginBottom: 5,
              paddingLeft: 2,
            }}
          >
            {group.group}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {group.items.map((mode) => {
              const active = activeModeIds.includes(mode.id);
              return (
                <button
                  key={mode.id}
                  onClick={() => onToggle(mode.id)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 'var(--r-20)',
                    border: 'none',
                    cursor: 'pointer',
                    background: active
                      ? group.color + '30'
                      : 'rgba(var(--fg-rgb),0.05)',
                    color: active ? group.color : 'rgba(var(--fg-rgb),0.45)',
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <IdentityDot color={group.color} size={7} /> {mode.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
