// @vitest-environment jsdom
// Экран-тупик обязан назвать адрес: «напиши нам» не говорит, кому и куда
// (сообщение владельца по скриншоту из мессенджера, 2026-08-10).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AuthFailureHelp } from './AuthFailureHelp';

afterEach(cleanup);

describe('AuthFailureHelp', () => {
  it('называет мессенджер, в котором открыт', () => {
    render(<AuthFailureHelp hostId="max" />);
    expect(screen.getByText(/MAX выдаст свежий пропуск/)).toBeTruthy();
  });

  it('вместо «напиши нам» показывает адрес и ведёт по нему', () => {
    render(<AuthFailureHelp hostId="telegram" />);
    const link = screen.getByRole('link', {
      name: /Написать автору → @kotlarewski/,
    });
    expect(link.getAttribute('href')).toBe('https://t.me/kotlarewski');
    expect(screen.queryByText(/напиши нам/)).toBeNull();
  });

  it('в MAX адрес — почта: телеграмной ссылки там не открыть', () => {
    render(<AuthFailureHelp hostId="max" />);
    const link = screen.getByRole('link', { name: /gregorykot@gmail\.com/ });
    expect(link.getAttribute('href')).toBe('mailto:gregorykot@gmail.com');
    expect(screen.queryByText(/t\.me/)).toBeNull();
  });

  // Веб-хост (PWA с ярлыка) — не мессенджер, «переоткрой и получишь свежий
  // пропуск» там неверно: разлогинило бы обещанием, которое не работает.
  it('в браузере не упоминает ни один мессенджер — совет «войти заново»', () => {
    render(<AuthFailureHelp hostId="web" />);
    expect(screen.getByText(/Попробовать войти заново/)).toBeTruthy();
    expect(screen.queryByText(/Telegram/)).toBeNull();
    expect(screen.queryByText(/MAX/)).toBeNull();
  });

  it('контрольный: в Telegram слово Telegram по-прежнему есть', () => {
    render(<AuthFailureHelp hostId="telegram" />);
    expect(screen.getByText(/Telegram выдаст свежий пропуск/)).toBeTruthy();
  });

  // До входа профиля нет, форма обращения неизвестна — «ты»-форма показала бы
  // «ты» человеку, выбравшему «вы» (правило ты/вы CLAUDE.md).
  it('обходится без обращения на ты и на вы', () => {
    const { container } = render(<AuthFailureHelp hostId="telegram" />);
    expect(container.textContent).not.toMatch(
      /(^|[^А-Яа-яЁё])([Тт]ы|[Тт]ебе|[Тт]ебя|[Вв]ы|[Вв]ам)([^А-Яа-яЁё]|$)/,
    );
    expect(container.textContent).not.toMatch(/Попробуй/);
  });
});
