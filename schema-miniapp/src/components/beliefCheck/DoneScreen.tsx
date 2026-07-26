// Финальный экран проверки убеждения — сводка доказательств.
// Вынесено из BeliefCheck.tsx.
import { BottomSheet } from '../BottomSheet';

export function BeliefDoneScreen({
  belief,
  forList,
  againstList,
  reframe,
  onClose,
}: {
  belief: string;
  forList: string[];
  againstList: string[];
  reframe: string;
  onClose: () => void;
}) {
  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4, textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>🔍</div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 6,
          }}
        >
          Проверено
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            lineHeight: 1.5,
            marginBottom: 20,
          }}
        >
          Иногда достаточно увидеть доказательства, чтобы мысль потеряла силу
        </div>
        <div
          style={{
            background: 'rgba(96,165,250,0.08)',
            border: '1px solid rgba(96,165,250,0.15)',
            borderRadius: 16,
            padding: '14px 16px',
            textAlign: 'left',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: 'var(--accent-blue)',
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            УБЕЖДЕНИЕ
          </div>
          <div
            style={{
              fontSize: 14,
              color: 'var(--text)',
              marginBottom: 12,
              lineHeight: 1.5,
            }}
          >
            «{belief}»
          </div>
          {forList.length > 0 && (
            <>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--accent-red)',
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                ЗА ({forList.length})
              </div>
              {forList.map((f, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 12,
                    color: 'var(--text-sub)',
                    marginBottom: 2,
                  }}
                >
                  • {f}
                </div>
              ))}
              <div style={{ marginBottom: 10 }} />
            </>
          )}
          {againstList.length > 0 && (
            <>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--accent-green)',
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                ПРОТИВ ({againstList.length})
              </div>
              {againstList.map((a, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 12,
                    color: 'var(--text-sub)',
                    marginBottom: 2,
                  }}
                >
                  • {a}
                </div>
              ))}
              <div style={{ marginBottom: 10 }} />
            </>
          )}
          {reframe && (
            <>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--accent)',
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                ПЕРЕФОРМУЛИРОВКА
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'rgba(var(--fg-rgb),0.75)',
                  lineHeight: 1.5,
                }}
              >
                {reframe}
              </div>
            </>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '13px 0',
            borderRadius: 14,
            border: 'none',
            background: 'rgba(96,165,250,0.15)',
            color: 'var(--accent-blue)',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Готово
        </button>
      </div>
    </BottomSheet>
  );
}
