// @vitest-environment jsdom
// Хук строки «На этом устройстве» (usePushDevice.ts): загрузка состояния,
// переключение по клику, занятость и строки-предупреждения после действия.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePushDevice } from './usePushDevice';
import { pushApi } from './pushApi';
import * as subscription from './pushSubscription';
import { installPushBrowser, removePushBrowser } from './pushBrowser.test-helpers';
import { installTelegram, removeTelegram } from '../host/tgStub.test-helpers';
import type { NotifyChannel } from '../../../shared/src/settings/notifyReach';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  removePushBrowser();
  removeTelegram();
  vi.restoreAllMocks();
});

/** channel — notifyChannel настроек; afterChange — каким его вернёт перечитывание после переключения. */
async function ready(channel: NotifyChannel | null = null, afterChange: NotifyChannel | null = channel) {
  const box = { channel };
  const onChanged = vi.fn(() => { box.channel = afterChange; });
  const hook = renderHook(() => usePushDevice(box.channel, onChanged));
  await waitFor(() => expect(hook.result.current.state).not.toBeNull());
  return { ...hook, onChanged };
}

describe('usePushDevice — состояние', () => {
  it('вебвью Telegram — «не поддерживается» сразу, без запроса ключа', () => {
    installTelegram();
    installPushBrowser();
    const config = vi.spyOn(pushApi, 'config');
    const { result } = renderHook(() => usePushDevice(null, vi.fn()));
    expect(result.current.state).toBe('unsupported');
    expect(config).not.toHaveBeenCalled();
  });

  it('браузер с пушами: пока едет ключ — null (скелетон), потом off', async () => {
    installPushBrowser();
    vi.spyOn(pushApi, 'config').mockResolvedValue({ publicKey: 'KEY' });
    const { result } = renderHook(() => usePushDevice(null, vi.fn()));
    expect(result.current.state).toBeNull();
    await waitFor(() => expect(result.current.state).toBe('off'));
  });

  it('подписка на устройстве есть и канал push — on', async () => {
    installPushBrowser({ subscription: true });
    vi.spyOn(pushApi, 'config').mockResolvedValue({ publicKey: 'KEY' });
    expect((await ready('push')).result.current.state).toBe('on');
  });

  it('подписка в браузере есть, а сервер её забыл (канал не push) — off; клик переотправляет её', async () => {
    installPushBrowser({ subscription: true });
    vi.spyOn(pushApi, 'config').mockResolvedValue({ publicKey: 'KEY' });
    const enable = vi.spyOn(subscription, 'enablePush').mockResolvedValue({ kind: 'on', delivered: true });
    const disable = vi.spyOn(subscription, 'disablePush');
    const { result } = await ready('telegram', 'push');
    expect(result.current.state).toBe('off');
    await act(async () => result.current.toggle());
    await waitFor(() => expect(result.current.state).toBe('on'));
    expect(enable).toHaveBeenCalledWith('KEY');
    expect(disable).not.toHaveBeenCalled();
  });

  it('ключа на сервере нет или ручка не ответила — «не поддерживается»', async () => {
    installPushBrowser();
    vi.spyOn(pushApi, 'config').mockResolvedValueOnce({ publicKey: null });
    expect((await ready()).result.current.state).toBe('unsupported');
    vi.spyOn(pushApi, 'config').mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect((await ready()).result.current.state).toBe('unsupported');
  });
});

describe('usePushDevice — переключение', () => {
  beforeEach(() => {
    vi.spyOn(pushApi, 'config').mockResolvedValue({ publicKey: 'KEY' });
  });

  it('включили — занятость на время запроса, потом on и перечитанные настройки', async () => {
    installPushBrowser();
    let finish: (v: subscription.EnableOutcome) => void = () => undefined;
    const enable = vi.spyOn(subscription, 'enablePush').mockReturnValue(new Promise((r) => { finish = r; }));
    const { result, onChanged } = await ready(null, 'push');
    act(() => result.current.toggle());
    expect(result.current.busy).toBe(true);
    act(() => result.current.toggle()); // второй клик в полёте — игнор
    expect(enable).toHaveBeenCalledTimes(1);
    expect(enable).toHaveBeenCalledWith('KEY');
    await act(async () => finish({ kind: 'on', delivered: true }));
    expect(result.current).toMatchObject({ state: 'on', busy: false, notice: null });
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('пробный пуш не дошёл — on и предупреждение not-delivered', async () => {
    installPushBrowser();
    vi.spyOn(subscription, 'enablePush').mockResolvedValue({ kind: 'on', delivered: false });
    const { result } = await ready(null, 'push');
    await act(async () => result.current.toggle());
    await waitFor(() => expect(result.current.notice).toBe('not-delivered'));
    expect(result.current.state).toBe('on');
  });

  it('запретили — denied, настройки не перечитываются', async () => {
    installPushBrowser();
    vi.spyOn(subscription, 'enablePush').mockResolvedValue({ kind: 'denied' });
    const { result, onChanged } = await ready();
    await act(async () => result.current.toggle());
    await waitFor(() => expect(result.current.state).toBe('denied'));
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('закрыли окно — остаётся off без предупреждения', async () => {
    installPushBrowser();
    vi.spyOn(subscription, 'enablePush').mockResolvedValue({ kind: 'dismissed' });
    const { result } = await ready();
    await act(async () => result.current.toggle());
    await waitFor(() => expect(result.current.busy).toBe(false));
    expect(result.current).toMatchObject({ state: 'off', notice: null });
  });

  it('ошибка включения (и даже бросок из enablePush) — off и enable-failed', async () => {
    installPushBrowser();
    vi.spyOn(subscription, 'enablePush').mockRejectedValue(new Error('requestPermission упал'));
    const { result } = await ready();
    await act(async () => result.current.toggle());
    await waitFor(() => expect(result.current.notice).toBe('enable-failed'));
    expect(result.current.state).toBe('off');
  });

  it('выключили — off и перечитанные настройки; сбой — остаётся on и disable-failed', async () => {
    installPushBrowser({ subscription: true });
    const disable = vi.spyOn(subscription, 'disablePush').mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { result, onChanged } = await ready('push', null);
    await act(async () => result.current.toggle());
    await waitFor(() => expect(result.current.notice).toBe('disable-failed'));
    expect(result.current.state).toBe('on');
    disable.mockResolvedValueOnce(undefined);
    await act(async () => result.current.toggle());
    await waitFor(() => expect(result.current.state).toBe('off'));
    expect(result.current.notice).toBeNull();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});
