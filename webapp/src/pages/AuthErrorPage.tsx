// Экран `/auth/error` — вынесен из App.tsx (правило №10, файл заморожен).
// К2 (аудит 2026-08): экран-тупик молчал наверх — не звал useAuthFailureReport,
// хотя на него стекаются все виды сбоя Telegram-логина
// (TelegramWidgetCallback.tsx: telegram_no_data, http_*, telegram_failed…).
import { getHost } from '../../../shared/src/host';
import { useAuthFailureReport } from '../../../shared/src/host/authFailureReport';
import { reportClientError } from '../api';

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
    <div style={{ flex: 1, minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div className="eyebrow" style={{ color: 'var(--c-rose)', marginBottom: 20 }}>Ошибка входа</div>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 42, fontWeight: 400, lineHeight: 1.15, color: 'var(--text)', margin: '0 0 16px' }}>
          Что-то<br /><span style={{ fontStyle: 'italic' }}>пошло не так</span>
        </h1>
        <p style={{ fontSize: 15, color: 'var(--text-sub)', lineHeight: 1.7, margin: '0 0 36px' }}>
          Авторизация не удалась. Попробовать снова или написать нам в Telegram.
        </p>
        {reason && (
          <p style={{ fontSize: 12, color: 'var(--text-faint)', margin: '0 0 24px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {reason}
          </p>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-12)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/login" style={{ display: 'inline-block', padding: '13px 28px', background: 'var(--text)', color: 'var(--bg)', borderRadius: 'var(--r-8)', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
            Попробовать снова
          </a>
          <a href="https://t.me/kotlarewski" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '13px 28px', background: 'rgba(var(--fg-rgb),0.06)', color: 'var(--text-sub)', borderRadius: 'var(--r-12)', fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>
            Написать
          </a>
        </div>
      </div>
    </div>
  );
}
