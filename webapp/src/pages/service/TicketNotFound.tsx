import { Link } from 'react-router-dom';
import { ServicePage } from './ServicePage';

// Исход «код не найден» экрана сверки входа (AuthConfirmPage): билет истёк,
// уже использован или сессии этого браузера нет. Не тупик — ведём в приложение.
// Текст безличный: экран вне AddressFormProvider.
export function TicketNotFound() {
  return (
    <ServicePage>
      <div className="as-body">
        <h1 className="ds-h2">Код не найден</h1>
        <p className="as-lead">
          Возможно, времени прошло слишком много или код уже использован. Вход в приложении можно начать заново.
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
