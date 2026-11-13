// Перечень получателей данных: у каждого есть имя, назначение и состав
// данных (политика не должна называть сервис «в никуда»).
import { describe, it, expect } from 'vitest';
import {
  DOMESTIC_PROCESSORS, FOREIGN_PROCESSORS, MEETING_NOTE, METRIKA_PROCESSOR,
  POSTBOX_PROCESSOR, YANDEX_ID_PROCESSOR, processorLine,
} from './processors';

describe('processors', () => {
  it('у каждого получателя заполнены имя, назначение и данные', () => {
    for (const p of [...FOREIGN_PROCESSORS, ...DOMESTIC_PROCESSORS, METRIKA_PROCESSOR]) {
      expect(p.name.length).toBeGreaterThan(3);
      expect(p.purpose.length).toBeGreaterThan(10);
      expect(p.data.length).toBeGreaterThan(5);
    }
  });

  it('иностранные получатели — ровно Telegram и Cloudflare R2', () => {
    expect(FOREIGN_PROCESSORS.map((p) => p.name.split(' (')[0])).toEqual(['Telegram', 'Cloudflare R2']);
  });

  // Запрос РКН №08-1063539 (2026-11): письма шлёт российский Yandex Cloud
  // Postbox (src/infra/postbox-mail.ts), за рубеж они больше не уходят —
  // Resend нет ни среди иностранных, ни среди российских, ни в оговорках.
  it('Resend нет нигде', () => {
    const all = JSON.stringify([FOREIGN_PROCESSORS, DOMESTIC_PROCESSORS, METRIKA_PROCESSOR, MEETING_NOTE]);
    expect(all).not.toMatch(/resend|plus five five/i);
  });

  it('российские получатели — ровно Yandex Cloud Postbox и Яндекс ID, у каждого своё юрлицо', () => {
    expect(DOMESTIC_PROCESSORS).toEqual([POSTBOX_PROCESSOR, YANDEX_ID_PROCESSOR]);
    expect(DOMESTIC_PROCESSORS.map((p) => p.name)).toEqual([
      'Yandex Cloud Postbox (ООО «Яндекс.Облако»)',
      'Яндекс ID (ООО «Яндекс»)',
    ]);
  });

  it('Postbox: письма для входа и уведомления о записи; уходит почта, для записи — имя, контакт и время', () => {
    expect(POSTBOX_PROCESSOR.purpose).toContain('ссылки для входа и восстановления доступа');
    expect(POSTBOX_PROCESSOR.purpose).toContain('уведомления Оператору о новых записях на консультацию');
    expect(POSTBOX_PROCESSOR.data).toBe('адрес электронной почты пользователя; для записи – имя, контакт и время встречи');
  });

  it('Яндекс ID: только у выбравших этот вход; названо, что узнаёт сервис и что получает Оператор', () => {
    expect(YANDEX_ID_PROCESSOR.purpose).toContain('только у тех, кто сам выбирает этот способ входа');
    expect(YANDEX_ID_PROCESSOR.data).toContain('сервис узнаёт о входе на сайт Оператора');
    expect(YANDEX_ID_PROCESSOR.data).toContain('идентификатор аккаунта, адрес электронной почты и имя');
  });

  // Запрос РКН №08-1063539 (2026-11). Событие календаря и комната Zoom
  // обезличены (src/booking/caldav-owner-event.ts, ZOOM_TOPIC): персональные
  // данные туда не передаются — получателями они не числятся, но политика
  // честно говорит, что встреча идёт в Zoom и клиент подключается сам.
  it('iCloud и Zoom — не получатели данных; о них сказано отдельной фразой', () => {
    expect(JSON.stringify(FOREIGN_PROCESSORS)).not.toMatch(/icloud|apple|zoom/i);
    expect(MEETING_NOTE).toContain('Zoom');
    expect(MEETING_NOTE).toContain('общим названием «Сессия»');
    expect(MEETING_NOTE).toContain('клиент подключается по ссылке сам');
    expect(MEETING_NOTE).toContain('только время и вид записи');
  });

  // Тот же запрос: вход через Telegram на сайте убран — Telegram остаётся
  // получателем как бот, приложение внутри Telegram и уведомления.
  it('Telegram: бот, приложение внутри Telegram и уведомления; не вход на сайт', () => {
    const tg = FOREIGN_PROCESSORS.find((p) => p.name.startsWith('Telegram'))!;
    expect(tg.purpose).toContain('внутри Telegram');
    expect(tg.purpose).toContain('для входа на сайт не используется');
  });

  // Вход через Google убран (2026-11, запрос РКН №08-1063539): получателя нет.
  it('Google среди получателей нет', () => {
    expect(JSON.stringify(FOREIGN_PROCESSORS)).not.toMatch(/google/i);
  });

  it('Яндекс не в иностранных — Метрика, Postbox и Яндекс ID российские', () => {
    expect(FOREIGN_PROCESSORS.some((p) => /Яндекс|Yandex/i.test(p.name))).toBe(false);
  });

  it('processorLine склеивает имя, назначение и данные', () => {
    expect(processorLine({ name: 'A', purpose: 'зачем', data: 'что' })).toBe('A – зачем (что)');
  });
});
