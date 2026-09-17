import { BottomSheet } from '../BottomSheet';
import { TherapyNote } from '../TherapyNote';
import { ProgressBar } from './ProgressBar';
import { NEEDS } from './constants';

interface NeedStepProps {
  selectedNeed: string | null;
  stepIndex: number;
  onClose: () => void;
  onBack: () => void;
  onSelectNeed: (id: string) => void;
}

export function NeedStep({
  selectedNeed,
  stepIndex,
  onClose,
  onBack,
  onSelectNeed,
}: NeedStepProps) {
  return (
    <BottomSheet onClose={onClose}>
      <div className="u-pt4">
        <div className="u-mb16">
          <div className="u-h17">Что за этим стоит?</div>
          <div className="u-faint12-mt2">Шаг 3 из 4 — нужда</div>
        </div>
        <ProgressBar stepIndex={stepIndex} />
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            marginBottom: 14,
            lineHeight: 1.5,
          }}
        >
          Какая потребность сейчас не удовлетворена?
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-8)',
            marginBottom: 16,
          }}
        >
          {NEEDS.map((n) => {
            const sel = selectedNeed === n.id;
            return (
              <button
                key={n.id}
                onClick={() => onSelectNeed(n.id)}
                style={{
                  textAlign: 'left',
                  padding: '13px 16px',
                  borderRadius: 'var(--r-14)',
                  cursor: 'pointer',
                  border: `1px solid ${sel ? 'var(--accent)' : 'var(--border-color)'}`,
                  background: sel ? 'var(--surface-2)' : 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: 14,
                  fontWeight: sel ? 600 : 400,
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-10)',
                }}
              >
                {n.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={onBack}
          style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--r-12)',
            border: 'none',
            fontFamily: 'inherit',
            background: 'var(--surface-2)',
            color: 'var(--text-sub)',
            fontSize: 18,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ←
        </button>
        <div className="u-mt20">
          <TherapyNote compact />
        </div>
      </div>
    </BottomSheet>
  );
}
