// Строка записи в админке: разделитель только между существующими частями.
// Регрессия на обезличенную бронь (ретенция 12 месяцев, решение владельца
// 2026-10-08): контакт и текст запроса стёрты, и прежняя разметка печатала
// «обезличено · » с висящей точкой.
import { describe, it, expect } from 'vitest';
import { bookingContactLine } from './bookingContactLine';

describe('bookingContactLine', () => {
  it('полная запись: имя, канал с контактом, запрос', () => {
    expect(
      bookingContactLine({
        clientName: 'Аня',
        clientChannel: 'telegram',
        clientContact: '@anya',
        message: 'хочу разобраться с тревогой',
      }),
    ).toBe('Аня · Telegram @anya · «хочу разобраться с тревогой»');
  });

  it('обезличенная запись: только имя-заглушка, без висящего разделителя', () => {
    expect(
      bookingContactLine({
        clientName: 'обезличено',
        clientChannel: 'telegram',
        clientContact: '',
        message: null,
      }),
    ).toBe('обезличено');
  });

  it('канал остался, а контакта нет — канал без контакта не печатается', () => {
    // clientChannel ретенция НЕ затирает (это не PII), поэтому случай реальный:
    // «обезличено · Telegram» без самого адреса сообщало бы о человеке ровно
    // ничего и выглядело бы как обрезанная строка.
    expect(
      bookingContactLine({
        clientName: 'обезличено',
        clientChannel: 'whatsapp',
        clientContact: '   ',
      }),
    ).toBe('обезличено');
  });

  it('неизвестный канал: контакт печатается без подписи', () => {
    expect(
      bookingContactLine({
        clientName: 'Пётр',
        clientChannel: null,
        clientContact: '+7 900 000-00-00',
      }),
    ).toBe('Пётр · +7 900 000-00-00');
  });

  it('пустой запрос не добавляет кавычек', () => {
    expect(
      bookingContactLine({
        clientName: 'Пётр',
        clientChannel: 'email',
        clientContact: 'p@example.com',
        message: '',
      }),
    ).toBe('Пётр · Почта p@example.com');
  });
});
