import { getHost } from '../../../../shared/src/host';
import { AuthFailureHelp } from '../../../../shared/src/components/AuthFailureHelp';
import { PaperOutcome } from '../../components/paper/PaperOutcome';
import { exchangeErrorCode, exchangeErrorLead } from './exchangeError';

// Внутри мессенджера автовход не сработал — исход «на нашей стороне» (Breath на персике).
// Строка сбоя (exchangeError.ts: «Ошибка 401: …» с телом сервера) целиком нужна отчёту, а не человеку: в слоте
// `code` — только короткий код (exchangeErrorCode), мелко, моноширинно. Повтор идёт — кнопка
// занята («Загрузка...» — её подпись), а не текст вместо заголовка.
export function TelegramRetry({ loading, error, onRetry }: {
  loading: boolean; error: string | null; onRetry: () => void;
}) {
  return (
    <PaperOutcome outcome="our_side" className="al-retry" title="Не удалось войти автоматически" lead={error ? exchangeErrorLead(error) : null}
                  code={error ? exchangeErrorCode(error) : null}>
      <button type="button" className="ds-btn ds-btn--lg pa-outcome-action" onClick={onRetry}
              disabled={loading} aria-busy={loading || undefined}>
        {loading ? 'Загрузка...' : 'Попробовать снова'}
      </button>
      {/* Экран обязан назвать, кому написать (пара к AppErrorScreen, правило №3). */}
      <div className="al-retry-help"><AuthFailureHelp hostId={getHost().id} /></div>
    </PaperOutcome>
  );
}
