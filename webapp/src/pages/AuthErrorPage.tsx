// Экран `/auth/error` — вынесен из App.tsx (правило №10, файл заморожен).
// Причина и отчёт наверх — service/useAuthErrorReason (К2 аудита 2026-08,
// S20 аудита 2026-11: текст только по словарю кодов, чужое из адреса — нет).
import { useTr } from '../utils/addressForm';
import { ServicePage } from './service/ServicePage';
import { authErrorText } from './service/authErrorReasons';
import { useAuthErrorReason } from './service/useAuthErrorReason';

export function AuthErrorPage() {
  const tr = useTr();
  const code = useAuthErrorReason(window.location.search);
  const explained = authErrorText(code, tr);
  return (
    <ServicePage>
      <div className="as-body">
        <div className="ds-eyebrow">Ошибка входа</div>
        <h1 className="ds-h2">Вход не удался</h1>
        <p className="as-lead">
          {explained ?? tr('Попробуй ещё раз или напиши нам в Telegram.', 'Попробуйте ещё раз или напишите нам в Telegram.')}
        </p>
        {code && <p className="as-reason">{code}</p>}
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
