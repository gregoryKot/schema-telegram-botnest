// @vitest-environment jsdom
// Состояние привязки аккаунта. Главное здесь — защита от второго запуска:
// у сервера остаётся один активный код на аккаунт, и второе нажатие погасило
// бы тот код, которого человек уже ждёт в браузере.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAccountLink } from './useAccountLink';
import { openLinkPage, pollLink, startLink } from '../utils/deviceLink';

vi.mock('../utils/deviceLink', () => ({
  startLink: vi.fn(),
  pollLink: vi.fn(),
  openLinkPage: vi.fn(),
}));
vi.mock('../../../shared/src/host', () => ({
  getHost: () => ({ id: 'max' }),
}));

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
