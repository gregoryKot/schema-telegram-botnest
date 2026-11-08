import { Link } from 'react-router-dom';
import { useTr } from '../../utils/addressForm';
import { ServicePage } from './ServicePage';

// Исход «код не найден» экрана сверки входа (AuthConfirmPage): билет истёк,
// уже использован или сессии этого браузера нет. Не тупик — ведём в приложение.
export function TicketNotFound() {
  const tr = useTr();
  return (
    <ServicePage>
      <div className="as-body">
        <h1 className="ds-h2">Код не найден</h1>
        <p className="as-lead">
          {tr(
            'Возможно, времени прошло слишком много или код уже использован. Открой вход в приложении заново.',
            'Возможно, времени прошло слишком много или код уже использован. Откройте вход в приложении заново.',
          )}
        </p>
        <ToAppLink />
      </div>
    </ServicePage>
  );
}

/** «В приложение» — общий выход с экранов-исходов сверки билета. */
export function ToAppLink() {
  return <Link className="ds-btn as-cta" to="/today" replace>В приложение</Link>;
}
