import { useState } from 'react';
import { getModeById } from '../../schemaTherapyData';
import { haptic } from '../../haptic';
import { MODE_PICKER_GROUPS } from '../../../../shared/src/mode/modeBodyCues';

/**
 * Навигация по режиму «по ощущению»: те же 8 семей, что и в тесте «не знаю
 * режим» (shared/mode/modeTest), плюс вход «не знаю, что чувствую, или
 * пусто» последним (shared/mode/modeBodyCues) — сразу списком, без вопросов,
 * для тех, кто уже примерно понимает состояние и не хочет искать в
 * таксономических группах MODE_GROUPS. Переиспользует данные теста (правило
 * №11: один источник семей на оба пути выбора, а не второй список).
 */
export function ModeFeelingBrowse({
  onChange,
}: {
  onChange: (id: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const group = openId
    ? (MODE_PICKER_GROUPS.find((g) => g.id === openId) ?? null)
    : null;

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {MODE_PICKER_GROUPS.map((g) => {
          const active = openId === g.id;
          return (
            <button
              key={g.id}
              onClick={() => {
                haptic.tap();
                setOpenId(active ? null : g.id);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: active
                  ? 'rgba(96,165,250,0.16)'
                  : 'rgba(var(--fg-rgb),0.06)',
                border: active
                  ? '1px solid rgba(96,165,250,0.4)'
                  : '1px solid transparent',
                borderRadius: 16,
                padding: '6px 11px',
                color: active
                  ? 'var(--accent-blue)'
                  : 'rgba(var(--fg-rgb),0.65)',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <span>{g.emoji}</span>
              {g.title}
            </button>
          );
        })}
      </div>

      {group && (
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {group.leaves.map((leaf) => {
            const mode = getModeById(leaf.modeId);
            return (
              <button
                key={leaf.modeId}
                onClick={() => {
                  haptic.select();
                  onChange(leaf.modeId);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(var(--fg-rgb),0.05)',
                  border: '1px solid rgba(var(--fg-rgb),0.06)',
                  borderRadius: 14,
                  padding: '10px 12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>
                  {leaf.emoji}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: 'var(--text)',
                    }}
                  >
                    {mode?.name ?? leaf.label}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                    {leaf.label}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
