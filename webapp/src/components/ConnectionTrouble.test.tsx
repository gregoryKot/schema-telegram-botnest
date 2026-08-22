// @vitest-environment jsdom
// ConnectionTrouble — экран «нет связи» вместо редиректа на /login при
// authError==='transient' (диагностика «постоянно нужно логиниться заново»,
// 2026-08-21). Кнопка «Повторить» дёргает refreshToken() из контекста.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConnectionTrouble } from './ConnectionTrouble';
import { useAuth } from '../auth/authContext';

vi.mock('../auth/authContext', () => ({ useAuth: vi.fn() }));
const mockUseAuth = useAuth as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('ConnectionTrouble', () => {
  it('показывает текст «нет связи» и кнопку «Повторить»', () => {
    mockUseAuth.mockReturnValue({ refreshToken: vi.fn() });
    render(<ConnectionTrouble />);
    expect(screen.getByText('Нет связи с сервером')).toBeTruthy();
    expect(screen.getByText('Повторить')).toBeTruthy();
  });

  it('клик по «Повторить» вызывает refreshToken()', () => {
    const refreshToken = vi.fn();
    mockUseAuth.mockReturnValue({ refreshToken });
    render(<ConnectionTrouble />);
    fireEvent.click(screen.getByText('Повторить'));
    expect(refreshToken).toHaveBeenCalledTimes(1);
  });

  it('форма «ты» по умолчанию (нет кэша)', () => {
    mockUseAuth.mockReturnValue({ refreshToken: vi.fn() });
    render(<ConnectionTrouble />);
    expect(screen.getByText('Проверь подключение и попробуй ещё раз')).toBeTruthy();
  });

  it('форма «вы» — если в localStorage закэширован выбор', () => {
    localStorage.setItem('address_form', 'vy');
    mockUseAuth.mockReturnValue({ refreshToken: vi.fn() });
    render(<ConnectionTrouble />);
    expect(screen.getByText('Проверьте подключение и попробуйте ещё раз')).toBeTruthy();
  });
});
