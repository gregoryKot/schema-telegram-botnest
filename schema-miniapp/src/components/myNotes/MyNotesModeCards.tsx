import { getModeById } from '../../schemaTherapyData';
import { ModeNote, hex, notePreview } from './shared';

// Список карточек режимов клиента. Вынесено из MyNotesSheet.tsx
// (правило №10).
export function MyNotesModeCards({
  allModeIds,
  modeNotes,
  onOpenMode,
}: {
  allModeIds: string[];
  modeNotes: ModeNote[];
  onOpenMode: (id: string) => void;
}) {
  if (allModeIds.length === 0) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text-faint)',
          marginBottom: 10,
        }}
      >
        Режимы · {allModeIds.length}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        {allModeIds.map((id) => {
          const m = getModeById(id);
          if (!m) return null;
          const note = modeNotes.find((n) => n.modeId === id);
          const filled =
            note &&
            Object.entries(note).some(
              ([k, v]) => k !== 'modeId' && typeof v === 'string' && v.trim(),
            );
          const colorHex = hex(m.groupColor);
          return (
            <div
              key={id}
              onClick={() => onOpenMode(id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpenMode(id);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 14,
                cursor: 'pointer',
                background: `${colorHex}0d`,
                border: `1px solid ${colorHex}20`,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  flexShrink: 0,
                  background: `${colorHex}18`,
                  border: `1px solid ${colorHex}30`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                }}
              >
                {m.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text)',
                    lineHeight: 1.2,
                  }}
                >
                  {m.name}
                </div>
                {filled && note ? (
                  <div
                    style={{
                      fontSize: 11,
                      color: m.groupColor,
                      marginTop: 2,
                    }}
                  >
                    Заполнено · {notePreview(note).slice(0, 35)}
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-faint)',
                      marginTop: 2,
                    }}
                  >
                    Заполнить карточку →
                  </div>
                )}
              </div>
              <span
                style={{
                  color: 'var(--text-faint)',
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                ›
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
