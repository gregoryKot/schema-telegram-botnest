interface ResultFooterProps {
  onClose: () => void;
  retakeConfirm: boolean;
  setRetakeConfirm: (value: boolean) => void;
  handleRetake: () => void;
}

export function ResultFooter({
  onClose,
  retakeConfirm,
  setRetakeConfirm,
  handleRetake,
}: ResultFooterProps) {
  return (
    <>
      <button
        onClick={onClose}
        className="btn-primary"
        style={{ marginTop: 4, marginBottom: 10 }}
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
              onClick={handleRetake}
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

      <div
        style={{
          marginTop: 16,
          fontSize: 11,
          color: 'var(--text-faint)',
          lineHeight: 1.7,
          textAlign: 'center',
        }}
      >
        Это не официальный клинический тест и не диагностика. Профессиональные
        опросники по схемам защищены авторским правом и требуют лицензии — их
        здесь нет. Это самостоятельный образовательный опросник для
        самонаблюдения: помогает примерно сориентироваться в своих паттернах, но
        не ставит диагноз и не заменяет консультацию специалиста.
      </div>
    </>
  );
}
