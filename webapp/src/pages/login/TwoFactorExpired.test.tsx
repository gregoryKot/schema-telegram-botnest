// @vitest-environment jsdom
// Протухший вызов 2FA: исход на весь экран (Cup на соломе), объявляется сразу (role=alert), выход — на вход.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TwoFactorExpired } from './TwoFactorExpired';

afterEach(cleanup);

describe('TwoFactorExpired', () => {
  it('role=alert, знак Cup, «Войти заново» ведёт на /login', () => {
    render(
      <MemoryRouter initialEntries={['/auth/2fa']}>
        <Routes>
          <Route path="/auth/2fa" element={<TwoFactorExpired />} />
          <Route path="/login" element={<div>ЭКРАН ВХОДА</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert').textContent).toMatch(/Вход устарел/);
    expect(document.querySelector('.pa-outcome-card')?.getAttribute('data-sign')).toBe('cup');
    fireEvent.click(screen.getByRole('button', { name: 'Войти заново' }));
    expect(screen.getByText('ЭКРАН ВХОДА')).toBeTruthy();
  });
});
