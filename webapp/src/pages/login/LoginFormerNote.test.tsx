// @vitest-environment jsdom
// Вход через Google, Telegram и по почте на сайте убран (2026-11): подсказка ведёт
// прежних пользователей к их аккаунту. Строки с обращением — обе формы, без
// рода читателя.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AddressFormContext } from '../../utils/addressForm';
import { botHandle, botUrl } from '../../utils/botConfig';
import { OPERATOR_EMAIL } from '../../legal/operator';
import { LoginFormerNote } from './LoginFormerNote';

afterEach(cleanup);

function renderNote(form: 'ty' | 'vy') {
  render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <LoginFormerNote />
    </AddressFormContext.Provider>,
  );
  const text = (id: string) => screen.getByTestId(id).textContent ?? '';
  return { telegram: text('login-telegram-note'), email: text('login-email-note') };
}

describe('LoginFormerNote — прежний вход через Telegram', () => {
  it('«ты»: называет путь — приложение в боте, VK ID или Яндекс ID — и что записи на месте', () => {
    const { telegram } = renderNote('ty');
    expect(telegram).toContain('Раньше вход был через Telegram?');
    expect(telegram).toContain('Открой приложение в боте');
    expect(telegram).toContain('добавь там VK ID или Яндекс ID и входи ими на сайте');
    expect(telegram).toContain('Записи на месте');
    expect(telegram).not.toMatch(/Откройте|добавьте|входите|входил/);
  });

  it('«вы»: та же подсказка во множественном числе', () => {
    const { telegram } = renderNote('vy');
    expect(telegram).toContain('Откройте приложение в боте');
    expect(telegram).toContain('добавьте там VK ID или Яндекс ID и входите ими на сайте');
    expect(telegram).not.toMatch(/Открой |добавь |входи /);
  });

  it('ссылка ведёт в чат бота, а не на вход: ни кода, ни oauth.telegram.org', () => {
    renderNote('ty');
    const link = screen.getByRole('link', { name: botHandle });
    expect(link.getAttribute('href')).toBe(botUrl);
    expect(link.getAttribute('href')).not.toMatch(/start=|oauth/);
  });
});

describe('LoginFormerNote — прежний вход по почте или через Google', () => {
  it('«ты»: вход по почте отключён — привязать VK ID или Яндекс ID там, где сайт открыт, иначе написать', () => {
    const { email } = renderNote('ty');
    expect(email).toContain('Раньше вход был по почте или через Google?');
    expect(email).toContain('Вход по почте отключён.');
    expect(email).toContain('Если сайт открыт на другом устройстве — привяжи там в «Аккаунте» VK ID или Яндекс ID.');
    expect(email).toContain(`Если нет — напиши на ${OPERATOR_EMAIL}`);
    expect(email).not.toMatch(/скоро|войди по email|привяжите|напишите|входил/);
  });

  it('«вы»: та же подсказка во множественном числе', () => {
    const { email } = renderNote('vy');
    expect(email).toContain('привяжите там в «Аккаунте» VK ID или Яндекс ID');
    expect(email).toContain(`Если нет — напишите на ${OPERATOR_EMAIL}`);
    expect(email).not.toMatch(/привяжи |напиши /);
  });

  it('адрес оператора — ссылка mailto', () => {
    renderNote('ty');
    expect(screen.getByRole('link', { name: OPERATOR_EMAIL }).getAttribute('href')).toBe(`mailto:${OPERATOR_EMAIL}`);
  });
});
