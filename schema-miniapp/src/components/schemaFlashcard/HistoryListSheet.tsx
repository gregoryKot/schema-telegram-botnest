import { BottomSheet } from '../BottomSheet';
import type { FlashcardEntry } from './data';
import { NEEDS, buildModes } from './data';

interface Props {
  allCards: FlashcardEntry[];
  modes: ReturnType<typeof buildModes>;
  onClose: () => void;
  onSelect: (card: FlashcardEntry) => void;
}

export function HistoryListSheet({
  allCards,
  modes,
  onClose,
  onSelect,
}: Props) {
  return (
    <BottomSheet onClose={onClose} zIndex={300}>
      <div style={{ paddingTop: 4 }}>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 16,
          }}
        >
          История карточек
        </div>
        {allCards.length === 0 ? (
          <div
            style={{
              fontSize: 14,
              color: 'var(--text-sub)',
              textAlign: 'center',
              padding: '24px 0',
            }}
          >
            Пока нет сохранённых карточек
          </div>
        ) : (
          allCards.map((card) => {
            const m = modes.find((x) => x.id === card.mode);
            const n = NEEDS.find((x) => x.id === card.needId);
            return (
              <div
                key={card.id}
                onClick={() => onSelect(card)}
                style={{
                  padding: '12px 14px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 16,
                  marginBottom: 8,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-faint)',
                    marginBottom: 4,
                  }}
                >
                  {card.date}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text)',
                    lineHeight: 1.4,
                  }}
                >
                  {m?.emoji ?? '🧩'} {m?.label ?? card.mode}
                  {n ? ` · ${n.emoji} ${n.label}` : ''}
                </div>
                {card.action && (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--accent-green)',
                      marginTop: 4,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    → {card.action}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </BottomSheet>
  );
}
