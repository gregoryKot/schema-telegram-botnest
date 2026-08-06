// @vitest-environment jsdom
// Состояние привязки аккаунта. Главное здесь — защита от второго запуска:
// у сервера остаётся один активный код на аккаунт, и второе нажатие погасило
// бы тот код, которого человек уже ждёт в браузере.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAccountLink } from './useAccountLink';
import { openLinkPage, pollLink, startLink } from '../utils/deviceLink';
import { api } from '../api';

vi.mock('../utils/deviceLink', () => ({
  startLink: vi.fn(),
  pollLink: vi.fn(),
  openLinkPage: vi.fn(),
}));
vi.mock('../../../shared/src/host', () => ({
  getHost: () => ({ id: 'max' }),
}));
vi.mock('../api', () => ({ api: { trackEvent: vi.fn() } }));

const START = {
  deviceCode: 'd'.repeat(64),
  userCode: 'ABCD2345',
  expiresIn: 300,
  interval: 3,
};

const mocked = {
  start: startLink as unknown as ReturnType<typeof vi.fn>,
  poll: pollLink as unknown as ReturnType<typeof vi.fn>,
  open: openLinkPage as unknown as ReturnType<typeof vi.fn>,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocked.start.mockResolvedValue(START);
  mocked.poll.mockResolvedValue('linked');
});

describe('useAccountLink', () => {
  it('начинает с покоя — до нажатия ничего не запрашивается', () => {
    const { result } = renderHook(() => useAccountLink());
    expect(result.current.state).toBe('idle');
    expect(mocked.start).not.toHaveBeenCalled();
  });

  it('нажатие: просит коды, открывает браузер и ждёт подтверждения', async () => {
    const { result } = renderHook(() => useAccountLink());

    await act(async () => {
      await result.current.begin();
    });

    expect(mocked.start).toHaveBeenCalledWith('max');
    expect(mocked.open).toHaveBeenCalledWith('ABCD2345');
    await waitFor(() => expect(result.current.state).toBe('linked'));
  });

  it('код показывается человеку, пока идёт ожидание', async () => {
    let resolvePoll: (v: string) => void = () => {};
    mocked.poll.mockReturnValue(
      new Promise<string>((r) => {
        resolvePoll = r;
      }),
    );
    const { result } = renderHook(() => useAccountLink());

    act(() => {
      void result.current.begin();
    });

    await waitFor(() => expect(result.current.state).toBe('waiting'));
    expect(result.current.start?.userCode).toBe('ABCD2345');
    await act(async () => {
      resolvePoll('linked');
    });
  });

  it('второе нажатие во время ожидания не гасит уже выданный код', async () => {
    let resolvePoll: (v: string) => void = () => {};
    mocked.poll.mockReturnValue(
      new Promise<string>((r) => {
        resolvePoll = r;
      }),
    );
    const { result } = renderHook(() => useAccountLink());

    act(() => {
      void result.current.begin();
    });
    await waitFor(() => expect(result.current.state).toBe('waiting'));
    await act(async () => {
      await result.current.begin();
    });

    expect(mocked.start).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolvePoll('linked');
    });
  });

  // ── Аналитика (правило №8): путь идёт через внешний браузер, и без события
  // «начал» отвал посередине неотличим от «даже не пробовал». ───────────────
  it('шлёт «начал перенос» сразу, ещё до ухода в браузер', async () => {
    const { result } = renderHook(() => useAccountLink());

    await act(async () => {
      await result.current.begin();
    });

    expect(api.trackEvent).toHaveBeenCalledWith('account_link_started', {
      host: 'max',
    });
  });

  it('успех НЕ считается здесь — его считает браузер, иначе двойной счёт', async () => {
    const { result } = renderHook(() => useAccountLink());

    await act(async () => {
      await result.current.begin();
    });

    const names = (
      api.trackEvent as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.map((c) => c[0] as string);
    expect(names).not.toContain('account_link_confirmed');
  });

  it('код протух — событие «не вышло» с причиной expired', async () => {
    mocked.poll.mockResolvedValue('expired');
    const { result } = renderHook(() => useAccountLink());

    await act(async () => {
      await result.current.begin();
    });

    expect(api.trackEvent).toHaveBeenCalledWith('account_link_failed', {
      host: 'max',
      reason: 'expired',
    });
  });

  it('сервер упал — причина error, а не текст ошибки (meta не шифруется)', async () => {
    mocked.start.mockRejectedValue(new Error('API error: 500 at userId 12345'));
    const { result } = renderHook(() => useAccountLink());

    await act(async () => {
      await result.current.begin();
    });

    expect(api.trackEvent).toHaveBeenCalledWith('account_link_failed', {
      host: 'max',
      reason: 'error',
    });
    const sent = JSON.stringify(
      (api.trackEvent as unknown as ReturnType<typeof vi.fn>).mock.calls,
    );
    expect(sent).not.toContain('12345');
  });

  it('код протух — состояние «не вышло», можно начать заново', async () => {
    mocked.poll.mockResolvedValue('expired');
    const { result } = renderHook(() => useAccountLink());

    await act(async () => {
      await result.current.begin();
    });

    expect(result.current.state).toBe('failed');
  });

  it('сервер не ответил на запрос кодов — тоже «не вышло», а не вечное ожидание', async () => {
    mocked.start.mockRejectedValue(new Error('API error: 500'));
    const { result } = renderHook(() => useAccountLink());

    await act(async () => {
      await result.current.begin();
    });

    expect(result.current.state).toBe('failed');
    expect(result.current.busy).toBe(false);
  });
});
