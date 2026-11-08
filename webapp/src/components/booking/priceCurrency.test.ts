// @vitest-environment jsdom
// Валюта цены на сайте (решение владельца Р5): явный выбор действует только
// при поясе без места и общий на вкладку — форма записи и цена лендинга видят
// один и тот же выбор. Серверная сторона той же функции — resolveBookingPrice.
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { setChosenCurrency, usePriceCurrency } from './priceCurrency';

afterEach(() => act(() => setChosenCurrency(null)));

describe('usePriceCurrency', () => {
  it('без выбора — валюта по поясу, в запрос ничего', () => {
    expect(renderHook(() => usePriceCurrency('UTC')).result.current).toEqual({ currency: 'RUB', explicit: undefined });
    expect(renderHook(() => usePriceCurrency('Asia/Bangkok')).result.current).toEqual({ currency: 'USD', explicit: undefined });
  });

  it('пояс без места + выбор — цена в выбранной валюте, выбор уходит в запрос', () => {
    const { result } = renderHook(() => usePriceCurrency('Etc/UTC'));
    act(() => setChosenCurrency('EUR'));
    expect(result.current).toEqual({ currency: 'EUR', explicit: 'EUR' });
  });

  it.each([
    ['Europe/Moscow', 'RUB'],
    ['Asia/Bangkok', 'USD'],
  ])('настоящий пояс %s — выбор не действует (%s) и в запрос не уходит', (tz, currency) => {
    act(() => setChosenCurrency('EUR'));
    expect(renderHook(() => usePriceCurrency(tz)).result.current).toEqual({ currency, explicit: undefined });
  });

  it('выбор один на вкладку: второй потребитель видит его сразу, сброс возвращает рубли', () => {
    const form = renderHook(() => usePriceCurrency('UTC'));
    const landing = renderHook(() => usePriceCurrency('UTC'));
    act(() => setChosenCurrency('ILS'));
    expect(form.result.current.currency).toBe('ILS');
    expect(landing.result.current.currency).toBe('ILS');
    act(() => setChosenCurrency(null));
    expect(landing.result.current).toEqual({ currency: 'RUB', explicit: undefined });
  });
});
