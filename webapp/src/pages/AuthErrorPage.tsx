// Экран `/auth/error` — вынесен из App.tsx (правило №10, файл заморожен).
// Причина и отчёт наверх — service/useAuthErrorReason (К2 аудита 2026-08,
// S20 аудита 2026-11: текст только по словарю кодов, чужое из адреса — нет).
import { useTr } from '../utils/addressForm';
import { ServicePage } from './service/ServicePage';
import { authErrorText } from './service/authErrorReasons';
import { authErrorScreen } from './service/authErrorScreens';
import { useAuthErrorReason } from './service/useAuthErrorReason';

export function AuthErrorPage() {
  return <AuthErrorView reason={new URLSearchParams(window.location.search).get('reason')} />;
}

/** `onRetry` — повтор на месте: ссылка из письма цела, а сети не было (EmailTokenConsume). */
export function AuthErrorView({ reason, onRetry }: { reason: string | null; onRetry?: () => void }) {
  const tr = useTr();
  const code = useAuthErrorReason(reason);
  const screen = authErrorScreen(code); // свой заголовок и кнопка (U6), без кода
  const explained = (onRetry ? screen?.retryLead?.(tr) : undefined) ?? authErrorText(code, tr);
  const other = screen?.action ?? { label: onRetry ? 'Ко входу' : 'Попробовать снова', href: '/login' };
  return (
    <ServicePage>
      <div className="as-body">
        <div className="ds-eyebrow">Ошибка входа</div>
        <h1 className="ds-h2">{screen?.title ?? 'Вход не удался'}</h1>
        <p className="as-lead">
          {explained ?? tr('Попробуй ещё раз или напиши нам в Telegram.', 'Попробуйте ещё раз или напишите нам в Telegram.')}
        </p>
        {code && !screen && <p className="as-reason">{code}</p>}
        <div className="as-actions-row">
          {onRetry && <button type="button" className="ds-btn" onClick={onRetry}>Повторить</button>}
          <a href={other.href} className={onRetry ? 'ds-btn ds-btn--secondary' : 'ds-btn'}>{other.label}</a>
          <a href="https://t.me/kotlarewski" target="_blank" rel="noopener noreferrer" className="ds-btn ds-btn--secondary">
            Написать
          </a>
        </div>
      </div>
    </ServicePage>
  );
}
