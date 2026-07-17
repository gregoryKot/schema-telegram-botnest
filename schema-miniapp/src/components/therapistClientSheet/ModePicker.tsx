import { MODE_GROUPS } from '../../schemaTherapyData';
import { SectionLabel } from '../SectionLabel';

interface Props {
  activeModeIds: string[];
  toggleModeId: (id: string) => void;
}

export function ModePicker({ activeModeIds, toggleModeId }: Props) {
  return (
    <>
      <div style={{ marginTop: 6 }}>
        <SectionLabel mb={8}>Карта режимов</SectionLabel>
      </div>
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
                  onClick={() => toggleModeId(mode.id)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 20,
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
                  {mode.emoji} {mode.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
