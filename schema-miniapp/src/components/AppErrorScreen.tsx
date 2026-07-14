// Полноэкранный экран ошибки загрузки App.tsx (истёкшая сессия vs. сетевой
// сбой). Перенесено из App.tsx как есть (этап 3 REMEDIATION_PLAN).
export function AppErrorScreen({ error }: { error: string }) {
  const isAuthError = error.includes('401') || error.includes('403');
  return (
    <div
      style={{
        padding: 32,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70vh',
        gap: 16,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 40 }}>{isAuthError ? '🔐' : '😔'}</div>
      <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>
        {isAuthError ? 'Сессия истекла' : 'Не удалось загрузить'}
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6 }}>
        {isAuthError
          ? 'Закрой приложение полностью и открой заново — Telegram выдаст свежий токен'
          : 'Проверь подключение и попробуй ещё раз'}
      </div>
      {isAuthError ? (
        <button
          onClick={() => window.Telegram?.WebApp?.close()}
          style={{
            padding: '13px 28px',
            border: 'none',
            borderRadius: 14,
            background: 'var(--accent)',
            color: 'var(--text)',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Закрыть приложение
        </button>
      ) : (
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '13px 28px',
            border: 'none',
            borderRadius: 14,
            background: 'var(--accent)',
            color: 'var(--text)',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Повторить
        </button>
      )}
    </div>
  );
}
