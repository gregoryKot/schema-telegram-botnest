import { getHost } from '../../../../shared/src/host';
import { AuthFailureHelp } from '../../../../shared/src/components/AuthFailureHelp';

// Внутри мессенджера автовход не сработал — минимальный экран повтора.
export function TelegramRetry({ loading, error, onRetry }: {
  loading: boolean; error: string | null; onRetry: () => void;
}) {
  return (
    <div className="light-lock al-retry">
      <p className="al-sub">{loading ? 'Загрузка...' : 'Не удалось войти автоматически'}</p>
      {error && <p className="al-error" style={{ maxWidth: 320 }}>{error}</p>}
      <button className="al-submit" style={{ maxWidth: 280 }} onClick={onRetry} disabled={loading}>Попробовать снова</button>
      {/* Экран обязан назвать, кому написать (пара к AppErrorScreen, правило №3). */}
      <div className="al-retry-help"><AuthFailureHelp hostId={getHost().id} /></div>
    </div>
  );
}
