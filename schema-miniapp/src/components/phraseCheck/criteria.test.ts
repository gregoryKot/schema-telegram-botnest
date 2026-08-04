// Контент примет: id совпадают с бэкендом (он валидирует присланное и
// считает разбивку в /stats), у каждой приметы есть оба варианта ответа и
// пояснение, тексты безличные — форма обращения живёт в самом листе.
import { describe, it, expect } from 'vitest';
import { PHRASE_CRITERIA, PHRASE_MARK_IDS } from './criteria';

describe('приметы разбора фразы', () => {
  it('id и порядок совпадают с реестром бэкенда', () => {
    // Двойник — src/bot/phrase-check.constants.ts (PHRASE_MARK_IDS).
    // Правка одной стороны обязана уронить тест другой.
    expect(PHRASE_MARK_IDS).toEqual(['person', 'fear', 'absolute', 'shame']);
  });

  it('у каждой приметы есть вопрос, оба варианта и пояснение', () => {
    for (const c of PHRASE_CRITERIA) {
      expect(c.question.trim()).not.toBe('');
      expect(c.care.trim()).not.toBe('');
      expect(c.critic.trim()).not.toBe('');
      expect(c.why.trim()).not.toBe('');
      expect(c.emoji.trim()).not.toBe('');
    }
  });

  it('варианты «забота» и «критик» не совпадают между собой', () => {
    for (const c of PHRASE_CRITERIA) expect(c.care).not.toBe(c.critic);
  });

  it('тексты безличные — без «ты» и «вы» (вилка живёт в листе)', () => {
    const address = /(^|[^а-яё])(ты|вы|тебя|вас|тво[йяеё]|ваш)([^а-яё]|$)/i;
    for (const c of PHRASE_CRITERIA) {
      expect(`${c.question} ${c.care} ${c.critic} ${c.why}`).not.toMatch(
        address,
      );
    }
  });
});
