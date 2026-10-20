// @vitest-environment jsdom
// Цены сессии по валютам (решение владельца 2026-10-20): четыре строки —
// ₽, ₪, €, $; каждая сохраняется отдельно с своей валютой.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { PricesManager } from './PricesManager';

vi.mock('../../api', () => ({
  api: { adminGetPrices: vi.fn(), adminSetPrice: vi.fn() },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const FULL = [
  { type: 'INTRO_15', label: 'Знакомство', durationMin: 15, price: 0, prices: { RUB: 0, ILS: 0, EUR: 0, USD: 0 }, note: '' },
  { type: 'SESSION_50', label: 'Сессия', durationMin: 50, price: 4000, prices: { RUB: 4000, ILS: 200, EUR: 65, USD: 70 }, note: '' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.adminGetPrices.mockResolvedValue(FULL);
  mockApi.adminSetPrice.mockResolvedValue({ ok: true });
});
afterEach(() => cleanup());

/** Строка цены по подписи аудитории («Израиль», «остальной мир»…). */
function row(audience: RegExp): HTMLElement {
  return screen.getByText(audience).parentElement as HTMLElement;
}

describe('PricesManager — цена сессии по валютам', () => {
  it('четыре строки для сессии со значениями и знаками валют; знакомства среди них нет', async () => {
    render(<PricesManager adminKey="k" />);
    await screen.findByDisplayValue('4000');
    expect(screen.getAllByRole('button', { name: 'Сохранить' })).toHaveLength(4);
    expect(within(row(/Россия/)).getByDisplayValue('4000')).toBeTruthy();
    expect(within(row(/Россия/)).getByText('₽')).toBeTruthy();
    expect(within(row(/Израиль/)).getByDisplayValue('200')).toBeTruthy();
    expect(within(row(/Израиль/)).getByText('₪')).toBeTruthy();
    expect(within(row(/Европа/)).getByDisplayValue('65')).toBeTruthy();
    expect(within(row(/Европа/)).getByText('€')).toBeTruthy();
    expect(within(row(/мир/)).getByDisplayValue('70')).toBeTruthy();
    expect(within(row(/мир/)).getByText('$')).toBeTruthy();
    expect(screen.queryByText(/Знакомство · \d+ мин/)).toBeNull();
  });

  it.each([
    [/Россия/, '4500', 'RUB'],
    [/Израиль/, '250', 'ILS'],
    [/Европа/, '70', 'EUR'],
    [/мир/, '80', 'USD'],
  ] as const)('строка %s: сохранение уходит с валютой %s', async (audience, typed, currency) => {
    render(<PricesManager adminKey="k" />);
    await screen.findByDisplayValue('4000');
    const r = row(audience);
    fireEvent.change(within(r).getByRole('spinbutton'), { target: { value: typed } });
    fireEvent.click(within(r).getByRole('button', { name: 'Сохранить' }));
    await screen.findByText('Цена сохранена ✓');
    expect(mockApi.adminSetPrice).toHaveBeenCalledTimes(1);
    expect(mockApi.adminSetPrice).toHaveBeenCalledWith('k', 'SESSION_50', Number(typed), currency);
  });

  it('read-after-write: после сохранения список перечитывается с сервера', async () => {
    mockApi.adminGetPrices.mockResolvedValueOnce(FULL).mockResolvedValue([
      FULL[0],
      { ...FULL[1], prices: { RUB: 4000, ILS: 250, EUR: 65, USD: 70 } },
    ]);
    render(<PricesManager adminKey="k" />);
    await screen.findByDisplayValue('200');
    fireEvent.change(within(row(/Израиль/)).getByRole('spinbutton'), { target: { value: '250' } });
    fireEvent.click(within(row(/Израиль/)).getByRole('button', { name: 'Сохранить' }));
    await screen.findByText('Цена сохранена ✓');
    expect(mockApi.adminGetPrices).toHaveBeenCalledTimes(2);
    expect(within(row(/Израиль/)).getByDisplayValue('250')).toBeTruthy();
  });

  it('пустое поле не сохраняется, ошибка называет знак валюты строки', async () => {
    render(<PricesManager adminKey="k" />);
    await screen.findByDisplayValue('4000');
    const r = row(/Израиль/);
    fireEvent.change(within(r).getByRole('spinbutton'), { target: { value: '' } });
    expect((within(r).getByRole('button', { name: 'Сохранить' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(r).getByText(/Сумма — от 1 до .* ₪/)).toBeTruthy();
    expect(mockApi.adminSetPrice).not.toHaveBeenCalled();
  });

  it('старый ответ без prices: рублёвая строка заполнена из price, остальные пустые и не сохраняются', async () => {
    mockApi.adminGetPrices.mockResolvedValue([
      { type: 'SESSION_50', label: 'Сессия', durationMin: 50, price: 3000, note: '' },
    ]);
    render(<PricesManager adminKey="k" />);
    await screen.findByDisplayValue('3000');
    expect((within(row(/Израиль/)).getByRole('button', { name: 'Сохранить' }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(row(/Россия/)).getByRole('button', { name: 'Сохранить' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
