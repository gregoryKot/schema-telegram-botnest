// Строка варианта практики в плане: выбор варианта + удаление своей.
// Вынесено из PlanSheet.tsx (правило №10).
export function PracticeOptionRow({
  text,
  isUser,
  id,
  color,
  onSelect,
  deleting,
  onDelete,
}: {
  text: string;
  isUser: boolean;
  id?: number;
  color: string;
  onSelect: () => void;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}
    >
      <div
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-10)',
          flex: 1,
          background: 'rgba(var(--fg-rgb),0.05)',
          border: '1px solid rgba(var(--fg-rgb),0.08)',
          borderRadius: 'var(--r-12)',
          padding: '11px 14px',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            flexShrink: 0,
            background: isUser ? color : 'rgba(var(--fg-rgb),0.2)',
          }}
        />
        <div
          style={{
            fontSize: 14,
            color: 'rgba(var(--fg-rgb),0.85)',
            flex: 1,
            lineHeight: 1.45,
          }}
        >
          {text}
        </div>
        <div
          style={{ fontSize: 18, color: 'var(--text-faint)', flexShrink: 0 }}
        >
          ›
        </div>
      </div>
      {isUser && id !== undefined && (
        <div
          onClick={onDelete}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onDelete();
            }
          }}
          style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--r-8)',
            flexShrink: 0,
            background: 'rgba(255,100,100,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: deleting ? 'default' : 'pointer',
            fontSize: 16,
            color: deleting ? 'rgba(255,100,100,0.2)' : 'rgba(255,100,100,0.5)',
          }}
        >
          ×
        </div>
      )}
    </div>
  );
}
