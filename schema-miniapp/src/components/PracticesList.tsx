import { SkeletonList } from './Skeleton';
import { LoadErrorBanner } from './LoadErrorBanner';
import { pressable } from '../utils/a11y';
import { UserPractice } from '../api';

// Список практик — вынесено из PracticesScreen.tsx (правило №10, файл был
// над потолком в 300 строк). Три состояния: сбой загрузки (LoadErrorBanner —
// «сбой ≠ пусто»), загрузка (скелетон), пусто/список.
export function PracticesList({
  loadFailed,
  failedMessage,
  practices,
  onDelete,
}: {
  loadFailed: boolean;
  failedMessage: string;
  practices: UserPractice[] | null;
  onDelete: (id: number) => void;
}) {
  if (loadFailed) {
    // Практики есть, просто не загрузились — не путать с «Пока пусто» ниже,
    // иначе человек решит, что список стёрт.
    return <LoadErrorBanner message={failedMessage} />;
  }
  if (!practices) return <SkeletonList rows={4} h={84} />;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        marginBottom: 16,
      }}
    >
      {practices.length === 0 && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-sub)',
            padding: '20px 0',
            textAlign: 'center',
          }}
        >
          Пока пусто — добавь первую практику ниже
        </div>
      )}
      {practices.map((p) => (
        <div
          key={p.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(var(--fg-rgb),0.04)',
            borderRadius: 14,
            padding: '13px 14px',
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: 'rgba(var(--fg-rgb),0.85)',
              flex: 1,
              lineHeight: 1.5,
            }}
          >
            {p.text}
          </div>
          <div
            {...pressable(() => onDelete(p.id))}
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              flexShrink: 0,
              background: 'rgba(255,100,100,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 16,
              color: 'rgba(255,100,100,0.5)',
            }}
          >
            ×
          </div>
        </div>
      ))}
    </div>
  );
}
