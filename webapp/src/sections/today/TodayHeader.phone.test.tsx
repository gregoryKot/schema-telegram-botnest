// @vitest-environment jsdom
// Шапка «Сегодня» на телефоне: «Привет, Аня» как в мини-аппе, без времени суток.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AddressFormContext } from '../../utils/addressForm';
import { TodayHeader } from './TodayHeader';
import { phoneGreeting } from './helpers';

vi.mock('../../components/useIsMobile', () => ({ useIsMobile: () => true }));

afterEach(cleanup);

describe('phoneGreeting', () => {
  it('с именем и без', () => {
    expect(phoneGreeting('Аня')).toBe('Привет, Аня');
    expect(phoneGreeting('')).toBe('Добро пожаловать');
  });
});

describe('TodayHeader на телефоне', () => {
  it('заголовок — «Привет, имя»', () => {
    render(
      <AddressFormContext.Provider value={{ form: 'vy', setForm: vi.fn() }}>
        <TodayHeader streak={3} firstName="Аня" onOpenSettings={vi.fn()} />
      </AddressFormContext.Provider>,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Привет, Аня');
  });
});
