import { SkeletonList } from './Skeleton';
import { LoadErrorBanner } from './LoadErrorBanner';
import { UserPractice } from '../api';
import { useTr } from '../utils/addressForm';
import { useConfirmTap } from '../hooks/useConfirmTap';
import { ConfirmDeleteButton } from './ConfirmDeleteButton';

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
  const tr = useTr();
  const { tap: tapDelete, isPending } = useConfirmTap<number>(onDelete);
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
        gap: 'var(--space-8)',
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
          {tr(
            'Пока пусто — добавь первую практику ниже',
            'Пока пусто — добавьте первую практику ниже',
          )}
        </div>
      )}
      {practices.map((p) => (
        <div
          key={p.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-10)',
            background: 'rgba(var(--fg-rgb),0.04)',
            borderRadius: 'var(--r-14)',
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
          <ConfirmDeleteButton
            pending={isPending(p.id)}
            onTap={() => tapDelete(p.id)}
            label="Удалить практику"
          />
        </div>
      ))}
    </div>
  );
}
