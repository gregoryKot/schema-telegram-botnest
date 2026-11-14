import { formatUserCode } from '../../../../shared/src/auth/loginTicketCode';

// Вход через MAX. OAuth для сайтов у MAX нет: вход подтверждают в
// мини-приложении (/auth/confirm сессией MAX), а эта вкладка забирает сессию
// опросом билета. Код виден ДО перехода — в MAX его набирают руками (S9):
// код, подставленный ссылкой, не одобряется.
export function MaxLoginStep({ code, url }: { code: string; url: string }) {
  return (
    <div className="al-ticket al-max-step">
      <p className="al-note">В MAX откроется наше приложение — там нужно набрать код:</p>
      <div className="al-code">{formatUserCode(code)}</div>
      <a className="al-btn-main al-btn-max" href={url} target="_blank" rel="noopener noreferrer">
        Открыть MAX
      </a>
      <p className="al-note">Эта страница впустит сама, как только вход подтвердят.</p>
    </div>
  );
}
