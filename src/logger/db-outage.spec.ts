// Регресс инцидента 2026-08-31 (см. шапку db-outage.ts): недоступность
// Postgres расползлась по AlertLogger как ДЕСЯТКИ разных по тексту сообщений,
// и guard в telegram.schedule.service.ts искал "P1001" в тексте, а не в
// err.code. Здесь — классификатор в обе стороны (не только «должен ловить»,
// но и «не должен путать с чужой аварией») и машина состояний аварии,
// управляемая параметром now (без реальных таймеров).
import {
  isDbUnreachable,
  isConnectionError,
  DbOutageTracker,
} from './db-outage';

describe('isDbUnreachable — классификация', () => {
  it('объект Prisma-ошибки с code: P1001 и meta.modelName — true', () => {
    const err = { code: 'P1001', meta: { modelName: 'Booking' } };
    expect(isDbUnreachable(err)).toBe(true);
  });

  it('текст "Can\'t reach database server at 10.96.245.252:5432" — true', () => {
    expect(
      isDbUnreachable("Can't reach database server at 10.96.245.252:5432"),
    ).toBe(true);
  });

  it('текст с типографским апострофом "Can’t reach database server" — true', () => {
    expect(
      isDbUnreachable('Can’t reach database server at 10.0.0.1:5432'),
    ).toBe(true);
  });

  it('P1017, P2024, DatabaseNotReachable — все true', () => {
    expect(isDbUnreachable('Server has closed the connection (P1017)')).toBe(
      true,
    );
    expect(
      isDbUnreachable('Timed out fetching a new connection from the pool'),
    ).toBe(true);
    expect(isDbUnreachable(new Error('DatabaseNotReachable'))).toBe(true);
  });

  it('ECONNREFUSED к api.telegram.org (без упоминания БД) — false', () => {
    expect(isDbUnreachable('connect ECONNREFUSED 149.154.167.220:443')).toBe(
      false,
    );
  });

  it('ECONNREFUSED рядом с postgres/prisma/database — true', () => {
    expect(
      isDbUnreachable('connect ECONNREFUSED 127.0.0.1:5432 (postgres)'),
    ).toBe(true);
  });

  it('обычная ошибка без признаков БД — false', () => {
    expect(isDbUnreachable('Validation failed for field "email"')).toBe(false);
    expect(isDbUnreachable(new Error('Something broke'))).toBe(false);
  });

  it('не бросает на null/undefined/циклической ссылке', () => {
    expect(() => isDbUnreachable(null)).not.toThrow();
    expect(() => isDbUnreachable(undefined)).not.toThrow();
    const circular: Record<string, unknown> = { code: 'P1001' };
    circular.self = circular;
    expect(isDbUnreachable(circular)).toBe(true);
  });
});

// Две проверки различаются нарочно: строгая решает, ЧЬЯ авария (заголовок DM
// про базу должен быть правдой), мягкая — временная ли ошибка (её единственный
// потребитель, processQueue, гасит любой обрыв соединения до warn, чтобы крон
// не будил админа каждую минуту).
describe('isConnectionError — мягкая проверка рядом со строгой', () => {
  it('обрыв соединения без контекста БД: мягкая — да, строгая — нет', () => {
    const err = new Error('connect ECONNREFUSED');
    expect(isConnectionError(err)).toBe(true);
    expect(isDbUnreachable(err)).toBe(false);
  });

  it('признаки БД засчитывает обе', () => {
    const err = { code: 'P1001', message: "Can't reach database server" };
    expect(isConnectionError(err)).toBe(true);
    expect(isDbUnreachable(err)).toBe(true);
  });

  it('ошибка не про соединение — обе false', () => {
    expect(isConnectionError('Validation failed for field "email"')).toBe(
      false,
    );
    expect(isDbUnreachable('Validation failed for field "email"')).toBe(false);
  });
});

describe('DbOutageTracker — машина состояний одной аварии', () => {
  it('первая ошибка открывает аварию и даёт DM с текстом ошибки', () => {
    const tracker = new DbOutageTracker();
    const { text } = tracker.note("Can't reach database server", 1_000_000);
    expect(text).toContain('База данных не отвечает');
    expect(text).toContain("Can't reach database server");
    expect(tracker.isOpen).toBe(true);
  });

  it('повторы во время открытой аварии молчат (text: null)', () => {
    const tracker = new DbOutageTracker();
    tracker.note('err 1', 1_000_000);
    const second = tracker.note('err 2', 1_000_100);
    const third = tracker.note('err 3', 1_030_000);
    expect(second.text).toBeNull();
    expect(third.text).toBeNull();
  });

  it('напоминание приходит через reminderMs с числом ошибок и длительностью', () => {
    const tracker = new DbOutageTracker(15 * 60_000);
    const start = 1_000_000;
    tracker.note('err 1', start);
    tracker.note('err 2', start + 60_000);
    const { text } = tracker.note('err 3', start + 15 * 60_000 + 1);
    expect(text).toContain('15 мин');
    expect(text).toContain('Ошибок за это время: 3');
    expect(text).toContain('err 3');
  });

  it('resolve() без открытой аварии — null', () => {
    const tracker = new DbOutageTracker();
    expect(tracker.resolve(1_000_000)).toBeNull();
  });

  it('resolve() даёт текст с длительностью и счётчиком ошибок, закрывает аварию', () => {
    const tracker = new DbOutageTracker();
    const start = 1_000_000;
    tracker.note('err 1', start);
    tracker.note('err 2', start + 5 * 60_000);
    const text = tracker.resolve(start + 12 * 60_000);
    expect(text).toContain('снова отвечает');
    expect(text).toContain('12 мин');
    expect(text).toContain('ошибок за это время: 2');
    expect(tracker.isOpen).toBe(false);
  });

  it('длительность короче минуты — словами, не "0 мин"', () => {
    const tracker = new DbOutageTracker();
    tracker.note('err', 1_000_000);
    const text = tracker.resolve(1_000_000 + 30_000);
    expect(text).toContain('меньше минуты');
    expect(text).not.toContain('0 мин');
  });

  it('новая авария после восстановления снова даёт первый DM', () => {
    const tracker = new DbOutageTracker();
    tracker.note('err 1', 1_000_000);
    tracker.resolve(1_100_000);
    const { text } = tracker.note('err again', 2_000_000);
    expect(text).toContain('База данных не отвечает');
    expect(tracker.isOpen).toBe(true);
  });

  it('reset() сбрасывает состояние без сообщения о восстановлении', () => {
    const tracker = new DbOutageTracker();
    tracker.note('err', 1_000_000);
    tracker.reset();
    expect(tracker.isOpen).toBe(false);
    expect(tracker.resolve(1_000_001)).toBeNull();
  });
});
