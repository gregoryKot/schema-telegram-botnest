import { Link } from 'react-router-dom';
import { PaperOutcome } from '../../components/paper/PaperOutcome';

// Исход «код не найден» экрана сверки входа (AuthConfirmPage): билет истёк,
// уже использован или сессии этого браузера нет — «подожди или устарело»
// (PaperOutcome `wait`, Cup на соломе). Не тупик — ведём в приложение.
// Текст безличный: экран вне AddressFormProvider.
export function TicketNotFound() {
  return (
    <PaperOutcome outcome="wait" title="Код не найден"
                  lead="Возможно, времени прошло слишком много или код уже использован. Вход в приложении можно начать заново.">
      <ToAppLink />
    </PaperOutcome>
  );
}

/** «В приложение» — общий выход с экранов-исходов сверки билета (залитая кнопка листа исхода). */
export function ToAppLink() {
  return <Link className="ds-btn ds-btn--lg pa-outcome-action" to="/today" replace>В приложение</Link>;
}
