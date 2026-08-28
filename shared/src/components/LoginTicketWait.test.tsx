// @vitest-environment jsdom
// Экран ожидания обязан показать КОД (сверка — единственное, что отделяет
// честный вход от присланной ссылки) и не путать отказ с истечением.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { LoginTicketWait } from './LoginTicketWait';

afterEach(cleanup);

const waiting = {
  kind: 'waiting' as const,
  provider: 'telegram' as const,
  code: 'K7M2QX94',
  url: 'https://t.me/Bot?start=login_K7M2QX94',
};

describe('ожидание подтверждения', () => {
  it('показывает код в том же виде, что и бот', () => {
    render(<LoginTicketWait state={waiting} onRetry={() => {}} />);
    expect(screen.getByText('K7M2-QX94')).toBeTruthy();
  });

  it('оставляет дорогу назад — ссылку можно открыть заново', () => {
    render(<LoginTicketWait state={waiting} onRetry={() => {}} />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe(waiting.url);
    // Открываем СНАРУЖИ: приложение обязано остаться живым, иначе забирать
    // сессию будет некому.
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('называет площадку, а не «провайдера»', () => {
    render(
      <LoginTicketWait
        state={{ ...waiting, provider: 'vk' }}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByText(/ВКонтакте/)).toBeTruthy();
  });

  it('ничего не рисует, пока вход не начат', () => {
    const { container } = render(
      <LoginTicketWait state={{ kind: 'idle' }} onRetry={() => {}} />,
    );
    expect(container.textContent).toBe('');
  });
});

describe('исходы', () => {
  it('отказ говорит, что доступ никто не получил', () => {
    render(<LoginTicketWait state={{ kind: 'denied' }} onRetry={() => {}} />);
    expect(screen.getByText(/Доступ никто не получил/)).toBeTruthy();
  });

  it('истечение и отказ — разные тексты, а не один на двоих', () => {
    const { container: a } = render(
      <LoginTicketWait state={{ kind: 'denied' }} onRetry={() => {}} />,
    );
    const denied = a.textContent;
    cleanup();
    const { container: b } = render(
      <LoginTicketWait state={{ kind: 'expired' }} onRetry={() => {}} />,
    );
    expect(b.textContent).not.toBe(denied);
    expect(b.textContent).toMatch(/Время кода вышло/);
  });

  it('сорвавшийся старт тоже предлагает повтор, а не оставляет в тупике', () => {
    const onRetry = vi.fn();
    render(<LoginTicketWait state={{ kind: 'failed' }} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('после отказа повтор тоже доступен', () => {
    const onRetry = vi.fn();
    render(<LoginTicketWait state={{ kind: 'denied' }} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onRetry).toHaveBeenCalled();
  });
});
