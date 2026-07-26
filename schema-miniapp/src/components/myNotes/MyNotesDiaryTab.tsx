import { DiaryEntry, fmtDate, EmptyState } from './shared';

// Вкладка «Дневник»: последние записи схемного/режимного дневника и
// благодарности. Вынесено из MyNotesSheet.tsx (правило №10).
export function MyNotesDiaryTab({
  diaryEntries,
}: {
  diaryEntries: DiaryEntry[];
}) {
  return diaryEntries.length === 0 ? (
    <EmptyState
      emoji="📔"
      text="Записи из дневника"
      sub="Дневники доступны на вкладке Дневник"
    />
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {diaryEntries.map((e) => {
        const EMOJI: Record<string, string> = {
          schema: '📓',
          mode: '🔄',
          gratitude: '🌱',
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
              <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                {fmtDate(e.createdAt)}
              </span>
            </div>
            {e.preview && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-sub)',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
              >
                {e.preview}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
