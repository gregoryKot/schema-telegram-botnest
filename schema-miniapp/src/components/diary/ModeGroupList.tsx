import { MODE_GROUPS } from '../../schemaTherapyData';
import { haptic } from '../../haptic';
import { pressable } from '../../utils/a11y';

/**
 * Полный список режимов по таксономическим группам (MODE_GROUPS) —
 * третичный путь для тех, кто уже знает точное название режима. Вынесено из
 * ModeSelectStep, чтобы файл не пробивал потолок (правило №10).
 */
export function ModeGroupList({
  onChange,
}: {
  onChange: (id: string) => void;
}) {
  return (
    <>
      {MODE_GROUPS.map((group) => (
        <div key={group.id} style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 10,
              color: group.color,
              fontWeight: 600,
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {group.group}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {group.items.map((m) => (
              <button
                key={m.id}
                {...pressable(() => {
                  haptic.select();
                  onChange(m.id);
                })}
                className="sel-btn"
                style={{
                  background: 'rgba(var(--fg-rgb),0.06)',
                  border: '1px solid transparent',
                  borderRadius: 16,
                  padding: '6px 11px',
                  color: 'rgba(var(--fg-rgb),0.6)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {m.emoji} {m.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
