// Перечень получателей данных: у каждого есть имя, назначение и состав
// данных (политика не должна называть сервис «в никуда»).
import { describe, it, expect } from 'vitest';
import { FOREIGN_PROCESSORS, MEETING_NOTE, METRIKA_PROCESSOR, processorLine } from './processors';

describe('processors', () => {
  it('у каждого получателя заполнены имя, назначение и данные', () => {
    for (const p of [...FOREIGN_PROCESSORS, METRIKA_PROCESSOR]) {
      expect(p.name.length).toBeGreaterThan(3);
      expect(p.purpose.length).toBeGreaterThan(10);
      expect(p.data.length).toBeGreaterThan(5);
    }
  });

  it('иностранные получатели — ровно Telegram, Resend, Cloudflare R2', () => {
    expect(FOREIGN_PROCESSORS.map((p) => p.name.split(' (')[0])).toEqual(['Telegram', 'Resend', 'Cloudflare R2']);
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

  it('Метрика не в иностранных — российский сервис', () => {
    expect(FOREIGN_PROCESSORS.some((p) => /Яндекс/.test(p.name))).toBe(false);
  });

  it('processorLine склеивает имя, назначение и данные', () => {
    expect(processorLine({ name: 'A', purpose: 'зачем', data: 'что' })).toBe('A – зачем (что)');
  });
});
