// @vitest-environment jsdom
// Чтение текста без знаков склейки (plainText): тесты экранов сверяют фразу, а не невидимые знаки glue.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { glue } from '../../../shared/src/utils/typo';
import { byPlainText, plain, plainText } from './plainText';

afterEach(cleanup);

describe('plainText', () => {
  it('склеенная фраза читается как исходная: пробел, дефис, диапазон', () => {
    const phrase = 'Кто-то рядом в схема-терапии – через 3–5 дней';
    expect(glue(phrase)).not.toBe(phrase);
    expect(plain(glue(phrase))).toBe(phrase);
  });

  it('обычный текст не меняется (контрольный образец)', () => {
    expect(plain('Телефон 8-800-100-49-94, без склейки')).toBe(
      'Телефон 8-800-100-49-94, без склейки',
    );
    expect(plainText(null)).toBe('');
  });

  it('byPlainText находит сам элемент со склеенной фразой, а не его предка', () => {
    const phrase = 'Через 2–3 разбора видно, что повторяется.';
    render(
      <div data-testid="outer">
        <p data-testid="inner">{glue(phrase)}</p>
      </div>,
    );
    expect(
      screen.getByText(byPlainText(phrase)).getAttribute('data-testid'),
    ).toBe('inner');
    expect(screen.queryByText(phrase)).toBeNull(); // без матчера склейка мешает найти фразу
  });
});
