import { hitboxStyle } from '../utils/hitbox';

// Кнопка удаления строки списка в два тапа: «×» → «Точно удалить?» → удалено.
// Состояние держит общий хук useConfirmTap (shared/src/hooks), вид — здесь,
// один на все списки мини-аппа: практики, задания клиента в кабинете,
// заметки сессий («одна механика — один компонент»). До 2026-10-26 вид жил
// инлайном в PracticesList, а задание и заметку сессии удаляли одним тапом
// или не удаляли вовсе (QA-проход).
export function ConfirmDeleteButton({
  pending,
  onTap,
  label,
  disabled = false,
}: {
  pending: boolean;
  onTap: () => void;
  /** Что удаляется — для скринридера: «Удалить практику». */
  label: string;
  disabled?: boolean;
}) {
  if (pending)
    return (
      <button
        onClick={onTap}
        disabled={disabled}
        style={{
          flexShrink: 0,
          minHeight: 44,
          padding: '0 14px',
          borderRadius: 9,
          border: 'none',
          background: 'color-mix(in srgb, var(--accent-red) 16%, transparent)',
          color: 'var(--accent-red)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Точно удалить?
      </button>
    );
  return (
    <button
      onClick={onTap}
      disabled={disabled}
      aria-label={label}
      style={{ ...hitboxStyle(30, 30).outer, flexShrink: 0 }}
    >
      <span
        style={{
          ...hitboxStyle(30, 30).inner,
          borderRadius: 9,
          background: 'color-mix(in srgb, var(--accent-red) 10%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          color: 'color-mix(in srgb, var(--accent-red) 50%, transparent)',
        }}
      >
        ×
      </span>
    </button>
  );
}
