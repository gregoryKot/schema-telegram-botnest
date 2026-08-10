// CatchupTimer — обёртка над setTimeout, вынесенная из TelegramScheduleService
// (см. telegram.catchup-timer.ts). Регрессия: таймер должен быть снимаемым
// ДО срабатывания — иначе он стреляет в уже закрытый Prisma-пул после
// app.close() (флак e2e-джобы `migrations`).
import { CatchupTimer } from './telegram.catchup-timer';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('CatchupTimer', () => {
  it('isArmed() false до arm(), true после', () => {
    const timer = new CatchupTimer();
    expect(timer.isArmed()).toBe(false);
    timer.arm(() => {}, 30_000);
    expect(timer.isArmed()).toBe(true);
  });

  it('clear() до срабатывания — колбэк не вызывается, isArmed() снова false', () => {
    const fn = jest.fn();
    const timer = new CatchupTimer();
    timer.arm(fn, 30_000);
    timer.clear();
    expect(timer.isArmed()).toBe(false);
    jest.advanceTimersByTime(60_000);
    expect(fn).not.toHaveBeenCalled();
  });

  it('без clear() колбэк срабатывает по истечении задержки', () => {
    const fn = jest.fn();
    const timer = new CatchupTimer();
    timer.arm(fn, 30_000);
    jest.advanceTimersByTime(30_000);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(); // без аргументов — как реальный setTimeout-колбэк
  });

  it('clear() без предшествующего arm() — не падает', () => {
    const timer = new CatchupTimer();
    expect(() => timer.clear()).not.toThrow();
  });
});
