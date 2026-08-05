// Контент примет: id совпадают с бэкендом (он валидирует присланное и
// считает разбивку в /stats), у каждой приметы есть оба варианта ответа и
// пояснение, тексты безличные — форма обращения живёт в самом листе.
import { describe, it, expect } from 'vitest';
import { PHRASE_CRITERIA, PHRASE_MARK_IDS } from './criteria';

describe('приметы разбора фразы', () => {
  it('таблица самокритики перенесена целиком — все девять строк', () => {
    // Свелось к четырём приметам в первой версии; таблица содержит девять,
    // и каждая строка — отдельный вопрос к фразе.
    expect(PHRASE_CRITERIA).toHaveLength(9);
  });

  it('id и порядок совпадают с реестром бэкенда', () => {
    // Двойник — src/bot/phrase-check.constants.ts (PHRASE_MARK_IDS).
    // Правка одной стороны обязана уронить тест другой.
    expect(PHRASE_MARK_IDS).toEqual([
      'goal',
      'notok',
      'person',
      'label',
      'fear',
      'never',
      'mistake',
      'absolute',
      'worth',
    ]);
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
    // Цитаты в «…» — термины таблицы (позиция «ты не ОК»), они дословные и
    // под правило обращения не попадают, как и в спеке мини-тестов.
    const stripQuotes = (s: string) => s.replace(/«[^»]*»/g, '');
    const address = /(^|[^а-яё])(ты|вы|тебя|вас|тво[йяеё]|ваш)([^а-яё]|$)/i;
    for (const c of PHRASE_CRITERIA) {
      expect(
        stripQuotes(`${c.question} ${c.care} ${c.critic} ${c.why}`),
      ).not.toMatch(address);
    }
  });
});
