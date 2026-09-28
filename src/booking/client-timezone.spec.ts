// Правило №25 CLAUDE.md: зоно-зависимая логика гоняется и под TZ раннера
// (UTC), и под TZ=Australia/Sydney (вторая jest-джоба). Здесь process.env.TZ
// не используется — все функции принимают tz явным аргументом — но
// контрольные значения делают явное «что должно получиться», а не «что
// получилось на моей машине».
import {
  offsetMinutes,
  offsetLabel,
  isMoscowOffset,
  isMoscowTimeZone,
  cityLabel,
  isValidTimeZone,
  clientTimeLine,
} from './client-timezone';

describe('offsetMinutes / offsetLabel', () => {
  it('Бангкок — UTC+7', () => {
    const at = new Date('2026-09-28T00:00:00Z');
    expect(offsetMinutes('Asia/Bangkok', at)).toBe(420);
    expect(offsetLabel('Asia/Bangkok', at)).toBe('UTC+7');
  });

  it('получасовое смещение (Kolkata) форматируется с минутами', () => {
    expect(offsetLabel('Asia/Kolkata', new Date('2026-09-28T00:00:00Z'))).toBe(
      'UTC+5:30',
    );
  });

  it('отрицательное смещение (Нью-Йорк, зима)', () => {
    expect(
      offsetLabel('America/New_York', new Date('2026-01-15T00:00:00Z')),
    ).toBe('UTC-5');
  });
});

describe('isMoscowOffset', () => {
  const at = new Date('2026-09-28T00:00:00Z');
  it('Москва — да', () =>
    expect(isMoscowOffset('Europe/Moscow', at)).toBe(true));
  it('Стамбул (круглый год UTC+3, без летнего времени) — да', () =>
    expect(isMoscowOffset('Europe/Istanbul', at)).toBe(true));
  it('Бангкок — нет', () =>
    expect(isMoscowOffset('Asia/Bangkok', at)).toBe(false));
});

// Инцидент 2026-09 (см. docs/INCIDENTS.md): «по московскому времени» писалось
// посетителю из Израиля летом (UTC+3 совпадает с московским смещением), хотя
// пояс — не Москва. isMoscowOffset проверяет только СМЕЩЕНИЕ; isMoscowTimeZone
// проверяет, что пояс и есть Москва (или её российский синоним).
describe('isMoscowTimeZone', () => {
  it('Москва и российские синонимы — да', () => {
    expect(isMoscowTimeZone('Europe/Moscow')).toBe(true);
    expect(isMoscowTimeZone('Europe/Simferopol')).toBe(true);
    expect(isMoscowTimeZone('Europe/Kirov')).toBe(true);
    expect(isMoscowTimeZone('Europe/Volgograd')).toBe(true);
  });

  it('Стамбул и Израиль летом — офсет совпадает, но это не Москва', () => {
    expect(isMoscowTimeZone('Europe/Istanbul')).toBe(false);
    expect(isMoscowTimeZone('Asia/Jerusalem')).toBe(false);
  });
});

describe('isValidTimeZone', () => {
  it('признаёт реальный пояс, отвергает мусор', () => {
    expect(isValidTimeZone('Asia/Bangkok')).toBe(true);
    expect(isValidTimeZone('not-a-timezone')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});

describe('cityLabel', () => {
  it('известный пояс — русский город', () =>
    expect(cityLabel('Asia/Bangkok')).toBe('Бангкок'));
  it('незнакомый валидный IANA-пояс — хвост идентификатора', () =>
    expect(cityLabel('Pacific/Auckland')).toBe('Auckland'));
});

describe('clientTimeLine', () => {
  const at = new Date('2026-09-30T12:00:00Z'); // 15:00 МСК, 19:00 Бангкок

  it('нет пояса — null (сообщение как раньше, только МСК)', () => {
    expect(clientTimeLine(at, undefined)).toBeNull();
    expect(clientTimeLine(at, null)).toBeNull();
  });

  it('невалидный пояс — null, не бросает', () => {
    expect(clientTimeLine(at, 'not-a-timezone')).toBeNull();
  });

  it('московский пояс — null, дублировать МСК не нужно', () => {
    expect(clientTimeLine(at, 'Europe/Moscow')).toBeNull();
  });

  it('не московский — строка «у клиента HH:MM (Город, UTC+N)»', () => {
    expect(clientTimeLine(at, 'Asia/Bangkok')).toBe(
      'у клиента 19:00 (Бангкок, UTC+7)',
    );
  });

  it('Стамбул — офсет совпадает с московским, но строка всё равно показана (это не Москва)', () => {
    expect(clientTimeLine(at, 'Europe/Istanbul')).toBe(
      'у клиента 15:00 (Стамбул, UTC+3)',
    );
  });

  it('Израиль летом (UTC+3, совпадает с московским) — строка показана', () => {
    // 30 сентября — ещё летнее время в Израиле (DST до конца октября).
    expect(clientTimeLine(at, 'Asia/Jerusalem')).toBe(
      'у клиента 15:00 (Израиль, UTC+3)',
    );
  });

  it('Израиль зимой (UTC+2) — строка показана с другим смещением', () => {
    const winter = new Date('2026-01-15T12:00:00Z'); // 15:00 МСК, 14:00 в Израиле
    expect(clientTimeLine(winter, 'Asia/Jerusalem')).toBe(
      'у клиента 14:00 (Израиль, UTC+2)',
    );
  });
});
