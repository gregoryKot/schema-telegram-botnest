// Единый блок «сбой ≠ пусто» (правило CLAUDE.md): рисуется вместо скелетона/
// пустого состояния, когда загрузка данных отказала, а не когда данных
// реально нет. Общий компонент — иначе текст/кнопка «Попробовать ещё раз»
// неизбежно разъехались бы по PracticesScreen/PlansScreen/DiarySection
// (правило «одна механика — один компонент»).
export function LoadErrorBanner({
  message,
  onRetry,
  retryLabel = 'Попробовать ещё раз',
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      role="alert"
      style={{
        textAlign: 'center',
        padding: '20px 16px',
        fontSize: 13,
        color: 'var(--accent-red)',
        lineHeight: 1.5,
      }}
    >
      <div>{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: 12,
            padding: '10px 24px',
            borderRadius: 12,
            border: 'none',
            fontFamily: 'inherit',
            background: 'rgba(248,113,113,0.12)',
            color: 'var(--accent-red)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
