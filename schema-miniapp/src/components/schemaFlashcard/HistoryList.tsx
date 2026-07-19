import { pressable } from '../../utils/a11y';
import { BottomSheet } from '../BottomSheet';
import { NEEDS } from './constants';
import type { FlashcardEntry, ModeData } from './types';

interface HistoryListProps {
  allCards: FlashcardEntry[];
  modes: ModeData[];
  onClose: () => void;
  onView: (card: FlashcardEntry) => void;
}

export function HistoryList({
  allCards,
  modes,
  onClose,
  onView,
}: HistoryListProps) {
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
                {...pressable(() => onView(card))}
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
