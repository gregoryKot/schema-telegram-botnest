// Тесты buildModeIntroQuestions: 7 вопросов, паритет с картой полей
// ModeCard, фолбэк без карточки, form-agnostic формулировки (правило ты/вы).
// Карточка — фикстура-заглушка того же shape, что и реальный ModeCard из
// shared/src/mode/modeCards/ (агент А, контракт mode-intro-card) — тест не
// зависит от того, готов ли уже реальный модуль.
import { describe, it, expect } from 'vitest';
import { buildModeIntroQuestions } from './modeIntroQuestions';
import type { ModeCard } from './modeCards';

const CARD: ModeCard = {
  about: 'Крохотный и настоящий: пугается, что его снова оставят одного.',
  triggers: 'Когда никто не отвечает на сообщения весь день',
  body: 'Ком в горле, тяжесть в груди, хочется свернуться',
  voice: '«Меня опять бросят», «я никому не нужен»',
  behavior: 'Замирает, звонит по кругу, ищет подтверждения',
  origin: 'Когда-то рядом правда никого не было — и так выжил',
  cost: 'Пугает партнёра частыми проверками «ты меня не бросишь?»',
  need: 'Надёжного присутствия рядом',
  healthyAdult: 'Я здесь и никуда не денусь прямо сейчас — можно выдохнуть',
};

const EXPECTED_ORDER = [
  'triggers',
  'feelings',
  'thoughts',
  'behavior',
  'needs',
  'origins',
  'healthyView',
];

describe('buildModeIntroQuestions', () => {
  it('возвращает ровно 7 вопросов в заданном порядке', () => {
    const qs = buildModeIntroQuestions(CARD);
    expect(qs).toHaveLength(7);
    expect(qs.map((q) => q.key)).toEqual(EXPECTED_ORDER);
  });

  it('плейсхолдеры берутся из соответствующих полей карточки', () => {
    const qs = buildModeIntroQuestions(CARD);
    const byKey = Object.fromEntries(qs.map((q) => [q.key, q.placeholder]));
    expect(byKey.triggers).toBe(CARD.triggers);
    expect(byKey.feelings).toBe(CARD.body);
    expect(byKey.thoughts).toBe(CARD.voice);
    expect(byKey.behavior).toBe(CARD.behavior);
    expect(byKey.needs).toBe(CARD.need);
    expect(byKey.origins).toBe(CARD.origin);
    expect(byKey.healthyView).toBe(CARD.healthyAdult);
  });

  it('без карточки — общий плейсхолдер-фолбэк (не пусто, не выдумка про юзера)', () => {
    const qs = buildModeIntroQuestions(undefined);
    expect(qs).toHaveLength(7);
    for (const q of qs) {
      expect(q.placeholder.trim().length).toBeGreaterThan(0);
    }
  });

  it('только origins помечен как optional', () => {
    const qs = buildModeIntroQuestions(CARD);
    for (const q of qs) {
      if (q.key === 'origins') expect(q.optional).toBe(true);
      else expect(q.optional).toBeFalsy();
    }
  });

  it('формулировки form-agnostic — нет жёстких «ты»-форм (правило ты/вы)', () => {
    const TY_RE =
      /(?<![А-Яа-яЁёA-Za-z])([Тт]ы|[Тт]ебя|[Тт]ебе|[Тт]обой|[Тт]во(?:й|я|ё|е|и|их|им|ей|ю))(?![А-Яа-яЁё])/;
    for (const q of [...buildModeIntroQuestions(CARD), ...buildModeIntroQuestions()]) {
      expect(q.label).not.toMatch(TY_RE);
      expect(q.hint).not.toMatch(TY_RE);
    }
  });
});
