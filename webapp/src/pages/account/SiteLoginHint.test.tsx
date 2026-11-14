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
  return container.textContent ?? '';
}

describe('SiteLoginHint', () => {
  it('на сайте с одной почтой — зовёт привязать VK ID или Яндекс ID, в обеих формах', () => {
    expect(show([p('email')])).toContain('Привяжи ниже VK ID или Яндекс ID');
    cleanup();
    expect(show([p('email')], 'vy')).toContain('Привяжите ниже VK ID или Яндекс ID');
  });

  it('VK ID уже есть — молчит', () => {
    expect(show([p('email'), p('vk')])).toBe('');
  });

  it('внутри Telegram — молчит: там своя карточка', () => {
    hostId.current = 'telegram';
    expect(show([p('telegram'), p('email')])).toBe('');
  });
});
