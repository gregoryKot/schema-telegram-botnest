import { describe, it, expect } from 'vitest';
import type { SessionOption } from '../../api.types';
import {
  bookingPriceView, doneCostNote, formatPriceSuffix, needsOnlinePayment, submitLabel, submitNote,
} from './bookingPriceLabels';

const INTRO: SessionOption = { type: 'INTRO_15', label: 'Знакомство', durationMin: 15, price: 0, prices: { RUB: 0, ILS: 0, EUR: 0, USD: 0 }, note: '' };
const SESSION: SessionOption = { type: 'SESSION_50', label: 'Сессия', durationMin: 50, price: 4000, prices: { RUB: 4000, ILS: 200, EUR: 65, USD: 70 }, note: '' };
const BOOK = 'Записаться на завтра, 19:00 по вашему времени →';
const rub4000 = (4000).toLocaleString('ru-RU') + ' ₽';

describe('bookingPriceView и подпись формата', () => {
  it('платный формат: paid, цена в валюте посетителя', () => {
    expect(bookingPriceView(SESSION, 'USD')).toMatchObject({ paid: true, online: false, text: '70 $' });
    expect(bookingPriceView(SESSION, 'RUB')).toMatchObject({ paid: true, online: true, text: rub4000 });
  });

  it('знакомство и ещё не загруженная опция — не платные', () => {
    expect(bookingPriceView(INTRO, 'RUB').paid).toBe(false);
    expect(bookingPriceView(undefined, 'USD').paid).toBe(false);
  });

  it('кнопка формата: «· 70 $» или «· бесплатно»', () => {
    expect(formatPriceSuffix(SESSION, 'USD')).toBe('· 70 $');
    expect(formatPriceSuffix(SESSION, 'ILS')).toBe('· 200 ₪');
    expect(formatPriceSuffix(SESSION, 'RUB')).toBe('· ' + rub4000);
    expect(formatPriceSuffix(INTRO, 'USD')).toBe('· бесплатно');
  });
});

describe('submitLabel и submitNote', () => {
  it('рубли: оплата и Robokassa', () => {
    const v = bookingPriceView(SESSION, 'RUB');
    expect(needsOnlinePayment(v)).toBe(true);
    expect(submitLabel(v, false, BOOK)).toBe(`Оплатить ${rub4000} и записаться →`);
    expect(submitLabel(v, true, BOOK)).toBe('Перехожу к оплате…');
    expect(submitNote(v)).toBe('Оплата картой или СБП через Robokassa. Чек придёт автоматически.');
  });

  it('не рубли: кнопка как у бесплатной, пояснение про договорённость об оплате', () => {
    const v = bookingPriceView(SESSION, 'USD');
    expect(needsOnlinePayment(v)).toBe(false);
    expect(submitLabel(v, false, BOOK)).toBe(BOOK);
    expect(submitLabel(v, true, BOOK)).toBe('Бронирую…');
    expect(submitNote(v)).toBe('Сессия – 70 $. Об оплате договоримся после записи.');
  });

  it('бесплатная встреча: прежний текст про 15 минут', () => {
    const v = bookingPriceView(INTRO, 'USD');
    expect(submitLabel(v, false, BOOK)).toBe(BOOK);
    expect(submitNote(v)).toBe('Первая встреча 15 минут — бесплатно. Никаких обязательств.');
  });
});

describe('doneCostNote — строка на экране «Время забронировано»', () => {
  it('платная сессия не в рублях — стоимость и «напишу об оплате»', () => {
    expect(doneCostNote(bookingPriceView(SESSION, 'EUR'), 'SESSION_50'))
      .toBe('Стоимость сессии – 65 €. Об оплате напишу вам перед встречей.');
  });

  it('рубли (оплачено онлайн), знакомство и неизвестная цена — без строки', () => {
    expect(doneCostNote(bookingPriceView(SESSION, 'RUB'), 'SESSION_50')).toBeNull();
    expect(doneCostNote(bookingPriceView(INTRO, 'EUR'), 'INTRO_15')).toBeNull();
    expect(doneCostNote(bookingPriceView(undefined, 'EUR'), 'SESSION_50')).toBeNull();
  });
});
