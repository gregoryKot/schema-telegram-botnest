import { BottomSheet } from '../BottomSheet';
import { TherapyNote } from '../TherapyNote';
import { ProgressBar } from './ProgressBar';
import { NEEDS } from './constants';

interface ActionStepProps {
  selectedNeed: string | null;
  action: string;
  setAction: (v: string) => void;
  stepIndex: number;
  tr: (ty: string, vy: string) => string;
  onClose: () => void;
  onBack: () => void;
  onSave: () => void;
}

export function ActionStep({
  selectedNeed,
  action,
  setAction,
  stepIndex,
  tr,
  onClose,
  onBack,
  onSave,
}: ActionStepProps) {
  const needInfo = NEEDS.find((n) => n.id === selectedNeed);
  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
            Один маленький шаг
          </div>
          <div
            style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}
          >
            Шаг 4 из 4
          </div>
        </div>
        <ProgressBar stepIndex={stepIndex} />
        {needInfo && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'var(--surface)',
              border: '1px solid var(--border-color)',
              borderRadius: 14,
              padding: '11px 14px',
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 20 }}>{needInfo.emoji}</span>
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--text-faint)',
                  marginBottom: 1,
                }}
              >
                Потребность
              </div>
              <div
                style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}
              >
                {needInfo.label}
              </div>
            </div>
          </div>
        )}
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            marginBottom: 8,
            lineHeight: 1.5,
          }}
        >
          {tr(
            'Что одно маленькое действие ты можешь сделать прямо сейчас?',
            'Что одно маленькое действие вы можете сделать прямо сейчас?',
          )}
        </div>
        <textarea
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Написать другу, выйти подышать, обнять подушку..."
          rows={3}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: 'var(--surface)',
            border: `1px solid ${action.trim() ? 'var(--accent)' : 'var(--border-color)'}`,
            borderRadius: 14,
            padding: '12px 14px',
            color: 'var(--text)',
            fontSize: 14,
            lineHeight: 1.55,
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            marginBottom: 16,
            transition: 'border-color 0.2s',
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
            onClick={onSave}
            disabled={!action.trim()}
            style={{
              flex: 1,
              padding: '13px',
              borderRadius: 12,
              border: 'none',
              fontFamily: 'inherit',
              background: action.trim()
                ? 'rgba(52,211,153,0.15)'
                : 'var(--surface-2)',
              outline: action.trim()
                ? '1px solid rgba(52,211,153,0.25)'
                : 'none',
              color: action.trim()
                ? 'var(--accent-green)'
                : 'var(--text-faint)',
              fontSize: 14,
              fontWeight: 600,
              cursor: action.trim() ? 'pointer' : 'default',
              transition: 'all 0.2s',
            }}
          >
            Сохранить
          </button>
        </div>
        <div style={{ marginTop: 20 }}>
          <TherapyNote compact />
        </div>
      </div>
    </BottomSheet>
  );
}
