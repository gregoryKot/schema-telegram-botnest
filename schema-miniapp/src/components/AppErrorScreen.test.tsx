// @vitest-environment jsdom
// Экран ошибки зависит от хоста: в мессенджере лечение — «закрыть и открыть
// заново» (там выдают свежую подпись), в браузере закрыть вкладку изнутри
// нельзя, и единственный рабочий путь — перезагрузка страницы.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AppErrorScreen } from './AppErrorScreen';

const close = vi.fn();

function inTelegram() {
  (window as never as { Telegram: unknown }).Telegram = {
    WebApp: { initData: 'hash=abc', close },
  };
}

beforeEach(() => {
  cleanup();
  close.mockClear();
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
