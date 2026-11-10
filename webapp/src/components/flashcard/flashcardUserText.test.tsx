// @vitest-environment jsdom
// Текст человека в «Истории карточек» и просмотре карточки (ревью g4 r5): «Выйти на улицу на 10 / минут» висело на
// числе, «Это старый / страх.» оставляло слово одно в строке. Шаг и рефлексия — через glueSpaces (одна склейка текста
// пользователя, shared/src/utils/typo.ts, g3 r5): только пробелы — после короткого слова и перед тире неразрывные;
// дефисы, тире и цифры — его (без U+2011 и U+2060). Одинокое последнее слово без коротких слов — text-wrap: pretty в CSS.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { FlashcardHistoryList, FlashcardView } from './FlashcardHistory';
import { plain } from '../../test-support/plainText';
import { readCss } from '../../styles/cssRules.test-helpers';
import type { FlashcardEntry } from '../schemaFlashcard/types';

afterEach(cleanup);

const ACTION = 'Выйти на улицу на 10 минут — кто-то рядом, 4-4-6';
const card: FlashcardEntry = { id: 1, date: '9 нояб.', mode: 'vulnerable_child', reflection: 'Это старый страх.', needId: 'attachment', action: ACTION };
const glued = (el: Element | null) => el?.textContent ?? '';

describe('«История карточек»: шаг и рефлексия — текст человека через glueSpaces', () => {
  it('строка списка: «на 10 минут» не рвётся, дефисы и тире пользователя те же', () => {
    const { container } = render(<FlashcardHistoryList cards={[card]} modes={[]} needs={[]} onBack={vi.fn()} onOpen={vi.fn()} />);
    const text = glued(container.querySelector('.sk-fc-hist-action'));
    expect(text).toContain('на\u00a010\u00a0минут');
    expect(text).not.toMatch(/[\u2011\u2060]/);
    expect(plain(text)).toBe(ACTION);
  });

  it('просмотр карточки: рефлексия «Это старый страх.» и шаг склеены только пробелами', () => {
    const { container } = render(<FlashcardView card={card} modes={[]} needs={[]} onBack={vi.fn()} />);
    const values = [...container.querySelectorAll('.sk-fc-value--text')].map(glued);
    expect(values).toHaveLength(2);
    expect(values[0]).toBe('Это старый страх.');
    expect(values[1]).toContain('на\u00a010\u00a0минут');
    expect(values[1]).not.toMatch(/[\u2011\u2060]/);
    expect(plain(values[1])).toBe(ACTION);
  });

  it('строки текста человека переносятся без одинокого последнего слова (text-wrap: pretty)', () => {
    const css = readCss('flashcard.css');
    for (const cls of ['.sk-fc-value--text', '.sk-fc-hist-action']) {
      const rule = css.find((r) => r.selectors.includes(cls));
      expect(rule?.body, cls).toMatch(/text-wrap:\s*pretty/);
    }
  });
});
