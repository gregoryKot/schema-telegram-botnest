// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AddressFormContext } from '../../utils/addressForm';
import { TodayHeader, formatGreetingDate } from './TodayHeader';

afterEach(cleanup);

function renderHeader(form: 'ty' | 'vy', onOpenSettings = vi.fn()) {
  render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <TodayHeader streak={5} firstName="Аня" onOpenSettings={onOpenSettings} />
    </AddressFormContext.Provider>,
  );
  return onOpenSettings;
}

describe('formatGreetingDate', () => {
  it('«воскресенье, 18 октября» — строчными, как в мини-аппе', () => {
    expect(formatGreetingDate(new Date(2026, 9, 18, 12))).toBe('воскресенье, 18 октября');
  });
});

describe('TodayHeader', () => {
  it('строка под приветствием — «твой темп» на «ты» и «ваш темп» на «вы»', () => {
    renderHeader('ty');
    expect(screen.getByText(/· твой темп$/)).toBeTruthy();
    cleanup();
    renderHeader('vy');
    expect(screen.getByText(/· ваш темп$/)).toBeTruthy();
  });

  it('шестерёнка открывает настройки', () => {
    const open = renderHeader('ty');
    fireEvent.click(screen.getByRole('button', { name: 'Настройки' }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('серия попадает в eyebrow десктопа', () => {
    renderHeader('ty');
    expect(screen.getByText(/5-й день подряд/)).toBeTruthy();
  });
});
