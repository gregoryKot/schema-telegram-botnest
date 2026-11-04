// QA клиента 2026-11: под письмом стояло «3 слов» — число не склонялось.
import { describe, it, expect } from 'vitest';
import { wordsLabel } from './letterWords';

describe('wordsLabel', () => {
  it.each([
    ['', '0 слов'],
    ['раз', '1 слово'],
    ['раз два три', '3 слова'],
    ['раз  два\nтри четыре пять', '5 слов'],
    [Array(11).fill('с').join(' '), '11 слов'],
    [Array(21).fill('с').join(' '), '21 слово'],
  ])('%j → %s', (text, label) => {
    expect(wordsLabel(text)).toBe(label);
  });
});
