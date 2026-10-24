// Экран `/auth/error` — вынесен из App.tsx (правило №10, файл заморожен).
// К2 (аудит 2026-08): экран-тупик молчал наверх — не звал useAuthFailureReport,
// хотя на него стекаются все виды сбоя Telegram-логина
// (TelegramWidgetCallback.tsx: telegram_no_data, http_*, telegram_failed…).
import { getHost } from '../../../shared/src/host';
import { useAuthFailureReport } from '../../../shared/src/host/authFailureReport';
import { reportClientError } from '../api';
import { ServicePage } from './service/ServicePage';

export function AuthErrorPage() {
  const reason = new URLSearchParams(window.location.search).get('reason') ?? '';
  useAuthFailureReport(
    reportClientError,
    reason
      ? {
          hostId: getHost().id,
          signaturePresent:
            ((getHost().sessionExchange()?.body.initData as string) ?? '') !== '',
          error: reason,
        }
      : null,
  );
  return (
    <ServicePage>
      <div className="as-body">
        <div className="ds-eyebrow">Ошибка входа</div>
        <h1 className="ds-h2">Что-то пошло не так</h1>
        <p className="as-lead">Авторизация не удалась. Попробовать снова или написать нам в Telegram.</p>
        {reason && <p className="as-reason">{reason}</p>}
        <div className="as-actions-row">
          <a href="/login" className="ds-btn">Попробовать снова</a>
          <a href="https://t.me/kotlarewski" target="_blank" rel="noopener noreferrer" className="ds-btn ds-btn--secondary">
            Написать
          </a>
        </div>
      </div>
    </ServicePage>
  );
}
