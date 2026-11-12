// .ics для клиента (PR B) — отдельная сборка от владельческого CalDAV-события
// (правило «PII только владельцу»): проверяем, что SUMMARY/DESCRIPTION не
// содержат имени/контакта клиента и ссылки на встречу, что время в UTC (суффикс Z) и что
// неизвестный/отменённый токен отвечают контролируемо (404/410), а не
// молчаливым мусором.
import { GoneException, NotFoundException } from '@nestjs/common';
import { buildBookingIcsText } from './booking-ics';

function makePrisma(booking: unknown) {
  return {
    booking: { findUnique: jest.fn().mockResolvedValue(booking) },
  } as any;
}

const CONFIRMED = {
  id: 42,
  status: 'CONFIRMED',
  type: 'SESSION_50',
  startsAt: new Date('2026-08-10T10:00:00.000Z'),
  durationMin: 50,
  meetingUrl: 'https://meet.example/xyz',
};

describe('buildBookingIcsText — контент без PII', () => {
  it('SUMMARY — общая фраза, не содержит имя/контакт клиента', async () => {
    const ics = await buildBookingIcsText(
      makePrisma(CONFIRMED),
      'tok',
      'https://kotlarewski.gr',
    );
    expect(ics).toContain('SUMMARY:Встреча с Григорием Котляревским\r\n');
  });

  it('INTRO_15 — «Знакомство», не «Встреча»', async () => {
    const ics = await buildBookingIcsText(
      makePrisma({ ...CONFIRMED, type: 'INTRO_15' }),
      'tok',
      'https://kotlarewski.gr',
    );
    expect(ics).toContain('SUMMARY:Знакомство с Григорием Котляревским\r\n');
  });

  // Аудит 2026-10: cancel-токен получает любой, кто вызвал анонимную запись с
  // чужим контактом, а комната клиента ищется по контакту — ссылки в .ics нет.
  it('ссылки на встречу нет ни в DESCRIPTION, ни в LOCATION; ссылка управления есть', async () => {
    const ics = await buildBookingIcsText(
      makePrisma(CONFIRMED),
      'tok-abc',
      'https://kotlarewski.gr',
    );
    expect(ics).not.toContain('meet.example');
    expect(ics).not.toMatch(/^LOCATION/m);
    const unfolded = ics.replace(/\r\n /g, ''); // RFC 5545: перенос длинных строк
    expect(unfolded).toContain(
      'DESCRIPTION:Посмотреть или отменить запись: https://kotlarewski.gr/booking/manage?token=tok-abc\r\n',
    );
  });

  it('URL-свойство события — та же ссылка управления', async () => {
    const ics = await buildBookingIcsText(
      makePrisma(CONFIRMED),
      'tok-xyz',
      'https://kotlarewski.gr',
    );
    expect(ics).toContain(
      'URL:https://kotlarewski.gr/booking/manage?token=tok-xyz\r\n',
    );
  });

  it('VALARM за 60 минут до начала', async () => {
    const ics = await buildBookingIcsText(
      makePrisma(CONFIRMED),
      'tok',
      'https://kotlarewski.gr',
    );
    expect(ics).toContain('TRIGGER:-PT60M\r\n');
  });

  // Пин целиком: обезличивание события ВЛАДЕЛЬЦА в iCloud (caldav-owner-event.ts)
  // клиентский файл не обедняет — ссылка управления и напоминание на месте.
  it('файл клиента целиком — тот же, что до обезличивания события владельца', async () => {
    const ics = await buildBookingIcsText(
      makePrisma(CONFIRMED),
      'tok-abc',
      'https://kotlarewski.gr',
    );
    const lines = ics
      .replace(/\r\n /g, '')
      .split('\r\n')
      .filter((l) => l && !l.startsWith('DTSTAMP:'));
    expect(lines).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//schemehappens//booking//RU',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Запись на сессии',
      'BEGIN:VEVENT',
      'UID:booking-42-client@schemehappens.ru',
      'DTSTART:20260810T100000Z',
      'DTEND:20260810T105000Z',
      'SUMMARY:Встреча с Григорием Котляревским',
      'DESCRIPTION:Посмотреть или отменить запись: https://kotlarewski.gr/booking/manage?token=tok-abc',
      'URL:https://kotlarewski.gr/booking/manage?token=tok-abc',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Напоминание о встрече',
      'TRIGGER:-PT60M',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ]);
  });
});

describe('buildBookingIcsText — время в UTC', () => {
  it('DTSTART/DTEND в UTC (суффикс Z), DTEND = DTSTART + durationMin', async () => {
    const ics = await buildBookingIcsText(
      makePrisma(CONFIRMED),
      'tok',
      'https://kotlarewski.gr',
    );
    expect(ics).toContain('DTSTART:20260810T100000Z\r\n');
    expect(ics).toContain('DTEND:20260810T105000Z\r\n');
  });
});

describe('buildBookingIcsText — токен', () => {
  it('неизвестный токен → NotFoundException (404)', async () => {
    await expect(
      buildBookingIcsText(
        makePrisma(null),
        'unknown',
        'https://kotlarewski.gr',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('отменённая бронь → GoneException (410), не 200 с мусорным событием', async () => {
    await expect(
      buildBookingIcsText(
        makePrisma({ ...CONFIRMED, status: 'CANCELLED' }),
        'tok',
        'https://kotlarewski.gr',
      ),
    ).rejects.toBeInstanceOf(GoneException);
  });
});
