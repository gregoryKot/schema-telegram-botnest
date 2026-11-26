// Аудит 2026-11, U3: приглашение клиенту было одной ссылкой t.me — без
// Telegram клиент не подключался, кода в тексте не было, а обещание
// «подключится трекер потребностей» скрывало, что терапевт видит больше.
import { describe, it, expect } from 'vitest';
import { therapistInviteShareText } from './shareTexts';
import { THERAPIST_SEES_BY_DEFAULT } from '../therapy/therapistLinkCopy';

const SITE = 'https://schemehappens.ru/today?startapp=therapy_7F3A9C21B04E';
const TG = 'https://t.me/bot/diary?startapp=therapy_7F3A9C21B04E';
const invite = { code: '7F3A9C21B04E', url: SITE, tgUrl: TG };

describe('therapistInviteShareText', () => {
  it('сайт первой ссылкой, код для ввода вручную, Telegram последней строкой', () => {
    const text = therapistInviteShareText(invite);
    expect(text).toContain(`Подключиться на сайте: ${SITE}`);
    expect(text).toContain(
      'Или ввести код 7F3A9C21B04E в приложении: Настройки → «Мой терапевт».',
    );
    expect(text.indexOf(SITE)).toBeLessThan(text.indexOf(TG));
    expect(text.split('\n').at(-1)).toBe(`В Telegram: ${TG}`);
  });

  it('бот не настроен — строки про Telegram нет, сайт и код на месте', () => {
    const text = therapistInviteShareText({ ...invite, tgUrl: null });
    expect(text).not.toContain('Telegram');
    expect(text).toContain(SITE);
    expect(text).toContain('7F3A9C21B04E');
  });

  it('честно говорит, что видит терапевт, — тот же список, что на экране согласия', () => {
    const text = therapistInviteShareText(invite);
    expect(text).toContain(
      `Терапевт видит трекер потребностей и задания, а по умолчанию ещё ${THERAPIST_SEES_BY_DEFAULT}`,
    );
    expect(text).not.toMatch(/подключится трекер/);
  });

  it('безличный: ни «ты», ни «вы» (форма терапевта в приложении не говорит, как он обращается к клиенту)', () => {
    const text = therapistInviteShareText(invite);
    expect(text).not.toMatch(
      /(^|[^а-яё])(ты|тебя|тебе|твой|вы|вас|вам|ваш|введи|введите)([^а-яё]|$)/i,
    );
  });
});
