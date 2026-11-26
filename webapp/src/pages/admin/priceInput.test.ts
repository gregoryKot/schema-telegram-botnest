import { describe, it, expect } from 'vitest';
import { parsePriceInput, PRICE_MAX } from './priceInput';

describe('parsePriceInput', () => {
  it('пустое поле и пробелы — не цена (раньше уходили на сервер нулём)', () => {
    expect(parsePriceInput('', 1)).toBeNull();
    expect(parsePriceInput('   ', 1)).toBeNull();
    expect(parsePriceInput('', 0)).toBeNull();
  });

  it('нечисловое и бесконечное — null', () => {
    expect(parsePriceInput('abc', 1)).toBeNull();
    expect(parsePriceInput('12abc', 1)).toBeNull();
    expect(parsePriceInput('Infinity', 1)).toBeNull();
  });

  it('обычное число и пробелы вокруг', () => {
    expect(parsePriceInput('3500', 1)).toBe(3500);
    expect(parsePriceInput(' 3500 ', 1)).toBe(3500);
  });

  it('дробь округляется, как раньше в onChange', () => {
    expect(parsePriceInput('3500.4', 1)).toBe(3500);
    expect(parsePriceInput('3500.5', 1)).toBe(3501);
  });

  it('нижняя граница включительно: 0 при min 1 — null, 1 — число, 0 при min 0 — 0', () => {
    expect(parsePriceInput('0', 1)).toBeNull();
    expect(parsePriceInput('-5', 1)).toBeNull();
    expect(parsePriceInput('1', 1)).toBe(1);
    expect(parsePriceInput('0.4', 1)).toBeNull();
    expect(parsePriceInput('0', 0)).toBe(0);
  });

  it('верхняя граница включительно: потолок проходит, потолок+1 и 1e22 — null', () => {
    expect(parsePriceInput(String(PRICE_MAX), 1)).toBe(PRICE_MAX);
    expect(parsePriceInput(String(PRICE_MAX + 1), 1)).toBeNull();
    expect(parsePriceInput('1e22', 1)).toBeNull();
    expect(parsePriceInput('50', 1, 40)).toBeNull();
  });
});
