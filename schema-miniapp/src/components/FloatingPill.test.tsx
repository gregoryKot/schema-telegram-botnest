// @vitest-environment jsdom
// FloatingPill — плавающая кнопка «плюс»: теперь только открывает
// PlusMenuSheet (собственное меню тестируется отдельно, PlusMenuSheet.test.tsx).
// Здесь — что кнопка открывает/закрывает меню и шлёт plus_open.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../utils/addressForm';
import { FloatingPill } from './FloatingPill';

vi.mock('../api', () => ({ api: { trackEvent: vi.fn() } }));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

function renderWithForm(ui: ReactElement, form: AddressForm = 'ty') {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});
afterEach(cleanup);

describe('FloatingPill — открытие меню', () => {
  it('изначально меню закрыто', () => {
    renderWithForm(<FloatingPill onAction={vi.fn()} />);
    expect(screen.queryByText('Быстрое действие')).toBeNull();
  });

  it('клик по кнопке шлёт plus_open и открывает меню', () => {
    renderWithForm(<FloatingPill onAction={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Быстрое действие'));
    expect(mockApi.trackEvent).toHaveBeenCalledWith('plus_open');
    expect(screen.getByText('Записать момент')).toBeTruthy();
  });

  it('выбор пункта меню зовёт onAction и закрывает меню', () => {
    const onAction = vi.fn();
    renderWithForm(<FloatingPill onAction={onAction} />);
    fireEvent.click(screen.getByLabelText('Быстрое действие'));
    fireEvent.click(screen.getByText('Схема'));
    expect(onAction).toHaveBeenCalledWith('diary_schema');
    expect(screen.queryByText('Записать момент')).toBeNull();
  });
});
