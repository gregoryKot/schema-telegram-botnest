// @vitest-environment jsdom
// Цена сессии на лендинге совпадает с формой записи и после явного выбора
// валюты (решение владельца Р5): выбор в форме меняет и блок «Формат и цены».
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { setChosenCurrency } from '../../components/booking/priceCurrency';

vi.mock('../../api', () => ({
  api: { getBookingOptions: vi.fn() },
  reportClientError: vi.fn(),
}));
import { api } from '../../api';
vi.mock('../../../../shared/src/booking/clientTimeZone', () => ({ resolveClientTimeZone: vi.fn() }));
import { resolveClientTimeZone } from '../../../../shared/src/booking/clientTimeZone';
import { useSessionPrice } from './useSessionPrice';

const OPTIONS = [{ type: 'SESSION_50', label: 'Сессия', durationMin: 50, price: 4000, prices: { RUB: 4000, ILS: 200, EUR: 65, USD: 70 }, note: '' }];

afterEach(() => act(() => setChosenCurrency(null)));

async function priceFor(tz: string) {
  vi.mocked(resolveClientTimeZone).mockReturnValue(tz);
  vi.mocked(api.getBookingOptions).mockResolvedValue(OPTIONS as never);
  const hook = renderHook(() => useSessionPrice());
  await waitFor(() => expect(api.getBookingOptions).toHaveBeenCalled());
  await act(async () => {});
  return hook;
}

describe('useSessionPrice — явный выбор валюты', () => {
  it('UTC: рубли, после выбора евро — евро без онлайн-оплаты', async () => {
    const { result } = await priceFor('UTC');
    expect(result.current).toMatchObject({ currency: 'RUB', online: true });
    act(() => setChosenCurrency('EUR'));
    expect(result.current).toMatchObject({ currency: 'EUR', amount: 65, online: false });
  });

  it('настоящий пояс: выбор не действует', async () => {
    const { result } = await priceFor('Europe/Moscow');
    act(() => setChosenCurrency('EUR'));
    expect(result.current).toMatchObject({ currency: 'RUB', amount: 4000, online: true });
  });
});
