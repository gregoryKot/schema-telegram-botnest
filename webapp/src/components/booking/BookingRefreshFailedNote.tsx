/**
 * Строка под карточкой брони: последняя проверка статуса упала (сеть, 5xx),
 * на экране — то, что было. После таймаута ожидания своя кнопка не нужна:
 * рядом уже стоит «Проверить ещё раз». Текст безличный: страница публичная,
 * формы обращения у неё нет.
 */
export function BookingRefreshFailedNote({ showRetry, onRetry }: { showRetry: boolean; onRetry: () => void }) {
  return (
    <p role="status" style={note}>
      Не удалось обновить статус записи.{' '}
      {showRetry && <button type="button" onClick={onRetry} style={retry}>Повторить</button>}
    </p>
  );
}

const note: React.CSSProperties = { fontSize: 13, color: 'var(--accent-red)', lineHeight: 1.6, margin: '0 0 14px' };
const retry: React.CSSProperties = {
  font: 'inherit', fontWeight: 600, color: 'inherit', background: 'none', border: 'none',
  padding: '12px 4px', minHeight: 44, cursor: 'pointer', textDecoration: 'underline',
};
