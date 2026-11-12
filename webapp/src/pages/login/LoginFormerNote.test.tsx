// @vitest-environment jsdom
// Вход через Google и через Telegram на сайте убран (2026-11): подсказка ведёт
// прежних пользователей к их аккаунту. Строки с обращением — обе формы, без
// рода читателя.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AddressFormContext } from '../../utils/addressForm';
import { botUrl } from '../../utils/botConfig';
import { LoginFormerNote } from './LoginFormerNote';

afterEach(cleanup);

function renderNote(form: 'ty' | 'vy') {
  render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <LoginFormerNote />
    </AddressFormContext.Provider>,
  );
  const text = (id: string) => screen.getByTestId(id).textContent ?? '';
  return { telegram: text('login-telegram-note'), google: text('login-google-note') };
}

describe('LoginFormerNote — прежний вход через Telegram', () => {
  it('«ты»: называет путь — приложение в боте, почта или VK ID — и что записи на месте', () => {
    const { telegram } = renderNote('ty');
    expect(telegram).toContain('Раньше вход был через Telegram?');
    expect(telegram).toContain('Открой приложение в боте');
    expect(telegram).toContain('добавь там почту или VK ID и входи ими на сайте');
    expect(telegram).toContain('Записи на месте');
    expect(telegram).not.toMatch(/Откройте|добавьте|входите|входил/);
  });

  it('«вы»: та же подсказка во множественном числе', () => {
    const { telegram } = renderNote('vy');
    expect(telegram).toContain('Откройте приложение в боте');
    expect(telegram).toContain('добавьте там почту или VK ID и входите ими на сайте');
    expect(telegram).not.toMatch(/Открой |добавь |входи /);
  });

  it('ссылка ведёт в чат бота, а не на вход: ни кода, ни oauth.telegram.org', () => {
    renderNote('ty');
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe(botUrl);
    expect(link.getAttribute('href')).not.toMatch(/start=|oauth/);
  });
});

describe('LoginFormerNote — прежний вход через Google', () => {
  it('«ты»: зовёт войти по той же почте и обещает прежний аккаунт', () => {
    const { google } = renderNote('ty');
    expect(google).toContain('Раньше вход был через Google?');
    expect(google).toContain('Войди по email с той же почтой');
    expect(google).toContain('Аккаунт и записи на месте');
    expect(google).not.toMatch(/Войдите|входили/);
  });

  it('«вы»: та же подсказка во множественном числе', () => {
    const { google } = renderNote('vy');
    expect(google).toContain('Войдите по email с той же почтой');
    expect(google).not.toMatch(/Войди |входил\b/);
  });
});
