// @vitest-environment jsdom
// «Уведомления» и веб-пуши: строка «На этом устройстве» во всех состояниях,
// подпись раздела по каналу, блок «некуда прийти» и обе формы обращения.
// Браузер подставной (push/pushBrowser.test-helpers.ts), модуль подписки — настоящий.
import { useState } from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationsSection } from './NotificationsSection';
import { withAddressForm } from './SettingsSheet.test-helpers';
import { pushApi } from '../../push/pushApi';
import { installPushBrowser, removePushBrowser } from '../../push/pushBrowser.test-helpers';
import type { UserSettings } from '../../api';

const settings = (over: Partial<UserSettings> = {}): UserSettings => ({
  notifyEnabled: true, notifyLocalHour: 21, notifyTimezone: 'Europe/Moscow', notifyReminderEnabled: true,
  pairCardDismissed: false, mySchemaIds: [], myModeIds: [], therapistShareCards: true, therapistShareProfile: true,
  ...over,
});
const UNREACHABLE = { notifyChannel: null, notifyReachable: false, telegramLinked: false } as const;

/** Как SettingsSheet: reloadSettings перечитывает настройки — здесь подставляет afterReload. */
function renderSection(s: UserSettings, form: 'ty' | 'vy' = 'ty', afterReload: Partial<UserSettings> = {}) {
  const leaveTo = vi.fn();
  const reloadSettings = vi.fn();
  function Harness() {
    const [current, setCurrent] = useState(s);
    reloadSettings.mockImplementation(async () => setCurrent((prev) => ({ ...prev, ...afterReload })));
    return <NotificationsSection settings={current} tzLabel="Москва" patch={vi.fn()} openSubView={vi.fn()}
      leaveTo={leaveTo} reloadSettings={reloadSettings} />;
  }
  render(withAddressForm(<Harness />, form));
  return { leaveTo, reloadSettings };
}
const PUSH = { notifyChannel: 'push', notifyReachable: true } as const;

const deviceSwitch = () => screen.findByRole('switch', { name: 'На этом устройстве' });

beforeEach(() => {
  vi.spyOn(pushApi, 'config').mockResolvedValue({ publicKey: 'BAEC' });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  removePushBrowser();
  vi.restoreAllMocks();
});

describe('подпись раздела — по каналу', () => {
  it.each([
    [{ notifyChannel: 'push', notifyReachable: true }, 'Приходят в приложение'],
    [{ notifyChannel: null, notifyReachable: false }, 'Пока не приходят'],
  ] as const)('%o → «%s»', (over, hint) => {
    renderSection(settings(over));
    expect(screen.getByText(hint)).toBeTruthy();
  });
});

