import { BottomSheet } from '../BottomSheet';
import { NEEDS, buildModes } from './data';

interface Props {
  modes: ReturnType<typeof buildModes>;
  selectedMode: string | null;
  selectedNeed: string | null;
  action: string;
  onClose: () => void;
  onOpenTracker?: () => void;
  onNew: () => void;
  tr: (ty: string, vy: string) => string;
}

export function DoneSheet({
  modes,
  selectedMode,
  selectedNeed,
  action,
  onClose,
  onOpenTracker,
  onNew,
  tr,
}: Props) {
  const modeInfo = modes.find((m) => m.id === selectedMode);
  const needInfo = NEEDS.find((n) => n.id === selectedNeed);
  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🌿</div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: 6,
            }}
          >
            Сохранено
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-sub)',
              lineHeight: 1.6,
            }}
          >
            {tr(
              'Ты сделал шаг навстречу себе. Это уже немало.',
              'Вы сделали шаг навстречу себе. Это уже немало.',
            )}
          </div>
        </div>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 20,
            padding: '16px',
            marginBottom: 20,
          }}
        >
          {[
            {
              label: 'Режим',
              value: `${modeInfo?.emoji} ${modeInfo?.label}`,
            },
            needInfo
              ? {
                  label: 'Потребность',
                  value: `${needInfo.emoji} ${needInfo.label}`,
                }
              : null,
            action ? { label: 'Шаг', value: action } : null,
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
                        marginBottom: 3,
                      }}
                    >
                      {row.label}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        color: 'var(--text)',
                        lineHeight: 1.5,
                      }}
                    >
                      {row.value}
                    </div>
                  </div>
                ),
            )}
        </div>
        {onOpenTracker && (
          <button
            onClick={() => {
              onClose();
              setTimeout(onOpenTracker, 100);
            }}
            style={{
              width: '100%',
              padding: '13px',
              borderRadius: 14,
              border: 'none',
              fontFamily: 'inherit',
              background: 'var(--surface)',
              outline: '1px solid var(--border-color)',
              color: 'var(--accent)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: 10,
            }}
          >
            Открыть трекер →
          </button>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onNew}
            style={{
              flex: 1,
              padding: '13px',
              borderRadius: 14,
              border: 'none',
              fontFamily: 'inherit',
              background: 'var(--surface-2)',
              color: 'var(--text-sub)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Ещё одну
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '13px',
              borderRadius: 14,
              border: 'none',
              fontFamily: 'inherit',
              background: 'rgba(var(--fg-rgb),0.06)',
              color: 'var(--accent)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Готово
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
