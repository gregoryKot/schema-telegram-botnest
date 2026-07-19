interface Props {
  retakeConfirm: boolean;
  setRetakeConfirm: (v: boolean) => void;
  onShare: () => void;
  onClose: () => void;
  onRetake: () => void;
}

// Кнопки под результатами теста: поделиться, сохранить/закрыть, пройти заново.
export function YsqResultActions({
  retakeConfirm,
  setRetakeConfirm,
  onShare,
  onClose,
  onRetake,
}: Props) {
  return (
    <>
      <button
        onClick={onShare}
        style={{
          width: '100%',
          padding: '14px 0',
          border:
            '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
          borderRadius: 14,
          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
          color: 'var(--accent)',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
          marginTop: 4,
          marginBottom: 10,
        }}
      >
        📤 Поделиться результатами
      </button>

      <button
        onClick={onClose}
        className="btn-primary"
        style={{ marginBottom: 10 }}
      >
        Сохранить и закрыть
      </button>

      {retakeConfirm ? (
        <div
          style={{
            background: 'rgba(255,100,100,0.08)',
            borderRadius: 12,
            padding: '14px 16px',
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: 'var(--text-sub)',
              marginBottom: 12,
            }}
          >
            Результаты будут удалены. Точно начать заново?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setRetakeConfirm(false)}
              style={{
                flex: 1,
                padding: '10px',
                border: 'none',
                borderRadius: 10,
                background: 'rgba(var(--fg-rgb),0.08)',
                color: 'var(--text-sub)',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Отмена
            </button>
            <button
              onClick={onRetake}
              style={{
                flex: 1,
                padding: '10px',
                border: 'none',
                borderRadius: 10,
                background: 'rgba(255,100,100,0.2)',
                color: 'var(--accent-red)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Начать заново
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setRetakeConfirm(true)}
          style={{
            width: '100%',
            padding: '14px 0',
            border: 'none',
            borderRadius: 14,
            background: 'rgba(var(--fg-rgb),0.07)',
            color: 'var(--text-sub)',
            fontSize: 15,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Пройти заново
        </button>
      )}
    </>
  );
}
