// Чужая раскладка: латиница, набранная на русской клавиатуре, переводится посимвольно.
import { describe, it, expect } from 'vitest';
import { hasLatin, toRussianLayout } from './keyboardLayout';

describe('toRussianLayout', () => {
  it('буквы и знаки-буквы QWERTY → ЙЦУКЕН, заглавные остаются заглавными', () => {
    expect(toRussianLayout('ht;bv')).toBe('режим');
    expect(toRussianLayout('Rhbnbr')).toBe('Критик');
    expect(toRussianLayout("[]'`,.")).toBe('хъэёбю');
  });

  it('русский текст, цифры и пробелы не меняются', () => {
    expect(toRussianLayout('план 2 gkfy')).toBe('план 2 план');
  });
});

describe('hasLatin', () => {
  it('латинская буква есть — true; кириллица и знаки — false', () => {
    expect(hasLatin('ht;bv')).toBe(true);
    expect(hasLatin('режим; 12')).toBe(false);
  });
});
