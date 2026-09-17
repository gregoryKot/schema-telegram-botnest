interface Props {
  retakeConfirm: boolean;
  setRetakeConfirm: (v: boolean) => void;
  onClose: () => void;
  onRetake: () => void;
}

// Кнопки под результатами теста: сохранить/закрыть, пройти заново.
// «Поделиться» живёт сверху экрана (YsqResultTopBar), не здесь.
export function YsqResultActions({
  retakeConfirm,
  setRetakeConfirm,
  onClose,
  onRetake,
}: Props) {
  return (
    <>
      <button onClick={onClose} className="btn-primary u-mb10">
        Сохранить и закрыть
      </button>

      {retakeConfirm ? (
        <div
          style={{
            background: 'color-mix(in srgb, var(--accent-red) 8%, transparent)',
            borderRadius: 'var(--r-12)',
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
          <div className="u-row8">
            <button
              onClick={() => setRetakeConfirm(false)}
              style={{
                flex: 1,
                padding: '10px',
                border: 'none',
                borderRadius: 'var(--r-10)',
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
                borderRadius: 'var(--r-10)',
                background:
                  'color-mix(in srgb, var(--accent-red) 20%, transparent)',
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
            borderRadius: 'var(--r-14)',
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
