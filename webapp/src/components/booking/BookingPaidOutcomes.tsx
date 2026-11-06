import { useEffect } from 'react';
import { reportClientError } from '../../api';
import { CANCEL_SUPPORT_LINK, CANCEL_SUPPORT_HANDLE } from './cancelPolicy';
import { h1, sub } from './bookingPageStyles';
import { icon, ghostBtn } from './bookingPaidStyles';
import { Btn } from '../landing-kit';
import type { BookingLoadError } from './bookingLoadError';
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
      <Btn href="/" full radius="btn" size="lg">На главную</Btn>
    </>
  );
}

/** Ссылка управления записью (календарь, .ics, «Отправить себе»), а не возврат с оплаты. */
export const isManageLink = () => window.location.pathname.startsWith('/booking/manage');

/**
 * /booking/manage без ?token=: ссылку обрезал мессенджер или страницу
 * перезагрузили (BookingPaidPage убирает токен из адреса после открытия).
 * «Оплата принята» тут — неправда: человек пришёл не с оплаты (аудит 2026-10).
 * Отчёт наверх (правило №14): если битые ссылки раздаём мы сами (.ics,
 * Google Календарь), об этом скажет /stats, а не клиент.
 */
export function BookingManageLinkIncomplete() {
  useEffect(() => {
    reportClientError({ message: 'booking manage page: ссылка управления открыта без токена', section: 'booking' });
  }, []);
  return (
    <>
      <div style={icon}>?</div>
      <h1 style={h1}>Ссылка неполная</h1>
      <p style={sub}>
        В адресе не хватает кода записи — так бывает, если мессенджер обрезал ссылку или страницу перезагрузили.
        Откройте ссылку ещё раз оттуда, куда сохраняли запись: из события в календаре или из сообщения в Telegram.
      </p>
      <p style={sub}>Найти не получается — напишите мне, подскажу время встречи и помогу с отменой.</p>
      <Btn href={CANCEL_SUPPORT_LINK} full radius="btn" size="lg">Написать в Telegram</Btn>
    </>
  );
}

/**
 * Бронь по токену не загрузилась. «Оплата принята» тут нельзя: страница не
 * знает, ни была ли оплата, ни есть ли запись. Повтор предлагаем только там,
 * где он может помочь: 404 от повтора не изменится. Ссылка управления
 * (/booking/manage) про оплату не спрашивает, поэтому говорит о записи.
 */
export function BookingPaidLoadFailed({ kind, onRetry }: { kind: BookingLoadError; onRetry: () => void }) {
  const notFound = kind === 'notFound';
  const manage = isManageLink();
  const head = notFound ? 'Запись по этой ссылке не найдена' : manage ? 'Не удалось загрузить запись' : 'Не удалось проверить оплату';
  const lead = notFound
    ? 'Возможно, ссылка неполная или запись уже удалена. Напишите'
    : manage ? 'Нажмите «Обновить» или напишите' : 'Если деньги списаны, запись не потерялась. Нажмите «Обновить» или напишите';
  return (
    <>
      <div style={icon}>?</div>
      <h1 style={h1}>{head}</h1>
      <p style={sub}>
        {lead} мне в Telegram, разберёмся:{' '}
        <a href={CANCEL_SUPPORT_LINK} style={{ color: 'inherit', textDecoration: 'underline' }}>{CANCEL_SUPPORT_HANDLE}</a>.
      </p>
      {!notFound && <button onClick={onRetry} style={ghostBtn}>Обновить</button>}
    </>
  );
}
