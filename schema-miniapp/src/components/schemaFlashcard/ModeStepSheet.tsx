import { BottomSheet } from '../BottomSheet';
import { TherapyNote } from '../TherapyNote';
import { ProgressBar } from './ProgressBar';
import { buildModes } from './data';

interface Props {
  modes: ReturnType<typeof buildModes>;
  cardsCount: number;
  stepIndex: number;
  onClose: () => void;
  onShowHistory: () => void;
  onSelect: (modeId: string) => void;
}

export function ModeStepSheet({
  modes,
  cardsCount,
  stepIndex,
  onClose,
  onShowHistory,
  onSelect,
}: Props) {
  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 16,
          }}
        >
          <div>
            <div
              style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}
            >
              Что сейчас активно?
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-faint)',
                marginTop: 2,
              }}
            >
              Шаг 1 из 4 — выбери режим
            </div>
          </div>
          {cardsCount > 0 && (
            <button
              onClick={onShowHistory}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 11,
                color: 'var(--text-faint)',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              История
            </button>
          )}
        </div>
        <ProgressBar stepIndex={stepIndex} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              style={{
                textAlign: 'left',
                padding: '14px 16px',
                borderRadius: 16,
                border: '1px solid var(--border-color)',
                background: 'var(--surface)',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 20 }}>{m.emoji}</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: m.color }}>
                  {m.label}
                </span>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-faint)',
                  paddingLeft: 30,
                }}
              >
                {m.desc}
              </div>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 20 }}>
          <TherapyNote compact />
        </div>
      </div>
    </BottomSheet>
  );
}
