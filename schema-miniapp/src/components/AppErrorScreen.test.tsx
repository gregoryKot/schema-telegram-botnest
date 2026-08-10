// @vitest-environment jsdom
// Экран ошибки зависит от хоста: в мессенджере лечение — «закрыть и открыть
// заново» (там выдают свежую подпись), в браузере закрыть вкладку изнутри
// нельзя, и единственный рабочий путь — перезагрузка страницы.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AppErrorScreen } from './AppErrorScreen';
import { reportClientError } from '../api';

vi.mock('../api', () => ({ reportClientError: vi.fn() }));

const close = vi.fn();

function inTelegram() {
  (window as never as { Telegram: unknown }).Telegram = {
    WebApp: { initData: 'hash=abc', close },
  };
}

beforeEach(() => {
  cleanup();
  close.mockClear();
  vi.mocked(reportClientError).mockClear();
  delete (globalThis as { WebApp?: unknown }).WebApp;
  delete (window as never as { Telegram?: unknown }).Telegram;
});

describe('AppErrorScreen', () => {
  it('в мессенджере при истёкшей сессии предлагает закрыть приложение', () => {
    inTelegram();
    render(<AppErrorScreen error="Сессия Telegram истекла (401)" />);
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть приложение' }));
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('в браузере мёртвой кнопки «Закрыть» нет — предлагает обновить страницу', () => {
    render(<AppErrorScreen error="401" />);
    expect(
      screen.queryByRole('button', { name: 'Закрыть приложение' }),
    ).toBeNull();
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeTruthy();
  });

  // Экран показывается и в MAX. Раньше он звал мессенджер Telegram'ом и
  // утверждал «Сессия истекла», хотя на первом открытии сессии и не было.
  it('в MAX называет MAX, а не Telegram', () => {
    (globalThis as { WebApp?: unknown }).WebApp = {
      initData: 'user=%7B%22id%22%3A1%7D&hash=abc',
    };
    render(<AppErrorScreen error="401" />);
    expect(screen.getByText(/MAX выдаст свежий пропуск/)).toBeTruthy();
    expect(screen.queryByText(/Telegram/)).toBeNull();
    delete (globalThis as { WebApp?: unknown }).WebApp;
  });

  // Причину «не удалось войти» иначе видно только в аудит-логе. Форма подписи
  // на самом экране превращает отладку в один скриншот — но значений в ней
  // быть не должно: там id и имя человека.
  it('при неудаче входа показывает форму подписи и ни одного значения', () => {
    (globalThis as { WebApp?: unknown }).WebApp = {
      initData:
        'user=%7B%22id%22%3A42%2C%22first_name%22%3A%22%D0%98%D1%80%D0%B0%22%7D' +
        '&auth_date=1700000000&hash=abc',
    };
    render(<AppErrorScreen error="401" />);

    expect(screen.getByText(/поля: auth_date,hash,user/)).toBeTruthy();
    expect(screen.getByText(/кодировка внутри: снята/)).toBeTruthy();
    expect(screen.queryByText(/Ира/)).toBeNull();
    delete (globalThis as { WebApp?: unknown }).WebApp;
  });

  // «Напиши нам» не говорило, кому и куда: человек упирался в тупик, который
  // обещал помощь и не давал адреса (скриншот владельца, 2026-08-10).
  it('при неудаче входа называет адрес, а не «нам»', () => {
    inTelegram();
    render(<AppErrorScreen error="401" />);
    const link = screen.getByRole('link', { name: /@kotlarewski/ });
    expect(link.getAttribute('href')).toBe('https://t.me/kotlarewski');
    expect(screen.queryByText(/напиши нам/)).toBeNull();
  });

  it('при сетевом сбое адреса поддержки нет — там дело не в нас', () => {
    inTelegram();
    render(<AppErrorScreen error="Failed to fetch" />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('при сетевом сбое форму подписи не показывает — она там ни при чём', () => {
    inTelegram();
    render(<AppErrorScreen error="Failed to fetch" />);
    expect(screen.queryByText(/поля:/)).toBeNull();
  });

  it('заголовок не утверждает, что сессия истекла — мы этого не знаем', () => {
    inTelegram();
    render(<AppErrorScreen error="401" />);
    expect(screen.getByText('Не удалось войти')).toBeTruthy();
    expect(screen.queryByText(/истекла/)).toBeNull();
  });

  it('сетевой сбой — «Повторить» в любом хосте', () => {
    inTelegram();
    render(<AppErrorScreen error="Failed to fetch" />);
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeTruthy();
    expect(screen.getByText('Не удалось загрузить')).toBeTruthy();
  });
});

// Инцидент 2026-08-08: вход не работал у всех пользователей Telegram пять
// суток. Экран у них был, а у нас — тишина: телеметрию слал только
// ErrorBoundary, то есть КРАШ. Обработанная авария оказалась невидимее
// необработанной, поэтому теперь экран сам о себе сообщает.
describe('отчёт о сломанном входе', () => {
  it('неудача входа уезжает в телеметрию — с площадкой и признаком пустой подписи', () => {
    (globalThis as { WebApp?: unknown }).WebApp = { initData: '' };
    render(<AppErrorScreen error="Error: 401" />);

    expect(reportClientError).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(reportClientError).mock.calls[0][0];
    expect(payload.section).toBe('auth');
    expect(payload.message).toContain('хост=max');
    expect(payload.message).toContain('подпись ПУСТАЯ');
  });

  it('сетевой сбой (не 401) телеметрию входа не будит', () => {
    render(<AppErrorScreen error="TypeError: Failed to fetch" />);
    expect(reportClientError).not.toHaveBeenCalled();
  });

  it('один отчёт на показ экрана, а не на каждый перерендер', () => {
    inTelegram();
    const { rerender } = render(<AppErrorScreen error="401" />);
    rerender(<AppErrorScreen error="401" />);
    rerender(<AppErrorScreen error="401" />);
    expect(reportClientError).toHaveBeenCalledTimes(1);
  });
});
