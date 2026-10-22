import { describe, it, expect } from 'vitest';
import {
  PATTERN_EMPTY_ENTRIES,
  PATTERN_SHARE_TITLE,
  patternShareText,
} from './patternShare';

describe('patternShare', () => {
  it('текст шаринга склоняет существительное по виду паттерна', () => {
    expect(patternShareText('schema', 'Покинутость', 'https://t.me/b')).toBe(
      'Моя карточка схемы «Покинутость».\n\nhttps://t.me/b',
    );
    expect(patternShareText('mode', 'Критик', 'https://t.me/b')).toContain(
      'карточка режима «Критик»',
    );
  });

  it('заголовок и пустое состояние есть для обоих видов', () => {
    for (const k of ['schema', 'mode'] as const) {
      expect(PATTERN_SHARE_TITLE[k]).toMatch(/^Карточка /);
      expect(PATTERN_EMPTY_ENTRIES[k]).toMatch(/пока нет\.$/);
    }
  });
});
