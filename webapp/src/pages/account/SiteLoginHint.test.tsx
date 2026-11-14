// @vitest-environment jsdom
// Подсказка в «Аккаунте» на сайте: без VK ID и Яндекс ID входа на сайт скоро не
// останется. Внутри Telegram зовёт SiteAccessCard — здесь молчим.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

const hostId = vi.hoisted(() => ({ current: 'web' }));
vi.mock('../../../../shared/src/host', () => ({ getHost: () => ({ id: hostId.current }) }));

import { AddressFormContext } from '../../utils/addressForm';
import type { AccountProvider } from './ProviderRows';
import { SiteLoginHint } from './SiteLoginHint';

afterEach(() => { cleanup(); hostId.current = 'web'; });

const p = (provider: AccountProvider['provider']): AccountProvider => ({ provider, displayName: null, email: null });

function show(providers: AccountProvider[], form: 'ty' | 'vy' = 'ty') {
  const { container } = render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <SiteLoginHint providers={providers} />
    </AddressFormContext.Provider>,
  );
  return (container.textContent ?? '').replace(/\u00a0/g, ' '); // PaperAlert склеивает короткие слова неразрывным пробелом
}

describe('SiteLoginHint', () => {
  it('на сайте с одной почтой — вход по почте отключён, зовёт привязать VK ID или Яндекс ID, в обеих формах', () => {
    const ty = show([p('email')]);
    expect(ty).toContain('Вход по почте отключён. Привяжи ниже VK ID или Яндекс ID — ими и будешь входить на сайт.');
    expect(ty).not.toMatch(/скоро/);
    cleanup();
    expect(show([p('email')], 'vy')).toContain('Привяжите ниже VK ID или Яндекс ID — ими и будете входить на сайт.');
  });

  it('VK ID уже есть — молчит', () => {
    expect(show([p('email'), p('vk')])).toBe('');
  });

  it('внутри Telegram — молчит: там своя карточка', () => {
    hostId.current = 'telegram';
    expect(show([p('telegram'), p('email')])).toBe('');
  });
});
