import { Need } from '../../types';
import { NeedsWheel } from './NeedsWheel';

// Карточка колеса потребностей за выбранный день + строка ссылок
// (детство / что за этим стоит). Вынесено из HistoryView.tsx (правило №10).
export function WheelCard({
  needs,
  ratings,
  prevRatings,
  childhoodRatings,
  onClickNeed,
  onClickCenter,
  selectedDate,
  onOpenChildhoodWheel,
  onOpenSchemas,
}: {
  needs: Need[];
  ratings: Record<string, number>;
  prevRatings: Record<string, number>;
  childhoodRatings: Partial<Record<string, number>>;
  onClickNeed: (n: Need) => void;
  onClickCenter: () => void;
  selectedDate: string;
  onOpenChildhoodWheel?: () => void;
  onOpenSchemas?: () => void;
}) {
  return (
    <div
      className="card"
      style={{ borderRadius: 'var(--r-20)', paddingTop: 4, paddingBottom: 8 }}
    >
      <div key={selectedDate}>
        <NeedsWheel
          needs={needs}
          ratings={ratings}
          prevRatings={prevRatings}
          childhoodRatings={childhoodRatings}
          onClickNeed={onClickNeed}
          onClickCenter={onClickCenter}
        />
      </div>

      {/* Links row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          paddingBottom: 8,
        }}
      >
        {Object.keys(childhoodRatings).length > 0 ? (
          <div
            onClick={onOpenChildhoodWheel}
            role={onOpenChildhoodWheel ? 'button' : undefined}
            tabIndex={onOpenChildhoodWheel ? 0 : undefined}
            onKeyDown={
              onOpenChildhoodWheel
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenChildhoodWheel();
                    }
                  }
                : undefined
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: onOpenChildhoodWheel ? 'pointer' : 'default',
            }}
          >
            <svg width={16} height={6}>
              <line
                x1={0}
                y1={3}
                x2={16}
                y2={3}
                stroke="rgba(var(--fg-rgb),0.3)"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
            </svg>
            <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
              детство
            </span>
            {onOpenChildhoodWheel && (
              <span style={{ fontSize: 12, color: 'var(--accent)' }}>→</span>
            )}
          </div>
        ) : onOpenChildhoodWheel ? (
          <div
            onClick={onOpenChildhoodWheel}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenChildhoodWheel();
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            <span style={{ fontSize: 12, color: 'var(--accent)' }}>
              Оценить детство →
            </span>
          </div>
        ) : null}
        {onOpenSchemas && (
          <div
            onClick={onOpenSchemas}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenSchemas();
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            <span style={{ fontSize: 12, color: 'var(--accent)' }}>
              Что за этим стоит →
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
