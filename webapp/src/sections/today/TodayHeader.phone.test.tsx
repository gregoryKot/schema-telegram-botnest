// @vitest-environment jsdom
// Шапка «Сегодня» на телефоне: «Привет, Аня» как в мини-аппе, без времени суток.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
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

const onCustomize = vi.fn();

describe('TodayHeader на телефоне', () => {
  it('шестерёнка открывает «Настроить экран» (не общие настройки), второй кнопки нет', () => {
    render(
      <AddressFormContext.Provider value={{ form: 'ty', setForm: vi.fn() }}>
        <TodayHeader streak={3} firstName="Аня" onCustomize={onCustomize} />
      </AddressFormContext.Provider>,
    );
    const gears = screen.getAllByRole('button', { name: 'Настроить экран' });
    expect(gears).toHaveLength(1);
    fireEvent.click(gears[0]);
    expect(onCustomize).toHaveBeenCalledTimes(1);
  });

  it('заголовок — «Привет, имя»', () => {
    render(
      <AddressFormContext.Provider value={{ form: 'vy', setForm: vi.fn() }}>
        <TodayHeader streak={3} firstName="Аня" onCustomize={onCustomize} />
      </AddressFormContext.Provider>,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Привет, Аня');
  });
});
