// @vitest-environment jsdom
// Механика билета: приложение остаётся жить и ЗАБИРАЕТ сессию опросом.
//
// Главное, что держится тестами: временная сетевая беда не выглядит как отказ
// во входе (человек в этот момент подтверждает вход в другом приложении), а
// отказ и истечение — разные исходы, потому что экран обязан сказать разное.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  useLoginTicket,
  loginUrl,
  LOGIN_TICKET_SECTION,
} from './useLoginTicket';
import type { LoginTicketApi } from './loginTicketApi';

const DEPS = { botUsername: 'SchemeHappensBot', apiBase: '' };

function makeApi(over: Partial<LoginTicketApi> = {}) {
  return {
    start: vi.fn().mockResolvedValue({
      deviceCode: 'd'.repeat(64),
      userCode: 'K7M2QX94',
      expiresIn: 300,
      interval: 1,
    }),
    poll: vi.fn().mockResolvedValue({ status: 'pending' }),
    ...over,
  } as LoginTicketApi & {
    start: ReturnType<typeof vi.fn>;
    poll: ReturnType<typeof vi.fn>;
  };
}

function setup(
  api: ReturnType<typeof makeApi>,
  onSession = vi.fn(),
  reportError = vi.fn(),
) {
  const deps = { api, hostId: 'web', ...DEPS, onSession, reportError };
  return { ...renderHook(() => useLoginTicket(deps)), onSession, reportError };
}

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

describe('loginUrl', () => {
  it('Telegram — диплинк в чат бота, код внутри payload', () => {
    expect(loginUrl('telegram', 'K7M2QX94', DEPS)).toBe(
      'https://t.me/SchemeHappensBot?start=login_K7M2QX94',
    );
  });

  it('Google — редирект бэкенда с кодом билета', () => {
    expect(loginUrl('google', 'K7M2QX94', DEPS)).toBe(
      '/api/auth/google?ticket=K7M2QX94',
    );
  });

  it('учитывает свой apiBase, когда фронт живёт на другом origin', () => {
    expect(
      loginUrl('vk', 'K7M2QX94', { ...DEPS, apiBase: 'https://api.example' }),
    ).toBe('https://api.example/api/auth/vk?ticket=K7M2QX94');
  });
});

describe('begin — выписка билета', () => {
  it('показывает код и ссылку, приложение остаётся на месте', async () => {
    const api = makeApi();
    const { result } = setup(api);

    await act(async () => {
      await result.current.begin('telegram');
    });

    expect(api.start).toHaveBeenCalledWith({
      intent: 'login',
      provider: 'telegram',
      hostId: 'web',
    });
    expect(result.current.state).toEqual({
      kind: 'waiting',
      provider: 'telegram',
      code: 'K7M2QX94',
      url: 'https://t.me/SchemeHappensBot?start=login_K7M2QX94',
    });
  });

  it('сервер не ответил — честное «не получилось», а не вечное ожидание', async () => {
    const api = makeApi({
      start: vi.fn().mockRejectedValue(new Error('нет сети')),
    });
    const { result } = setup(api);

    await act(async () => {
      await result.current.begin('telegram');
    });

    expect(result.current.state).toEqual({ kind: 'failed' });
  });

  it('о сорванной выписке сообщает наверх — сервер её не видит', async () => {
    // Запрос мог не дойти вовсе (сеть, прокси), и экран при этом не крашится,
    // а аккуратно показывает «не получилось». Без отчёта такая авария
    // невидима — правило №14: обработанная авария невидимее необработанной.
    const api = makeApi({
      start: vi.fn().mockRejectedValue(new Error('нет сети')),
    });
    const { result, reportError } = setup(api);

    await act(async () => {
      await result.current.begin('telegram');
    });

    expect(reportError).toHaveBeenCalledWith({
      message: 'login ticket start failed',
      section: LOGIN_TICKET_SECTION,
    });
  });

  it('в отчёт не уезжает ни текст ошибки, ни адрес', async () => {
    // Текст приходит от браузера и может нести адрес с секретом во фрагменте
    // (разбор H0): у вебаппа это `#access_token=…`, у мини-аппа — initData.
    const api = makeApi({
      start: vi
        .fn()
        .mockRejectedValue(
          new Error('fetch failed: /auth#access_token=СЕКРЕТ'),
        ),
    });
    const { result, reportError } = setup(api);

    await act(async () => {
      await result.current.begin('telegram');
    });

    const sent = JSON.stringify(reportError.mock.calls);
    expect(sent).not.toContain('СЕКРЕТ');
    expect(sent).not.toContain('access_token');
  });

  it('удачная выписка ничего не сообщает', async () => {
    const { result, reportError } = setup(makeApi());
    await act(async () => {
      await result.current.begin('telegram');
    });
    expect(reportError).not.toHaveBeenCalled();
  });
});

