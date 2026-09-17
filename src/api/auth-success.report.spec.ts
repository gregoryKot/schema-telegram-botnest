// Троттлинг успешного входа — dual к auth-failure.report.spec.ts. guard
// проверяет initData/JWT на КАЖДЫЙ запрос экрана мини-аппа (полтора десятка
// за одно открытие), а считать нужно СЕССИИ, не запросы — иначе один
// активный юзер даёт тысячи строк auth_success в сутки.
import { reportAuthSuccess } from './auth-success.report';

describe('reportAuthSuccess', () => {
  it('шквал запросов одного юзера на одной площадке в одном окне — ОДНА строка', () => {
    const track = jest.fn();
    for (let i = 0; i < 15; i += 1) {
      reportAuthSuccess(42n, 'telegram', {
        track,
        now: 1_000_000 + i * 1000, // 15 секунд разброса — одно открытие экрана
      });
    }

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith({ host: 'telegram' });
  });

  it('два разных юзера в том же окне — ДВЕ строки', () => {
    const track = jest.fn();
    reportAuthSuccess(101n, 'telegram', { track, now: 2_000_000 });
    reportAuthSuccess(102n, 'telegram', { track, now: 2_000_000 });

    expect(track.mock.calls).toEqual([
      [{ host: 'telegram' }],
      [{ host: 'telegram' }],
    ]);
  });

  it('тот же юзер и площадка, но окно (5 минут) истекло — новая строка', () => {
    const track = jest.fn();
    reportAuthSuccess(7n, 'max', { track, now: 3_000_000 });
    reportAuthSuccess(7n, 'max', { track, now: 3_000_000 + 6 * 60_000 });

    expect(track).toHaveBeenCalledTimes(2);
    expect(track).toHaveBeenNthCalledWith(1, { host: 'max' });
    expect(track).toHaveBeenNthCalledWith(2, { host: 'max' });
  });

  it('один юзер, но разные площадки — обе считаются (переезд Telegram↔MAX)', () => {
    const track = jest.fn();
    reportAuthSuccess(9n, 'telegram', { track, now: 4_000_000 });
    reportAuthSuccess(9n, 'max', { track, now: 4_000_000 });

    expect(track.mock.calls).toEqual([
      [{ host: 'telegram' }],
      [{ host: 'max' }],
    ]);
  });
});
