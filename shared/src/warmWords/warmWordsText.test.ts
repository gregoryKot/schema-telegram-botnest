// QA клиента 2026-11, М7: подписи «Тёплых слов» — одни на обе площадки и
// знают все три источника.
import { describe, it, expect } from 'vitest';
import {
  WARM_SOURCE_LABEL,
  buildWarmWordsTexts,
  warmWordTitle,
} from './warmWordsText';

describe('warmWordTitle', () => {
  it('фраза — «Переписанная фраза», даже если режим вдруг передан', () => {
    expect(warmWordTitle({ source: 'phrase' }, undefined)).toBe(
      'Переписанная фраза',
    );
    expect(warmWordTitle({ source: 'phrase' }, 'Карающий Критик')).toBe(
      'Переписанная фраза',
    );
  });

  it('дневник и карточка — имя режима, режим вне реестра — «Режим»', () => {
    expect(warmWordTitle({ source: 'card' }, 'Уязвимый Ребёнок')).toBe(
      'Уязвимый Ребёнок',
    );
    expect(warmWordTitle({ source: 'diary' }, undefined)).toBe('Режим');
  });
});

describe('WARM_SOURCE_LABEL', () => {
  it('у каждого источника своя подпись', () => {
    expect(WARM_SOURCE_LABEL).toEqual({
      diary: 'дневник',
      card: 'карточка режима',
      phrase: 'разбор фразы',
    });
  });
});

describe('buildWarmWordsTexts', () => {
  it('ты/вы: каждая строка в своей форме', () => {
    const ty = buildWarmWordsTexts((t) => t);
    const vy = buildWarmWordsTexts((_t, v) => v);
    expect(ty.lede).toMatch(/твои слова/);
    expect(vy.lede).toMatch(/ваши слова/);
    expect(ty.empty).toMatch(/сохранишь/);
    expect(vy.empty).toMatch(/сохраните/);
    expect(vy.failed).toMatch(/проверьте связь/);
  });
});
