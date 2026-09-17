// @vitest-environment jsdom
// Экран входа для web-хоста: правило онбординга CLAUDE.md «откуда это и
// зачем» обязано выполниться ДО первого действия, плюс ты/вы для строк с
// обращением.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AddressFormContext } from '../utils/addressForm';
import { LoginScreen } from './LoginScreen';

afterEach(() => vi.unstubAllGlobals());

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

  // Провайдеры теперь ССЫЛКИ, а не кнопки: подтверждение открывается снаружи
  // (target="_blank"), чтобы приложение осталось живым и забрало сессию
  // опросом — с ярлыка иначе войти нельзя вовсе (разбор 2026-08-28).
  it('на экране есть все три пути входа и вход по email', async () => {
    // Ссылки появляются, когда выписан билет — экран сам ходит за ним при
    // открытии, чтобы по кнопке пришлось нажать один раз, а не два.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            deviceCode: 'd'.repeat(64),
            userCode: 'K7M2QX94',
            expiresIn: 300,
            interval: 3,
          }),
      }),
    );
    render(<LoginScreen />);
    for (const name of [
      'Войти через Telegram',
      'Войти через Google',
      'Войти через ВКонтакте',
    ]) {
      expect(await screen.findByRole('link', { name })).toBeTruthy();
    }
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

// Экран обязан отличать новичка от человека, у которого истекла сессия:
// «Войдите, чтобы продолжить» второму — это молчание о случившемся, ровно та
// жалоба «приложение не сообщает, просто выкидывает» (разбор 2026-08-28).
describe('LoginScreen — новичок против истёкшей сессии', () => {
  beforeEach(() => localStorage.clear());

  it('новичку объясняют, что это за приложение и зачем', () => {
    render(<LoginScreen />);
    expect(screen.getByText(/инструмент самопознания/)).toBeTruthy();
    expect(screen.queryByText(/Вход устарел/)).toBeNull();
  });

  it('вернувшемуся говорят, что произошло и что данные на месте', () => {
    localStorage.setItem('auth_seen', '1');
    render(<LoginScreen />);
    expect(screen.getByText(/Вход устарел/)).toBeTruthy();
    expect(screen.getByText(/Данные на месте/)).toBeTruthy();
  });

  it('приглашение тоже разное, и оба варианта звучат в обеих формах', () => {
    localStorage.setItem('auth_seen', '1');
    const { unmount } = render(<LoginScreen />);
    expect(screen.getByText('Войди заново')).toBeTruthy();
    unmount();

    render(
      <AddressFormContext.Provider value={{ form: 'vy', setForm: () => {} }}>
        <LoginScreen />
      </AddressFormContext.Provider>,
    );
    expect(screen.getByText('Войдите заново')).toBeTruthy();
  });
});
