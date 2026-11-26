import { describe, it, expect } from 'vitest';
import {
  portraitTexts,
  portraitTotalsText,
  portraitDeltaText,
  NEED_EXPLAINER_TEXT,
} from './portraitTexts';
import { NEED_ORDER } from '../needs/types';
import type { Portrait } from './portraitData';

const ty = (a: string) => a;
const vy = (_a: string, b: string) => b;

describe('portraitTexts', () => {
  it('обе формы обращения различаются и не смешиваются', () => {
    const a = portraitTexts(ty);
    const b = portraitTexts(vy);
    for (const k of ['hint', 'emptyCard', 'emptySheet'] as const) {
      expect(a[k]).not.toBe(b[k]);
      expect(b[k]).not.toMatch(
        /(^|[^а-яё])(тво|теб)|узнаёшь|пройди(?![а-яё])/i,
      );
    }
  });
});

describe('portraitTotalsText', () => {
  const p = (s: number, m: number) =>
    ({ totalSchemas: s, totalModes: m }) as Portrait;
  it('склоняет схемы и режимы', () => {
    expect(portraitTotalsText(p(1, 1))).toBe('1 схема · 1 режим');
    expect(portraitTotalsText(p(3, 2))).toBe('3 схемы · 2 режима');
    expect(portraitTotalsText(p(5, 0))).toBe('5 схем · 0 режимов');
  });
});

describe('portraitDeltaText', () => {
  it('прячет null и ноль', () => {
    expect(portraitDeltaText(null)).toBeNull();
    expect(portraitDeltaText(0)).toBeNull();
  });
  it('минус без знака плюс, рост с плюсом', () => {
    expect(portraitDeltaText(-2)).toBe('-2 с прошлого теста');
    expect(portraitDeltaText(3)).toBe('+3 с прошлого теста');
  });
});

describe('NEED_EXPLAINER_TEXT', () => {
  it('есть объяснение для каждой из пяти потребностей', () => {
    for (const id of NEED_ORDER) expect(NEED_EXPLAINER_TEXT[id]).toBeTruthy();
  });
});
