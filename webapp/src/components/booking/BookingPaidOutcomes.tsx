import { CANCEL_SUPPORT_LINK, CANCEL_SUPPORT_HANDLE } from './cancelPolicy';
import { h1, sub } from './bookingPageStyles';
import { icon, ghostBtn, primaryBtn } from './bookingPaidStyles';
import type { BookingLoadError } from './useBookingByToken';

/**
 * Оплата принята, но данных о встрече нет: человек пришёл с подписанного
 * редиректа без токена, либо статус брони не знаком странице. Сюда НЕ попадает
 * отказ загрузки брони по токену: его разбирает BookingPaidLoadFailed.
 */
export function BookingPaidAccepted() {
  return (
    <>
      <div style={icon}>✓</div>
      <h1 style={h1}>Оплата принята</h1>
      <p style={sub}>Спасибо! Я свяжусь с вами и пришлю ссылку на встречу.</p>
      <a href="/" style={primaryBtn}>На главную</a>
    </>
  );
}

/**
 * Бронь по токену не загрузилась. «Оплата принята» тут нельзя: страница не
 * знает, ни была ли оплата, ни есть ли запись. Ссылка управления из письма
 * (/booking/manage) попадает сюда же. Повтор предлагаем только там, где он
 * может помочь: 404 от повтора не изменится.
 */
export function BookingPaidLoadFailed({ kind, onRetry }: { kind: BookingLoadError; onRetry: () => void }) {
  const notFound = kind === 'notFound';
  return (
    <>
      <div style={icon}>?</div>
      <h1 style={h1}>{notFound ? 'Запись по этой ссылке не найдена' : 'Не удалось проверить оплату'}</h1>
      <p style={sub}>
        {notFound
          ? 'Возможно, ссылка неполная или запись уже удалена. '
          : 'Если деньги списаны, запись не потерялась. Нажмите «Обновить» или '}
        {notFound ? 'Напишите' : 'напишите'} мне в Telegram, разберёмся:{' '}
        <a href={CANCEL_SUPPORT_LINK} style={{ color: 'inherit', textDecoration: 'underline' }}>{CANCEL_SUPPORT_HANDLE}</a>.
      </p>
      {!notFound && <button onClick={onRetry} style={ghostBtn}>Обновить</button>}
    </>
  );
}
