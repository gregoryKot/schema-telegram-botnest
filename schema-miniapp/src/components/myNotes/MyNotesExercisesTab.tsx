import { Exercise, SafeEntry, fmtDate, EmptyState } from './shared';

// Вкладка «Упражнения»: безопасное место + выполненные упражнения
// (проверки убеждений, письма, карточки кризиса). Вынесено из
// MyNotesSheet.tsx (правило №10).
export function MyNotesExercisesTab({
  exercises,
  safePlace,
}: {
  exercises: Exercise[];
  safePlace: SafeEntry;
}) {
  return exercises.length === 0 && !safePlace ? (
    <EmptyState
      emoji="🔍"
      text="Выполненные упражнения"
      sub="Проверки убеждений, письма, карточки кризиса"
    />
  ) : (
    <>
      {safePlace && (
        <div
          style={{
            background:
              'color-mix(in srgb, var(--accent-green) 6%, transparent)',
            border:
              '1px solid color-mix(in srgb, var(--accent-green) 12%, transparent)',
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--accent-green)',
              }}
            >
              🏡 Безопасное место
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              {new Date(safePlace.updatedAt).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'short',
              })}
            </span>
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-sub)',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {safePlace.description}
          </div>
        </div>
      )}
      {exercises.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {exercises.map((e) => {
            const EMOJI: Record<string, string> = {
              belief: '🔍',
              letter: '✉️',
              flashcard: '🆘',
            };
            return (
              <div
                key={`${e.type}-${e.id}`}
                style={{
                  background: 'rgba(var(--fg-rgb),0.03)',
                  border: '1px solid rgba(var(--fg-rgb),0.07)',
                  borderRadius: 12,
                  padding: '12px 14px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-sub)',
                    }}
                  >
                    {EMOJI[e.type]} {e.label}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--text-faint)',
                    }}
                  >
                    {fmtDate(e.createdAt)}
                  </span>
                </div>
                {e.preview && (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-sub)',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {e.preview}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
