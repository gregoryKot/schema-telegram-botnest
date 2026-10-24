// Пара «Отмена | Удалить» подтверждения в шторках настроек мини-аппа — одна
// на удаление аккаунта (DeleteOverlay) и удаление результатов теста
// (YsqDataDelete): «одна механика — один компонент». Высота ≥44 — зона нажатия.
const base = {
  flex: 1,
  minHeight: 44,
  padding: '14px 0',
  borderRadius: 'var(--r-14)',
  fontSize: 14,
  fontFamily: 'inherit',
} as const;

export function ConfirmButtons({
  confirmLabel,
  onConfirm,
  onCancel,
  cancelLabel = 'Отмена',
  busy = false,
  busyLabel,
}: {
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  cancelLabel?: string;
  busy?: boolean;
  busyLabel?: string;
}) {
  return (
    <div className="u-row8">
      <button
        onClick={onCancel}
        disabled={busy}
        style={{
          ...base,
          border: '1px solid rgba(var(--fg-rgb),0.1)',
          background: 'transparent',
          color: 'var(--text-sub)',
          cursor: busy ? 'default' : 'pointer',
        }}
      >
        {cancelLabel}
      </button>
      <button
        onClick={onConfirm}
        disabled={busy}
        style={{
          ...base,
          border: 'none',
          background: 'color-mix(in srgb, var(--accent-red) 15%, transparent)',
          color: 'var(--accent-red)',
          fontWeight: 600,
          cursor: busy ? 'default' : 'pointer',
        }}
      >
        {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
      </button>
    </div>
  );
}
