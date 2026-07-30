// @vitest-environment jsdom
// Экран входа для web-хоста: правило онбординга CLAUDE.md «откуда это и
// зачем» обязано выполниться ДО первого действия, плюс ты/вы для строк с
// обращением.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AddressFormContext } from '../utils/addressForm';
import { LoginScreen } from './LoginScreen';

beforeEach(() => {
  cleanup();
});

describe('LoginScreen — онбординг «откуда это и зачем»', () => {
  it('до входа видно, что это за инструмент', () => {
    render(<LoginScreen />);
    expect(screen.getByText(/инструмент самопознания/)).toBeTruthy();
  });

  it('до входа видно, зачем это и когда виден результат (3–5 дней)', () => {
    render(<LoginScreen />);
    expect(screen.getByText(/через 3–5 дней/i)).toBeTruthy();
  });

  it('на экране есть все три кнопки входа и вход по email', () => {
    render(<LoginScreen />);
    expect(
      screen.getByRole('button', { name: 'Войти через Telegram' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Войти через Google' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Войти через ВКонтакте' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Войти по email' })).toBeTruthy();
  });
});

describe('LoginScreen — ты/вы', () => {
  it('форма «ты» (дефолт)', () => {
    render(<LoginScreen />);
    expect(screen.getByText('Войди, чтобы продолжить')).toBeTruthy();
  });

  it('форма «вы»', () => {
    render(
      <AddressFormContext.Provider value={{ form: 'vy', setForm: () => {} }}>
        <LoginScreen />
      </AddressFormContext.Provider>,
    );
    expect(screen.getByText('Войдите, чтобы продолжить')).toBeTruthy();
    expect(screen.getByText(/что вас питает/)).toBeTruthy();
  });
});
