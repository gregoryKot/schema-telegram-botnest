// Алерт о календаре — по смене состояния, не на каждый запрос (найдено
// 2026-09-13 по логам: 403 от iCloud жил в warn и был невидим).
import {
  CalDavHealthTracker,
  calDavHealth,
  formatCalendarHealth,
  renderCalendarHealthBlock,
} from './caldav-health';

const T0 = 1_700_000_000_000;
const H = 3_600_000;

describe('CalDavHealthTracker', () => {
  it('401/403 открывает аварию сразу: один алерт с советом про пароль, повтор тут же молчит', () => {
    const t = new CalDavHealthTracker();
    const first = t.noteFailure('auth', 'REPORT 403', T0);
    expect(first).toContain('не читается');
    expect(first).toContain('APPLE_APP_PASSWORD');
    expect(first).toContain('поверх встречи из календаря');
    expect(t.noteFailure('auth', 'REPORT 403', T0 + 60_000)).toBeNull();
    expect(t.snapshot()).toMatchObject({ open: true, failCount: 2 });
  });

  it('разовый таймаут не будит; два подряд — открывает', () => {
    const t = new CalDavHealthTracker();
    expect(t.noteFailure('timeout', 'aborted', T0)).toBeNull();
    expect(t.noteFailure('timeout', 'aborted', T0 + 1000)).toContain(
      'не отвечает вовремя',
    );
  });

  it('успех между таймаутами сбрасывает счётчик подряд — авария не открывается', () => {
    const t = new CalDavHealthTracker();
    t.noteFailure('timeout', 'aborted', T0);
    expect(t.noteSuccess(T0 + 1000)).toBeNull(); // не было открыто — тишина
    expect(t.noteFailure('network', 'ECONNRESET', T0 + 2000)).toBeNull();
    expect(t.snapshot().open).toBe(false);
  });

  it('открытая авария напоминает раз в 6 часов, восстановление — один алерт', () => {
    const t = new CalDavHealthTracker();
    t.noteFailure('auth', 'REPORT 403', T0);
    expect(t.noteFailure('auth', 'REPORT 403', T0 + 5 * H)).toBeNull();
    expect(t.noteFailure('auth', 'REPORT 403', T0 + 6 * H)).not.toBeNull();
    expect(t.noteSuccess(T0 + 7 * H)).toContain('снова читается');
    expect(t.noteSuccess(T0 + 8 * H)).toBeNull();
    expect(t.snapshot()).toMatchObject({ open: false, consecutiveFails: 0 });
  });

  it('подробность обрезается до 200 символов', () => {
    const t = new CalDavHealthTracker();
    t.noteFailure('http', 'x'.repeat(500), T0);
    expect(t.snapshot().lastFailDetail).toHaveLength(200);
  });
});

describe('formatCalendarHealth', () => {
  const tr = () => new CalDavHealthTracker();

  it('не настроен — одна честная строка, без NaN', () => {
    const text = formatCalendarHealth(tr().snapshot(), false, false, T0);
    expect(text).toContain('не подключён');
    expect(text).not.toMatch(/NaN|undefined|null/);
  });

  it('пустое состояние после запуска — «ещё не читали», без сбоев', () => {
    const text = formatCalendarHealth(tr().snapshot(), true, true, T0);
    expect(text).toContain('ещё ни разу не читали');
    expect(text).toContain('скрываются из слотов');
    expect(text).not.toMatch(/NaN|undefined|null/);
  });

  it('открытая авария по паролю видна словами и с давностью', () => {
    const t = tr();
    t.noteFailure('auth', 'REPORT 403', T0);
    const text = formatCalendarHealth(
      t.snapshot(),
      true,
      false,
      T0 + 90 * 60_000,
    );
    expect(text).toContain('НЕ читается (2 ч назад)');
    // 403 честно объясняется двумя причинами (инцидент 2026-09-13: 403
    // бывает и от запроса в корень календарей, не только от пароля).
    expect(text).toContain('не подходит пароль приложения');
    expect(text).toContain('запрос ушёл не в календарь');
    expect(text).toContain('НЕ скрываются');
    expect(text).toContain('Сбоев чтения с запуска: 1');
  });

  it('после восстановления — последнее успешное чтение и счётчик сбоев', () => {
    const t = tr();
    t.noteFailure('auth', 'REPORT 403', T0);
    t.noteSuccess(T0 + 10 * 60_000);
    const text = formatCalendarHealth(
      t.snapshot(),
      true,
      true,
      T0 + 15 * 60_000,
    );
    expect(text).toContain('Последнее успешное чтение: 5 мин назад');
    expect(text).toContain('Сбоев чтения с запуска: 1');
    expect(text).not.toContain('НЕ читается');
  });
});

describe('renderCalendarHealthBlock', () => {
  afterEach(() => calDavHealth.reset());
  it('собирает блок из живого трекера и env: не настроен / настроен и не читали', () => {
    expect(renderCalendarHealthBlock({}, T0)).toContain('не подключён');
    const env = {
      APPLE_ID: 'a',
      APPLE_APP_PASSWORD: 'b',
      CALENDAR_BLOCK_SLOTS: 'true',
    };
    expect(renderCalendarHealthBlock(env, T0)).toContain(
      'ещё ни разу не читали',
    );
    calDavHealth.noteFailure('auth', 'REPORT 403', T0);
    expect(renderCalendarHealthBlock(env, T0 + 60_000)).toContain(
      'НЕ читается',
    );
  });
});
