import { getHost } from '../../../shared/src/host';

const BTN_STYLE = {
  padding: '13px 28px',
  border: 'none',
  borderRadius: 14,
  background: 'var(--accent)',
  color: 'var(--text)',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
} as const;

// Полноэкранный экран ошибки загрузки App.tsx (истёкшая сессия vs. сетевой
// сбой). Перенесено из App.tsx как есть (этап 3 REMEDIATION_PLAN).
export function AppErrorScreen({ error }: { error: string }) {
  const isAuthError = error.includes('401') || error.includes('403');
  // Вкладку браузера изнутри не закрыть — там лечение другое, перезагрузка.
  const canClose = getHost().capabilities.close;
  // Раньше здесь было «Сессия истекла» и «Telegram выдаст свежий токен» —
  // оба утверждения врали в MAX: мессенджер назван не тот, а на первом
  // открытии сессия не истекала, её просто не удалось получить. Заголовок
  // теперь описывает то, что мы действительно знаем, а мессенджер берётся
  // у хоста.
  const hostName = getHost().id === 'max' ? 'MAX' : 'Telegram';
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
        {isAuthError ? 'Не удалось войти' : 'Не удалось загрузить'}
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-sub)', lineHeight: 1.6 }}>
        {!isAuthError
          ? 'Проверь подключение и попробуй ещё раз'
          : `Попробуй закрыть приложение полностью и открыть заново — ${hostName} выдаст свежий пропуск. Если не поможет, напиши нам: дело на нашей стороне.`}
      </div>
      {isAuthError && canClose ? (
        <button onClick={() => getHost().close()} style={BTN_STYLE}>
          Закрыть приложение
        </button>
      ) : (
        <button onClick={() => window.location.reload()} style={BTN_STYLE}>
          {isAuthError ? 'Обновить' : 'Повторить'}
        </button>
      )}
    </div>
  );
}