describe('опрос', () => {
  it('подтверждён — сессия уходит фронту, экран ожидания больше не нужен', async () => {
    const api = makeApi({
      poll: vi
        .fn()
        .mockResolvedValueOnce({ status: 'pending' })
        .mockResolvedValue({
          status: 'linked',
          accessToken: 'a',
          expiresIn: 900,
        }),
    });
    const { result, onSession } = setup(api);

    await act(async () => {
      await result.current.begin('telegram');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    await waitFor(() => expect(onSession).toHaveBeenCalledWith('a', 900));
  });

  it('«это не я» — отдельное состояние, не истечение', async () => {
    const api = makeApi({
      poll: vi.fn().mockResolvedValue({ status: 'denied' }),
    });
    const { result } = setup(api);

    await act(async () => {
      await result.current.begin('telegram');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(result.current.state).toEqual({ kind: 'denied' });
  });

  it('истёк — так и говорим', async () => {
    const api = makeApi({
      poll: vi.fn().mockResolvedValue({ status: 'expired' }),
    });
    const { result } = setup(api);

    await act(async () => {
      await result.current.begin('telegram');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(result.current.state).toEqual({ kind: 'expired' });
  });

  it('сеть моргнула — продолжаем ждать, а не показываем отказ', async () => {
    const poll = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({
        status: 'linked',
        accessToken: 'a',
        expiresIn: 900,
      });
    const api = makeApi({ poll });
    const { result, onSession } = setup(api);

    await act(async () => {
      await result.current.begin('telegram');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    // Ровно тот случай, ради которого различаются «не достучались» и «отказ»:
    // человек как раз подтверждает вход в другом приложении.
    expect(result.current.state.kind).toBe('waiting');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await waitFor(() => expect(onSession).toHaveBeenCalled());
  });

  it('время билета вышло — опрос прекращается сам', async () => {
    const api = makeApi({
      start: vi.fn().mockResolvedValue({
        deviceCode: 'd'.repeat(64),
        userCode: 'K7M2QX94',
        expiresIn: 1,
        interval: 1,
      }),
    });
    const { result } = setup(api);

    await act(async () => {
      await result.current.begin('telegram');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(result.current.state).toEqual({ kind: 'expired' });
    const callsAfterExpiry = api.poll.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(api.poll.mock.calls.length).toBe(callsAfterExpiry);
  });

  it('нулевой интервал от сервера не превращается в опрос без пауз', async () => {
    const api = makeApi({
      start: vi.fn().mockResolvedValue({
        deviceCode: 'd'.repeat(64),
        userCode: 'K7M2QX94',
        expiresIn: 300,
        interval: 0,
      }),
    });
    const { result } = setup(api);

    await act(async () => {
      await result.current.begin('telegram');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(api.poll).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(api.poll).toHaveBeenCalledTimes(1);
  });

  it('reset прекращает ожидание — вторая кнопка не оставляет висеть первый опрос', async () => {
    const api = makeApi();
    const { result } = setup(api);

    await act(async () => {
      await result.current.begin('telegram');
    });
    act(() => result.current.reset());

    expect(result.current.state).toEqual({ kind: 'idle' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(api.poll).not.toHaveBeenCalled();
  });

  it('экран размонтирован — опрос не переживает его', async () => {
    const api = makeApi();
    const { result, unmount } = setup(api);

    await act(async () => {
      await result.current.begin('telegram');
    });
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(api.poll).not.toHaveBeenCalled();
  });
});

// Разбор 2026-08-31. Опрос анонимный, поэтому лимит на него — по IP: за общим
// NAT сотня контейнеров в одном ритме выбирает лимит адреса, сервер отвечает
// 429, и фиксированный повтор упирается в 429 до самого дедлайна — человек
// подтвердил вход, а экран говорит «истекло». Отступ разводит повторы во
// времени; наложившиеся `begin` не должны заводить второй цикл опроса.
describe('отступ при ошибках и наложение входов', () => {
  it('ошибки опроса подряд — пауза растёт, а не долбит фиксированным ритмом', async () => {
    // interval 1 → базовая пауза 1000мс. На каждую ошибку — вдвое больше.
    const api = makeApi({
      poll: vi.fn().mockRejectedValue(new Error('HTTP 429')),
    });
    const { result } = setup(api);

    await act(async () => {
      await result.current.begin('telegram');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(api.poll).toHaveBeenCalledTimes(1); // t=1000: первый опрос, ошибка

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    // t=2000: фиксированный ритм дал бы второй опрос, но отступ отодвинул его.
    expect(api.poll).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(api.poll).toHaveBeenCalledTimes(2); // t=3000: пауза выросла до 2000
    expect(result.current.state.kind).toBe('waiting'); // не «истекло»
  });

  it('удачный ответ гасит отступ — следующая пауза снова базовая', async () => {
    const api = makeApi({
      poll: vi
        .fn()
        .mockRejectedValueOnce(new Error('HTTP 429'))
        .mockResolvedValue({ status: 'pending' }),
    });
    const { result } = setup(api);

    await act(async () => {
      await result.current.begin('telegram');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(api.poll).toHaveBeenCalledTimes(1); // ошибка → отступ 2000

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(api.poll).toHaveBeenCalledTimes(2); // t=3000: успех сбросил отступ

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    // Без сброса пауза осталась бы 2000 и третьего опроса тут ещё не было бы.
    expect(api.poll).toHaveBeenCalledTimes(3); // t=4000: снова базовые 1000
  });

  it('два начатых входа подряд — один цикл опроса, по свежему билету', async () => {
    let n = 0;
    const api = makeApi({
      start: vi.fn().mockImplementation(async () => ({
        deviceCode: `code${++n}`,
        userCode: 'K7M2QX94',
        expiresIn: 300,
        interval: 1,
      })),
    });
    const { result } = setup(api);

    await act(async () => {
      const p1 = result.current.begin('telegram');
      const p2 = result.current.begin('google');
      await Promise.all([p1, p2]);
    });

    expect(api.start).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(api.poll).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    // Ровно один цикл: наложение не оставило второй жить (иначе было бы 4).
    expect(api.poll).toHaveBeenCalledTimes(2);
    // И опрашивается ВТОРОЙ билет — первый брошен, а не гоняется параллельно.
    expect(api.poll.mock.calls.every(([code]) => code === 'code2')).toBe(true);
  });
});

// Защитные ветки: сюда попадают, когда сервер ответил не тем, что обещал, или
// экран закрыли посреди ожидания. Без них хук либо падал бы на размонтированном
// компоненте, либо считал бы вход состоявшимся по пустому ответу.
describe('крайние случаи', () => {
  it('«подтверждён», но токена нет — вход НЕ считается состоявшимся', async () => {
    const poll = vi
      .fn()
      .mockResolvedValueOnce({ status: 'linked' })
      .mockResolvedValue({
        status: 'linked',
        accessToken: 'a',
        expiresIn: 900,
      });
    const { result, onSession } = setup(makeApi({ poll }));

    await act(async () => {
      await result.current.begin('telegram');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(onSession).not.toHaveBeenCalled();
    expect(result.current.state.kind).toBe('waiting');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await waitFor(() => expect(onSession).toHaveBeenCalled());
  });

  it('сервер не назвал срок жизни токена — берём разумные 15 минут', async () => {
    const api = makeApi({
      poll: vi.fn().mockResolvedValue({ status: 'linked', accessToken: 'a' }),
    });
    const { result, onSession } = setup(api);

    await act(async () => {
      await result.current.begin('telegram');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    await waitFor(() => expect(onSession).toHaveBeenCalledWith('a', 900));
  });

  it('экран закрыли, пока выписывался билет — состояние не трогаем', async () => {
    let release!: () => void;
    const api = makeApi({
      start: vi.fn().mockReturnValue(
        new Promise((r) => {
          release = () =>
            r({
              deviceCode: 'd'.repeat(64),
              userCode: 'K7M2QX94',
              expiresIn: 300,
              interval: 1,
            });
        }),
      ),
    });
    const { result, unmount } = setup(api);

    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.begin('telegram');
    });
    unmount();
    await act(async () => {
      release();
      await pending;
    });

    // Опрос не стартовал: билет пришёл в уже закрытый экран.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(api.poll).not.toHaveBeenCalled();
  });

  it('сорванный старт на закрытом экране не ставит «не получилось»', async () => {
    let reject!: () => void;
    const api = makeApi({
      start: vi.fn().mockReturnValue(
        new Promise((_r, rej) => {
          reject = () => rej(new Error('нет сети'));
        }),
      ),
    });
    const { result, unmount } = setup(api);

    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.begin('telegram');
    });
    const before = result.current.state;
    unmount();
    await act(async () => {
      reject();
      await pending;
    });

    expect(result.current.state).toBe(before);
  });
});
