// Безопасное место уходит на сервер одной строкой: пять полей, заполненных до
// края, обязаны пройти `@MaxLength(SAFE_PLACE_TEXT_MAX)` в `SafePlaceDto`,
// иначе экран снова упрётся в 400 на тексте, который поле пропустило.
import { describe, it, expect } from 'vitest';
import { SAFE_PLACE_TEXT_MAX } from '../../../../shared/src/limits/textLimits';
import {
  SENSES,
  SAFE_PLACE_FIELD_MAX,
  buildSafePlaceDescription,
} from './safePlaceText';

describe('safePlaceText', () => {
  it('все пять полей на пределе — описание влезает в предел сервера', () => {
    const full = 'я'.repeat(SAFE_PLACE_FIELD_MAX);
    const senses = Object.fromEntries(SENSES.map((s) => [s.k, full]));
    const desc = buildSafePlaceDescription(full, senses);
    expect(desc.length).toBeLessThanOrEqual(SAFE_PLACE_TEXT_MAX);
  });

  it('предел поля — круглое число, а не остаток деления', () => {
    expect(SAFE_PLACE_FIELD_MAX % 100).toBe(0);
    expect(SAFE_PLACE_FIELD_MAX).toBeGreaterThanOrEqual(1000);
  });

  it('в описание идут впечатление и только заполненные органы чувств с подписями', () => {
    expect(
      buildSafePlaceDescription('веранда', {
        see: 'сосны',
        hear: '  ',
        feel: '',
        smell: 'хвоя',
      }),
    ).toBe('веранда\nЧто я вижу: сосны\nЧто я обоняю: хвоя');
  });
});
