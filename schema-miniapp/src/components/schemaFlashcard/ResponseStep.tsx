import { BottomSheet } from '../BottomSheet';
import { TherapyNote } from '../TherapyNote';
import { ProgressBar } from './ProgressBar';
import type { ModeData } from './types';

interface ResponseStepProps {
  modeData: ModeData | undefined;
  reflection: string;
  setReflection: (v: string) => void;
  stepIndex: number;
  tr: (ty: string, vy: string) => string;
  onClose: () => void;
  onBack: () => void;
  onNext: () => void;
}

export function ResponseStep({
  modeData,
  reflection,
  setReflection,
  stepIndex,
  tr,
  onClose,
  onBack,
  onNext,
}: ResponseStepProps) {
  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
            Здоровый Взрослый
          </div>
          <div
            style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}
          >
            Шаг 2 из 4
          </div>
        </div>
        <ProgressBar stepIndex={stepIndex} />
        <div
          style={{
            background: 'rgba(52,211,153,0.07)',
            border: '1px solid rgba(52,211,153,0.18)',
            borderRadius: 20,
            padding: '16px',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--accent-green)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 10,
            }}
          >
            {tr('🌿 Говорит тебе', '🌿 Говорит вам')}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.7 }}>
            {modeData?.response}
          </div>
        </div>
        <div
          style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 8 }}
        >
          Что отзывается?{' '}
          <span style={{ color: 'var(--text-faint)' }}>(необязательно)</span>
        </div>
        <textarea
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="Что хочется сказать себе..."
          rows={3}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: 'var(--surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 14,
            padding: '12px 14px',
            color: 'var(--text)',
            fontSize: 14,
            lineHeight: 1.55,
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            marginBottom: 16,
          }}
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onBack}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
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
          <button
            onClick={onNext}
            style={{
              flex: 1,
              padding: '13px',
              borderRadius: 12,
              border: 'none',
              fontFamily: 'inherit',
              background: 'rgba(var(--fg-rgb),0.08)',
              color: 'var(--text)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Дальше →
          </button>
        </div>
        <div style={{ marginTop: 20 }}>
          <TherapyNote compact />
        </div>
      </div>
    </BottomSheet>
  );
}
