import { BottomSheet } from '../BottomSheet';

interface GroundingStepProps {
  allCardsCount: number;
  tr: (ty: string, vy: string) => string;
  onClose: () => void;
  onContinue: () => void;
  onShowHistory: () => void;
}

export function GroundingStep({
  allCardsCount,
  tr,
  onClose,
  onContinue,
  onShowHistory,
}: GroundingStepProps) {
  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4, textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>💙</div>
        <div
          style={{
            fontSize: 19,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 10,
          }}
        >
          {tr('Ты сделал правильно', 'Вы сделали правильно')}
        </div>
        <div
          style={{
            fontSize: 14,
            color: 'var(--text-sub)',
            lineHeight: 1.8,
            marginBottom: 24,
          }}
        >
          {tr(
            'То, что ты чувствуешь сейчас — это нормально.',
            'То, что вы чувствуете сейчас — это нормально.',
          )}
          <br />
          Это пройдёт.
        </div>
        {/* Breathing box */}
        <div
          style={{
            background: 'rgba(96,165,250,0.07)',
            border: '1px solid rgba(96,165,250,0.18)',
            borderRadius: 20,
            padding: '18px 16px',
            marginBottom: 24,
            textAlign: 'left',
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--accent-blue)',
              marginBottom: 14,
            }}
          >
            Три вдоха прямо сейчас
          </div>
          {[
            'Вдох через нос — 4 секунды',
            'Задержи — 2 секунды',
            'Медленный выдох — 6 секунд',
          ].map((t, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: i < 2 ? 10 : 0,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: 'rgba(96,165,250,0.14)',
                  border: '1px solid rgba(96,165,250,0.22)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  color: 'var(--accent-blue)',
                  fontWeight: 700,
                }}
              >
                {i + 1}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-sub)' }}>{t}</div>
            </div>
          ))}
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-faint)',
            marginBottom: 20,
          }}
        >
          {tr(
            'Почувствуй ноги на полу. Ты в безопасности.',
            'Почувствуйте ноги на полу. Вы в безопасности.',
          )}
        </div>
        <button
          onClick={onContinue}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 14,
            border: 'none',
            fontFamily: 'inherit',
            background: 'rgba(96,165,250,0.12)',
            outline: '1px solid rgba(96,165,250,0.22)',
            color: 'var(--accent-blue)',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 10,
          }}
        >
          Стало чуть лучше — разобраться →
        </button>
        {allCardsCount > 0 && (
          <button
            onClick={onShowHistory}
            style={{
              width: '100%',
              padding: '11px',
              borderRadius: 14,
              fontFamily: 'inherit',
              border: 'none',
              background: 'var(--surface)',
              outline: '1px solid var(--border-color)',
              color: 'var(--text-sub)',
              fontSize: 13,
              cursor: 'pointer',
              marginBottom: 10,
            }}
          >
            История карточек ({allCardsCount})
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '11px',
            borderRadius: 14,
            border: 'none',
            fontFamily: 'inherit',
            background: 'transparent',
            color: 'var(--text-faint)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Просто закрыть
        </button>
      </div>
    </BottomSheet>
  );
}
