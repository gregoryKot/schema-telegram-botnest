import { describe, it, expect } from 'vitest';
import {
  dayWord,
  freqHint,
  weekTopText,
  schemaIntro,
  modeIntro,
  diaryIntro,
  INTRO_MODE_ID,
} from './weekPatternText';
import { getModeById } from '../schemaTherapy/schemaTherapyData';

const ty = (a: string) => a;
const vy = (_a: string, b: string) => b;

describe('weekPatternText', () => {
  it('dayWord склоняет', () => {
    expect([1, 2, 5, 11, 21].map(dayWord)).toEqual([
      'день',
      'дня',
      'дней',
      'дней',
      'день',
    ]);
  });

  it('подсказка называет сущность и честно говорит «не оценка»', () => {
    expect(freqHint('schema')).toMatch(/со схемой.*не оценка/);
    expect(freqHint('mode')).toMatch(/с режимом.*не оценка/);
  });

  it('weekTopText: схема, режим, неизвестный id', () => {
    const top = { id: 'abandonment', days: 3, windowDays: 7 };
    expect(weekTopText('schema', top)).toMatchObject({
      label: 'Чаще всего звучит',
    });
    expect(weekTopText('schema', top)?.sub).toContain('3 из 7 дней');
    expect(weekTopText('mode', { ...top, id: INTRO_MODE_ID })?.label).toBe(
      'Чаще всего включается',
    );
    expect(weekTopText('schema', { ...top, id: 'нет такой' })).toBeNull();
  });

  it('режим-вход существует в справочнике', () => {
    expect(getModeById(INTRO_MODE_ID)).toBeTruthy();
  });

  it('вводные различаются по ты/вы и не оставляют «ты» во «вы»', () => {
    for (const f of [schemaIntro, modeIntro]) {
      expect(f(ty).sub).not.toBe(f(vy).sub);
      expect(f(vy).sub).not.toMatch(/\b(увидишь|начни)\b/i);
    }
    expect(diaryIntro(ty).sub).not.toBe(diaryIntro(vy).sub);
  });
});
