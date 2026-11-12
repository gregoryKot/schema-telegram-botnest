// QA клиента 2026-11: под письмом стояло «3 слов» — число не склонялось.
import { describe, it, expect } from 'vitest';
import { letterLines, wordsLabel } from './letterWords';

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

// Сцена письма (b18) рисует только написанные строки: пусто — чистый лист, а не выдуманный текст.
describe('letterLines', () => {
  it.each([
    ['', 0],
    ['  \n ', 0],
    ['Здравствуй', 1],
    [Array(7).fill('с').join(' '), 1],
    [Array(8).fill('с').join(' '), 2],
    [Array(100).fill('с').join(' '), 15],
  ])('%j → %i', (text, n) => {
    expect(letterLines(text)).toBe(n);
  });
});
