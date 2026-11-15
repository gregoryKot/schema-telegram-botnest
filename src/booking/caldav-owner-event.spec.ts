// UID события владельца в iCloud (запрос РКН №08-1063539): номер брони в Apple
// не уходит. crypto-keys.ts читает ENCRYPTION_KEY при загрузке, поэтому модуль
// грузится под заданным ключом (loadWithKeys) — иначе проверялась бы только
// запасная ветка без ключа.
import { loadWithKeys } from '../test-support/load-with-keys';

type Mod = typeof import('./caldav-owner-event');
const KEY = 'ab'.repeat(32);
const OTHER = 'cd'.repeat(32);
const load = (key: string): Mod =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  loadWithKeys({ key }, () => require('./caldav-owner-event') as Mod);
const UID_FORMAT = /^[0-9a-f]{32}@schemehappens\.ru$/;

const saved = { ...process.env };
afterAll(() => {
  for (const k of ['ENCRYPTION_KEY', 'ENCRYPTION_KEY_OLD'] as const)
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
});

describe('bookingEventUid — HMAC номера брони', () => {
  it('без номера брони, детерминирован, у разных броней разный', () => {
    const { bookingEventUid } = load(KEY);
    const uid = bookingEventUid(42);
    expect(uid).toMatch(UID_FORMAT);
    expect(uid).not.toBe('booking-42@schemehappens.ru');
    expect(bookingEventUid(42)).toBe(uid);
    expect(bookingEventUid(43)).not.toBe(uid);
  });

  it('зависит от ключа сервера: по номеру без ключа UID не подобрать', () => {
    expect(load(KEY).bookingEventUid(42)).not.toBe(
      load(OTHER).bookingEventUid(42),
    );
  });

  it('без ключа (dev) — тоже без номера и отличается от ключевого', () => {
    const uid = load('').bookingEventUid(42);
    expect(uid).toMatch(UID_FORMAT);
    expect(uid).not.toBe(load(KEY).bookingEventUid(42));
  });

  it('событие владельца несёт этот UID, а тело PUT — ни номера, ни лишних полей', () => {
    const m = load(KEY);
    const ev = m.ownerEventFor({
      id: 42,
      startsAt: new Date('2026-12-01T17:00:00Z'),
      durationMin: 50,
      type: 'SESSION_50',
    });
    expect(ev.uid).toBe(m.bookingEventUid(42));
    const body = m.buildOwnerVcalendar(ev);
    expect(body).toContain(`UID:${ev.uid}\r\n`);
    expect(body).not.toContain('booking-42');
  });
});
