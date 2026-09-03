// @vitest-environment jsdom
// ConnectionTrouble — общий экран «сервер не отвечает» (правило №3, перенос
// из webapp/src/components/ConnectionTrouble.tsx, инцидент 31.08.2026).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConnectionTrouble } from './ConnectionTrouble';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('ConnectionTrouble', () => {
  it('показывает текст «сервер не отвечает» и кнопку «Повторить»', () => {
    render(<ConnectionTrouble onRetry={vi.fn()} />);
    expect(screen.getByText('Сервер не отвечает')).toBeTruthy();
    expect(screen.getByText('Повторить')).toBeTruthy();
  });

  it('клик по «Повторить» вызывает onRetry()', () => {
    const onRetry = vi.fn();
    render(<ConnectionTrouble onRetry={onRetry} />);
    fireEvent.click(screen.getByText('Повторить'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('retrying=true — кнопка отключена и меняет подпись', () => {
    const onRetry = vi.fn();
    render(<ConnectionTrouble onRetry={onRetry} retrying />);
    const btn = screen.getByText('Проверяем…');
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('форма «ты» по умолчанию (нет кэша)', () => {
    render(<ConnectionTrouble onRetry={vi.fn()} />);
    expect(
      screen.getByText(
        'Это на нашей стороне — вход не слетел. Попробуй ещё раз через минуту.',
      ),
    ).toBeTruthy();
  });

  it('форма «вы» — если в localStorage закэширован выбор', () => {
    localStorage.setItem('address_form', 'vy');
    render(<ConnectionTrouble onRetry={vi.fn()} />);
    expect(
      screen.getByText(
        'Это на нашей стороне — вход не слетел. Попробуйте ещё раз через минуту.',
      ),
    ).toBeTruthy();
  });
});
