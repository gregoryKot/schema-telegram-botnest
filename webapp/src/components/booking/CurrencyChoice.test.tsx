// @vitest-environment jsdom
// Выбор валюты в форме записи (решение владельца Р5): только при поясе без
// места, валюты кроме рублей, повторное нажатие возвращает рубли, тап-цель
// не ниже 44px, тексты в обеих формах обращения.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, renderHook } from '@testing-library/react';
import { CurrencyChoice } from './CurrencyChoice';
import { setChosenCurrency, useChosenCurrency } from './priceCurrency';

vi.mock('../../lib/metrika', () => ({ trackGoal: vi.fn() }));
import { trackGoal } from '../../lib/metrika';

const TY = (ty: string) => ty;

afterEach(() => {
  cleanup();
  act(() => setChosenCurrency(null));
  vi.clearAllMocks();
});

describe('CurrencyChoice', () => {
  it.each(['Europe/Moscow', 'Asia/Jerusalem', 'Europe/Berlin', 'America/New_York', 'Etc/GMT-3'])(
    'настоящий пояс %s — выбора нет',
    (tz) => {
      const { container } = render(<CurrencyChoice tz={tz} labelStyle={{}} />);
      expect(container.textContent).toBe('');
    },
  );

  it.each(['UTC', 'Etc/UTC', 'GMT'])('пояс %s — три валюты без рублей, пояснение на «вы»', (tz) => {
    render(<CurrencyChoice tz={tz} labelStyle={{}} />);
    expect(screen.getByRole('group', { name: 'Я не в России — показать цену' })).toBeTruthy();
    const names = screen.getAllByRole('button').map((b) => b.textContent);
    expect(names).toEqual(['в шекелях ₪', 'в евро €', 'в долларах $']);
    expect(screen.getByText(/Если вы не в России, выберите валюту\./)).toBeTruthy();
    for (const b of screen.getAllByRole('button')) expect(b.style.minHeight).toBe('44px');
  });

  it('нажатие выбирает валюту и шлёт цель в Метрику; повторное — возвращает рубли', () => {
    const chosen = renderHook(() => useChosenCurrency());
    render(<CurrencyChoice tz="UTC" labelStyle={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'в евро €' }));
    expect(chosen.result.current).toBe('EUR');
    expect(screen.getByRole('button', { name: 'в евро €' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/об оплате договоримся после записи/)).toBeTruthy();
    expect(trackGoal).toHaveBeenCalledWith('booking_currency', { currency: 'EUR' });

    fireEvent.click(screen.getByRole('button', { name: 'в евро €' }));
    expect(chosen.result.current).toBeNull();
    expect(trackGoal).toHaveBeenCalledTimes(1);
  });

  it('форма «ты» — свои тексты, без «вы»', () => {
    render(<CurrencyChoice tz="UTC" labelStyle={{}} tr={TY} />);
    expect(screen.getByText(/Если ты не в России, выбери валюту\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'в долларах $' }));
    expect(screen.getByText(/нажми на валюту ещё раз/)).toBeTruthy();
  });
});
