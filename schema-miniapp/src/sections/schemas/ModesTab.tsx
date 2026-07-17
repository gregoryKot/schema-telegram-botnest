import { MODE_GROUPS, ALL_MODES } from '../../schemaTherapyData';
import { cm, hex } from './utils';

interface Props {
  profileLoading: boolean;
  myModeIds: string[];
  expandedModeGroups: Set<string>;
  onSelectMode: (id: string) => void;
  onAddMode: () => void;
  onToggleModeGroup: (id: string) => void;
}

export function ModesTab({
  profileLoading,
  myModeIds,
  expandedModeGroups,
  onSelectMode,
  onAddMode,
  onToggleModeGroup,
}: Props) {
  const myModes = myModeIds
    .map((id) => ALL_MODES.find((m) => m.id === id))
    .filter(Boolean) as typeof ALL_MODES;

  return (
    <>
      {/* МОИ РЕЖИМЫ */}
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
            marginBottom: 10,
          }}
        >
          Мои режимы
        </div>
        {profileLoading ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[90, 110, 80].map((w, i) => (
              <div
                key={i}
                style={{
                  height: 32,
                  width: w,
                  borderRadius: 20,
                  background:
                    'linear-gradient(90deg,var(--surface) 25%,var(--surface-2) 50%,var(--surface) 75%)',
                  backgroundSize: '200% auto',
                  animation: 'shimmer 1.5s linear infinite',
                }}
              />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {myModes.map((m) => {
              const c = m.groupColor; // CSS variable
              return (
                <button
                  key={m.id}
                  onClick={() => onSelectMode(m.id)}
                  style={{
                    padding: '6px 13px',
                    borderRadius: 20,
                    border: `1.5px solid ${cm(c, 35)}`,
                    background: cm(c, 9),
                    color: c,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    WebkitTapHighlightColor: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{m.emoji}</span>
                  {m.name}
                </button>
              );
            })}
            <button
              onClick={onAddMode}
              style={{
                padding: '6px 13px',
                borderRadius: 20,
                border: '1.5px dashed var(--border-color)',
                background: 'transparent',
                color: 'var(--text-sub)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              + Добавить
            </button>
          </div>
        )}
      </div>

      {/* ВСЕ РЕЖИМЫ */}
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: 'var(--text-faint)',
            marginBottom: 10,
          }}
        >
          Все режимы
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {MODE_GROUPS.map((group) => {
            const isOpen = expandedModeGroups.has(group.id);
            const c = group.color; // CSS variable
            return (
              <div
                key={group.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 16,
                  overflow: 'hidden',
                }}
              >
                <div
                  onClick={() => onToggleModeGroup(group.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: hex(c),
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--text)',
                      }}
                    >
                      {group.group}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        color: 'var(--text-faint)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {group.items.length}
                    </span>
                    <span
                      style={{
                        color: 'var(--text-faint)',
                        fontSize: 14,
                        display: 'inline-block',
                        transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                      }}
                    >
                      ›
                    </span>
                  </div>
                </div>
                {isOpen && (
                  <div
                    style={{
                      padding: '0 16px 14px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    {group.items.map((m) => {
                      const active = myModeIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => onSelectMode(m.id)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 20,
                            border: `1.5px solid ${cm(c, active ? 42 : 18)}`,
                            background: cm(c, active ? 11 : 5),
                            color: active ? c : 'var(--text-sub)',
                            fontSize: 13,
                            fontWeight: active ? 600 : 400,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            WebkitTapHighlightColor: 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <span style={{ fontSize: 14 }}>{m.emoji}</span>
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
