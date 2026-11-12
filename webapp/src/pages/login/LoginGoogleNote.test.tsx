// @vitest-environment jsdom
// Вход через Google убран (2026-11): подсказка ведёт прежних пользователей на
// вход по той же почте. Строка с обращением — обе формы, без рода читателя.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AddressFormContext } from '../../utils/addressForm';
import { LoginGoogleNote } from './LoginGoogleNote';

function renderNote(form: 'ty' | 'vy') {
  render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <LoginGoogleNote />
    </AddressFormContext.Provider>,
  );
  return screen.getByTestId('login-google-note').textContent ?? '';
}

describe('LoginGoogleNote', () => {
  it('«ты»: зовёт войти по той же почте и обещает прежний аккаунт', () => {
    const text = renderNote('ty');
    expect(text).toContain('Раньше вход был через Google?');
    expect(text).toContain('Войди по email с той же почтой');
    expect(text).toContain('Аккаунт и записи на месте');
    expect(text).not.toMatch(/Войдите|входили/);
  });

  it('«вы»: та же подсказка во множественном числе', () => {
    const text = renderNote('vy');
    expect(text).toContain('Войдите по email с той же почтой');
    expect(text).not.toMatch(/Войди |входил\b/);
  });
});
