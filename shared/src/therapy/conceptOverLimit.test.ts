import { describe, it, expect } from 'vitest';
import {
  conceptOverLimitField,
  conceptOverLimitText,
} from './conceptOverLimit';
import { CONCEPT_FIELD_TEXT_MAX } from '../limits/textLimits';

const tr = (ty: string, vy: string) => `${ty} | ${vy}`;

describe('conceptOverLimitField', () => {
  it('все поля в пределе (и пустые) — null', () => {
    expect(conceptOverLimitField({})).toBeNull();
    expect(
      conceptOverLimitField({
        goals: null,
        triggers: 'x'.repeat(CONCEPT_FIELD_TEXT_MAX),
      }),
    ).toBeNull();
  });

  it('поле длиннее предела — его подпись', () => {
    expect(
      conceptOverLimitField({
        earlyExperience: 'коротко',
        goals: 'x'.repeat(CONCEPT_FIELD_TEXT_MAX + 1),
      }),
    ).toBe('Цели схема-терапии');
  });
});

describe('conceptOverLimitText', () => {
  it('называет поле и предел, в обеих формах обращения', () => {
    const text = conceptOverLimitText('Цели схема-терапии', tr);
    expect(text).toContain('«Цели схема-терапии»');
    expect(text).toContain(CONCEPT_FIELD_TEXT_MAX.toLocaleString('ru-RU'));
    expect(text).toContain('сократи его');
    expect(text).toContain('сократите его');
  });
});
