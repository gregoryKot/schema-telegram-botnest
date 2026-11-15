// @vitest-environment jsdom
// Telegram Web и MAX в браузере: «Привязать» VK ID и Яндекс ID уходил редиректом во фрейме и
// обрывался молча. Шов целиком: живое определение хоста → строки входа → настоящая привязка.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { setHost } from '../../../../shared/src/host';
import { AddressFormContext } from '../../utils/addressForm';
import { SignInMethods } from './SignInMethods';
import { useProviderActions } from './useProviderActions';

const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response));
const realLocation = window.location;
const g = globalThis as { Telegram?: unknown; WebApp?: unknown };

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, hash: '', href: '' } });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockClear();
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  delete g.Telegram;
  delete g.WebApp;
  setHost(null);
});

/** Как в AccountPage: строки входа и привязка через куку link_token с уходом на провайдера. */
function Methods() {
  const actions = useProviderActions('tok', async () => {}, () => {});
  return (
    <SignInMethods providers={[{ provider: 'telegram', email: null, displayName: null }]} userId="777"
      loading={false} busy={actions.busy} onLink={{ vk: actions.linkVk, yandex: actions.linkYandex }} onUnlink={() => {}} />
  );
}

function tapLink(row: 'ВКонтакте' | 'Яндекс', form: 'ty' | 'vy' = 'ty') {
  render(<AddressFormContext.Provider value={{ form, setForm: vi.fn() }}><Methods /></AddressFormContext.Provider>);
  fireEvent.click(within(screen.getByText(row).closest('.aa-row') as HTMLElement).getByRole('button', { name: 'Привязать' }));
}

const telegram = (platform: string) => { g.Telegram = { WebApp: { platform, initData: 'user=%7B%7D&hash=a' } }; };
const hintText = () => (screen.getByRole('status').textContent ?? '').replace(/\u00a0/g, ' '); // PaperAlert клеит короткие слова
const linkTokenCalls = () => fetchMock.mock.calls.filter(([url]) => url.includes('/api/auth/link-token'));

describe('«Привязать» в веб-версии мессенджера — подсказка вместо перехода', () => {
  it('Telegram Web: подсказка «ты», куку привязки не просим и никуда не уходим', () => {
    telegram('weba');
    tapLink('ВКонтакте');
    expect(hintText()).toBe('VK ID отсюда не привязать' +
      'В веб-версии Telegram страница VK ID не открывается. Открой «Всё по схеме» в приложении Telegram на телефоне или компьютере и привяжи VK ID в «Аккаунте».');
    expect(linkTokenCalls()).toHaveLength(0);
    expect(window.location.href).toBe('');
  });

  it('форма «вы» — та же подсказка во множественном числе', () => {
    telegram('webk');
    tapLink('ВКонтакте', 'vy');
    expect(hintText()).toContain('Откройте «Всё по схеме» в приложении Telegram на телефоне или компьютере и привяжите VK ID в «Аккаунте».');
    expect(linkTokenCalls()).toHaveLength(0);
  });

  it('MAX в браузере: у Яндекса — Яндекс ID и приложение MAX', () => {
    g.WebApp = { initData: '', platform: 'web' };
    tapLink('Яндекс');
    expect(hintText()).toContain('Яндекс ID отсюда не привязать');
    expect(hintText()).toContain('В веб-версии MAX страница Яндекс ID не открывается. Открой «Всё по схеме» в приложении MAX');
    expect(linkTokenCalls()).toHaveLength(0);
  });
});

describe('«Привязать» вне фрейма — прежняя привязка', () => {
  it.each([
    ['обычный браузер', () => {}],
    ['Telegram на телефоне', () => telegram('ios')],
  ])('%s: кука link_token, затем уход на /api/auth/vk, подсказки нет', async (_name, setup) => {
    setup();
    tapLink('ВКонтакте');
    await waitFor(() => expect(window.location.href).toBe('/api/auth/vk'));
    expect(linkTokenCalls()).toHaveLength(1);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
