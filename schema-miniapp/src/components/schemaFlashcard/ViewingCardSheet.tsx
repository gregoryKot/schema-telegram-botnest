import { BottomSheet } from '../BottomSheet';
import type { FlashcardEntry } from './data';
import { NEEDS, buildModes } from './data';

interface Props {
  viewing: FlashcardEntry;
  modes: ReturnType<typeof buildModes>;
  onClose: () => void;
}

export function ViewingCardSheet({ viewing, modes, onClose }: Props) {
  const modeInfo = modes.find((m) => m.id === viewing.mode);
  const needInfo = NEEDS.find((n) => n.id === viewing.needId);
  return (
    <BottomSheet onClose={onClose} zIndex={300}>
      <div style={{ paddingTop: 4 }}>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-faint)',
            marginBottom: 16,
          }}
        >
          {viewing.date}
        </div>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 20,
            padding: '16px',
          }}
        >
          {[
            {
              label: 'Режим',
              value: `${modeInfo?.emoji ?? '🧩'} ${modeInfo?.label ?? viewing.mode}`,
            },
            viewing.reflection
              ? { label: 'Рефлексия', value: viewing.reflection }
              : null,
            needInfo
              ? {
                  label: 'Потребность',
                  value: `${needInfo.emoji} ${needInfo.label}`,
                }
              : null,
            viewing.action ? { label: 'Шаг', value: viewing.action } : null,
          ]
            .filter(Boolean)
            .map(
              (row, i, arr) =>
                row && (
                  <div
                    key={row.label}
                    style={{
                      paddingBottom: i < arr.length - 1 ? 12 : 0,
                      marginBottom: i < arr.length - 1 ? 12 : 0,
                      borderBottom:
                        i < arr.length - 1
                          ? '1px solid var(--border-color)'
                          : undefined,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.07em',
                        textTransform: 'uppercase',
                        color: 'var(--text-faint)',
                        marginBottom: 4,
                      }}
                    >
                      {row.label}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        color: 'var(--text)',
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {row.value}
                    </div>
                  </div>
                ),
            )}
        </div>
      </div>
    </BottomSheet>
  );
}
