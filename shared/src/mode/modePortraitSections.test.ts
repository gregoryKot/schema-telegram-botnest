// Тесты buildModePortraitSections: 8 блоков, порядок, тексты = поля карточки.
// Фикстура ModeCard — см. комментарий в modeIntroQuestions.test.ts (тест не
// зависит от готовности реального shared/src/mode/modeCards/).
import { describe, it, expect } from 'vitest';
import { buildModePortraitSections } from './modePortraitSections';
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
  'body',
  'voice',
  'behavior',
  'origin',
  'cost',
  'need',
  'healthyAdult',
];

describe('buildModePortraitSections', () => {
  it('возвращает ровно 8 блоков в заданном порядке', () => {
    const sections = buildModePortraitSections(CARD);
    expect(sections).toHaveLength(8);
    expect(sections.map((s) => s.key)).toEqual(EXPECTED_ORDER);
  });

  it('about в список не входит', () => {
    const sections = buildModePortraitSections(CARD);
    expect(sections.some((s) => s.key === 'about')).toBe(false);
  });

  it('текст каждого блока — соответствующее поле карточки', () => {
    const sections = buildModePortraitSections(CARD);
    const byKey = Object.fromEntries(sections.map((s) => [s.key, s.text]));
    expect(byKey.triggers).toBe(CARD.triggers);
    expect(byKey.body).toBe(CARD.body);
    expect(byKey.voice).toBe(CARD.voice);
    expect(byKey.behavior).toBe(CARD.behavior);
    expect(byKey.origin).toBe(CARD.origin);
    expect(byKey.cost).toBe(CARD.cost);
    expect(byKey.need).toBe(CARD.need);
    expect(byKey.healthyAdult).toBe(CARD.healthyAdult);
  });

  it('у каждого блока непустая подпись и текст', () => {
    for (const s of buildModePortraitSections(CARD)) {
      expect(s.label.trim().length).toBeGreaterThan(0);
      expect(s.text.trim().length).toBeGreaterThan(0);
    }
  });
});
