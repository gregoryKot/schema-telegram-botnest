// Экран `/auth/error` — вынесен из App.tsx (правило №10, файл заморожен).
// Причина и отчёт наверх — service/useAuthErrorReason (К2 аудита 2026-08,
// S20 аудита 2026-11: текст только по словарю кодов, чужое из адреса — нет).
// Вид — лист исхода PaperOutcome (b26): исход по коду (authErrorOutcome), одна залитая
// кнопка, остальное — тихими ссылками, код причины — в слоте `code`.
// Тексты безличные: экран вне AddressFormProvider, форма обращения неизвестна.
import { PaperOutcome } from '../components/paper/PaperOutcome';
import { authErrorText } from './service/authErrorReasons';
import { authErrorOutcome, authErrorScreen } from './service/authErrorScreens';
import { useAuthErrorReason } from './service/useAuthErrorReason';
import '../styles/auth-service.css';

export function AuthErrorPage() {
  return <AuthErrorView reason={new URLSearchParams(window.location.search).get('reason')} />;
}

const MAIN = 'ds-btn ds-btn--lg pa-outcome-action';
const QUIET = 'ds-link pa-quiet';

/** `onRetry` — повтор на месте: ссылка из письма цела, а сети не было (EmailTokenConsume). */
export function AuthErrorView({ reason, onRetry }: { reason: string | null; onRetry?: () => void }) {
  const code = useAuthErrorReason(reason);
  const screen = authErrorScreen(code); // свой заголовок и кнопка (U6), без кода
  const explained = (onRetry ? screen?.retryLead : undefined) ?? authErrorText(code);
  const other = screen?.action ?? { label: onRetry ? 'Ко входу' : 'Попробовать снова', href: '/login' };
  return (
    <PaperOutcome
      outcome={authErrorOutcome(code)}
      eyebrow="Ошибка входа"
      title={screen?.title ?? 'Вход не удался'}
      lead={explained ?? 'Можно попробовать ещё раз, а если снова не выйдет — написать нам в Telegram.'}
      code={code && !screen ? code : undefined}
    >
      {onRetry
        ? <button type="button" className={MAIN} onClick={onRetry}>Повторить</button>
        : <a href={other.href} className={MAIN}>{other.label}</a>}
      <div className="as-quiet-links">
        {onRetry && <a href={other.href} className={QUIET}>{other.label}</a>}
        <a href="https://t.me/kotlarewski" target="_blank" rel="noopener noreferrer" className={QUIET}>
          Написать
        </a>
      </div>
    </PaperOutcome>
  );
}
