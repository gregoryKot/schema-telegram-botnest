// Тест расчёта высоты карточки-таймлайна «Мой путь» (canvas в jsdom нет —
// проверяем только чистую формулу).
import { describe, it, expect } from 'vitest';
import { journeyCardHeight } from '../../../../shared/src/share/cards/journeyCard';

describe('journeyCardHeight', () => {
  it('пустая лента — компактная плашка «пусто», без рядов', () => {
    const empty = journeyCardHeight([]);
    const oneRow = journeyCardHeight([{}]);
    expect(empty).toBeLessThan(oneRow);
  });

  it('растёт линейно с числом строк', () => {
    const two = journeyCardHeight([{}, {}]);
    const four = journeyCardHeight([{}, {}, {}, {}]);
    expect(four - two).toBe(2 * 46);
  });

  it('подпись добавляет высоту шапки', () => {
    expect(journeyCardHeight([{}], 'подзаголовок')).toBeGreaterThan(
      journeyCardHeight([{}]),
    );
  });
});