describe('«На этом устройстве»', () => {
  it('off, Telegram привязан — «Присылать сюда вместо Telegram»; клик включает и перечитывает настройки', async () => {
    const b = installPushBrowser();
    const subscribe = vi.spyOn(pushApi, 'subscribe').mockResolvedValue({ ok: true, delivered: true });
    const { reloadSettings } = renderSection(
      settings({ notifyChannel: 'telegram', notifyReachable: true, telegramLinked: true }), 'ty', PUSH);
    const sw = await deviceSwitch();
    expect(sw.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Присылать сюда вместо Telegram')).toBeTruthy();
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-busy')).toBe('true'); // занят, пока идёт запрос
    await waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('true'));
    expect(b.notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalled();
    expect(reloadSettings).toHaveBeenCalled();
    expect(screen.getByText('Приходят сюда')).toBeTruthy();
    expect(screen.getByText('Приходят в приложение')).toBeTruthy(); // подпись раздела — по новому каналу
    expect(sw.getAttribute('aria-busy')).toBeNull();
  });

  it('off без Telegram — «Напоминания и итоги дня — сюда»; рядом путь привязать Telegram', async () => {
    installPushBrowser();
    renderSection(settings(UNREACHABLE));
    await deviceSwitch();
    expect(screen.getByText('Напоминания и итоги дня — сюда')).toBeTruthy();
    expect(screen.getByRole('note').textContent).toContain(
      'Чтобы напоминания приходили, включи их на этом устройстве или привяжи Telegram.',
    );
  });

  it('блок «некуда прийти» на «вы»', async () => {
    installPushBrowser();
    renderSection(settings(UNREACHABLE), 'vy');
    await deviceSwitch();
    expect(screen.getByRole('note').textContent).toContain(
      'Чтобы напоминания приходили, включите их на этом устройстве или привяжите Telegram.',
    );
  });

  it('on — «Приходят сюда», клик выключает с reason user', async () => {
    installPushBrowser({ subscription: true, permission: 'granted' });
    const unsubscribe = vi.spyOn(pushApi, 'unsubscribe').mockResolvedValue(undefined);
    renderSection(settings(PUSH), 'ty', UNREACHABLE);
    const sw = await deviceSwitch();
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Приходят сюда')).toBeTruthy();
    fireEvent.click(sw);
    await waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('false'));
    expect(unsubscribe).toHaveBeenCalledWith(expect.any(String), 'user');
  });

  it.each([
    ['ty', 'Запрещены в настройках браузера — разреши уведомления для schemehappens.ru'],
    ['vy', 'Запрещены в настройках браузера — разрешите уведомления для schemehappens.ru'],
  ] as const)('denied (%s) — без тумблера, как разрешить', async (form, text) => {
    installPushBrowser({ permission: 'denied' });
    renderSection(settings({ notifyChannel: 'telegram', notifyReachable: true }), form);
    expect(await screen.findByText(text)).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'На этом устройстве' })).toBeNull();
  });

  it('отказ в окне браузера — строка сразу становится «запрещены»', async () => {
    installPushBrowser({ answer: 'denied' });
    renderSection(settings(UNREACHABLE));
    fireEvent.click(await deviceSwitch());
    expect(await screen.findByText(/^Запрещены в настройках браузера/)).toBeTruthy();
  });

  it('iPhone во вкладке Safari — объяснение и «Установить приложение» → /install', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Safari/604.1');
    const { leaveTo } = renderSection(settings(UNREACHABLE));
    expect(await screen.findByText('На iPhone и iPad уведомления приходят только в приложение с экрана «Домой».')).toBeTruthy();
    fireEvent.click(screen.getByText('Установить приложение'));
    expect(leaveTo).toHaveBeenCalledWith('/install');
    // Пуши там будут после установки — блок зовёт включить на устройстве, а не «браузер не умеет».
    expect(screen.getByRole('note').textContent).toMatch(/^Чтобы напоминания приходили/);
  });

  it('браузер без пушей (вебвью, старый) — строки нет, блок советует Chrome/Safari или Telegram; на «вы» тоже', () => {
    renderSection(settings(UNREACHABLE), 'vy');
    expect(screen.queryByText('На этом устройстве')).toBeNull();
    expect(screen.getByRole('note').textContent).toBe(
      'Этот браузер не присылает уведомления. Откройте сайт в Chrome или Safari на телефоне — или привяжите Telegram.Привязать Telegram',
    );
  });
});

describe('сверка с сервером', () => {
  it('подписка в браузере есть, а канал не push (сервер её забыл) — «выключено», клик переотправляет', async () => {
    // Ключ подписки = ключ сервера 'BAEC' (байты 4, 1, 2): переотправляется та же, новая не делается.
    installPushBrowser({ subscription: true, permission: 'granted', subscriptionKey: new Uint8Array([4, 1, 2]) });
    const subscribe = vi.spyOn(pushApi, 'subscribe').mockResolvedValue({ ok: true, delivered: true });
    renderSection(settings(UNREACHABLE), 'ty', PUSH);
    const sw = await deviceSwitch();
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    await waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('true'));
    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ endpoint: 'https://fcm.googleapis.com/fcm/send/old' }));
  });
});

describe('предупреждения после действия', () => {
  it('сервер не принял подписку — «Не получилось включить» (ты и вы), тумблер выключен', async () => {
    installPushBrowser();
    vi.spyOn(pushApi, 'subscribe').mockRejectedValue(Object.assign(new Error('Service Unavailable'), { status: 503 }));
    renderSection(settings(UNREACHABLE));
    const sw = await deviceSwitch();
    fireEvent.click(sw);
    expect((await screen.findByRole('status')).textContent).toBe('Не получилось включить — попробуй ещё раз.');
    expect(sw.getAttribute('aria-checked')).toBe('false');
  });

  it('пробное уведомление не дошло — включено, но с подсказкой проверить систему (на «вы»)', async () => {
    installPushBrowser();
    vi.spyOn(pushApi, 'subscribe').mockResolvedValue({ ok: true, delivered: false });
    renderSection(settings(UNREACHABLE), 'vy', PUSH);
    fireEvent.click(await deviceSwitch());
    expect((await screen.findByRole('status')).textContent).toBe(
      'Пробное уведомление не дошло. Проверьте, разрешены ли уведомления в системе.',
    );
  });

  it('выключить не вышло — «Не получилось выключить», тумблер остаётся включённым', async () => {
    installPushBrowser({ subscription: true, permission: 'granted' });
    vi.spyOn(pushApi, 'unsubscribe').mockRejectedValue(new TypeError('Failed to fetch'));
    renderSection(settings(PUSH), 'vy');
    const sw = await deviceSwitch();
    fireEvent.click(sw);
    expect((await screen.findByRole('status')).textContent).toBe('Не получилось выключить — попробуйте ещё раз.');
    expect(sw.getAttribute('aria-checked')).toBe('true');
  });
});
