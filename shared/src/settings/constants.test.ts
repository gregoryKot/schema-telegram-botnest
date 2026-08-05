// Ветвящиеся хелперы окна тишины (правило «Тесты»: логика приезжает с тестом).
import { describe, it, expect } from 'vitest';
import { pad, quietLabel, hourInQuiet } from './constants';

describe('pad', () => {
  it('добивает до двух цифр', () => {
    expect(pad(5)).toBe('05');
    expect(pad(12)).toBe('12');
    expect(pad(0)).toBe('00');
  });
});

describe('quietLabel', () => {
  it('«Выключены» при undefined или start===end', () => {
    expect(quietLabel(undefined, 8)).toBe('Выключены');
    expect(quietLabel(22, undefined)).toBe('Выключены');
    expect(quietLabel(0, 0)).toBe('Выключены');
    expect(quietLabel(8, 8)).toBe('Выключены');
  });
  it('форматирует окно как HH:00 – HH:00', () => {
    expect(quietLabel(22, 8)).toBe('22:00 – 08:00');
    expect(quietLabel(23, 7)).toBe('23:00 – 07:00');
  });
});

describe('hourInQuiet', () => {
  it('false при undefined или пустом окне', () => {
    expect(hourInQuiet(3, undefined, 8)).toBe(false);
    expect(hourInQuiet(3, 22, undefined)).toBe(false);
    expect(hourInQuiet(3, 0, 0)).toBe(false);
  });
  it('обычное окно (start < end)', () => {
    // окно 1:00–5:00
    expect(hourInQuiet(3, 1, 5)).toBe(true);
    expect(hourInQuiet(1, 1, 5)).toBe(true); // включительно слева
    expect(hourInQuiet(5, 1, 5)).toBe(false); // исключительно справа
    expect(hourInQuiet(6, 1, 5)).toBe(false);
  });
  it('окно через полночь (start > end)', () => {
    // окно 22:00–8:00
    expect(hourInQuiet(23, 22, 8)).toBe(true);
    expect(hourInQuiet(3, 22, 8)).toBe(true);
    expect(hourInQuiet(22, 22, 8)).toBe(true); // включительно слева
    expect(hourInQuiet(8, 22, 8)).toBe(false); // исключительно справа
    expect(hourInQuiet(12, 22, 8)).toBe(false);
  });
});
