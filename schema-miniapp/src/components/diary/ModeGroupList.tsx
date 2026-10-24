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
        <div key={group.id} className="u-mb16">
          {/* Цвет группы больше не красит подпись: различие несут порядок и
              группировка, а не палитра (макет «тёплая бумага»). */}
          <div className="d-caps u-mb8">{group.group}</div>
          <div className="u-wrap8">
            {group.items.map((m) => (
              <button
                key={m.id}
                {...pressable(() => {
                  haptic.select();
                  onChange(m.id);
                })}
                className="sel-btn"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid rgba(34,30,27,0.1)',
                  borderRadius: 999,
                  padding: '10px 14px',
                  color: 'var(--ink-2)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
