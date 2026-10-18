import { describe, it, expect } from 'vitest';
import {
  indexTone,
  partnerContextText,
  weekBars,
  PARTNER_EMPTY_TEXT,
  PARTNER_BAR_MAX_PX,
} from './partnerCard';
import { pairTexts } from './pairTexts';

describe('indexTone', () => {
  it('пороги 4 и 7: границы относятся к верхней группе', () => {
    expect(indexTone(0)).toBe('low');
    expect(indexTone(3.9)).toBe('low');
    expect(indexTone(4)).toBe('mid');
    expect(indexTone(6.9)).toBe('mid');
    expect(indexTone(7)).toBe('good');
    expect(indexTone(10)).toBe('good');
  });
});

describe('partnerContextText', () => {
  it('день не заполнен — безличная фраза без мужского рода', () => {
    const t = partnerContextText('Оля', false, 0);
    expect(t).toContain('Оля');
    expect(t).toContain('покажется здесь');
    expect(t).not.toContain(PARTNER_EMPTY_TEXT); // плашка выше уже это сказала
    expect(t).not.toMatch(/заполнил/);
  });
  it('низкий / средний / высокий индекс — разные фразы с именем', () => {
    const low = partnerContextText('Оля', true, 2);
    const mid = partnerContextText('Оля', true, 5);
    const good = partnerContextText('Оля', true, 8);
    expect(low).toMatch(/непростой день/);
    expect(mid).toMatch(/в норме/);
    expect(good).toMatch(/хороший день/);
    expect(new Set([low, mid, good]).size).toBe(3);
  });
  it('пороги: 4 уже «в норме», 7 уже «хороший»', () => {
    expect(partnerContextText('А', true, 4)).toMatch(/в норме/);
    expect(partnerContextText('А', true, 7)).toMatch(/хороший/);
  });
});

describe('weekBars', () => {
  it('пустой и неопределённый вход — пустой список', () => {
    expect(weekBars([])).toEqual([]);
    expect(weekBars(undefined)).toEqual([]);
  });
  it('порядок разворачивается: сегодняшний день (первый в данных) — последний', () => {
    const bars = weekBars([9, 2]);
    expect(bars[0].tone).toBe('low');
    expect(bars[1].tone).toBe('good');
    expect(bars[1].today).toBe(true);
    expect(bars[0].today).toBe(false);
  });
  it('null — тонкий пустой столбик без тона, подписи «сег» нет', () => {
    const bars = weekBars([null, 5]);
    expect(bars[1]).toEqual({ px: 3, tone: 'none', today: false });
    expect(bars[0].today).toBe(false);
  });
  it('высота пропорциональна индексу и не выходит за максимум', () => {
    expect(weekBars([10])[0].px).toBe(PARTNER_BAR_MAX_PX);
    expect(weekBars([5])[0].px).toBe(12);
    expect(weekBars([99])[0].px).toBe(PARTNER_BAR_MAX_PX);
  });
});

describe('pairTexts', () => {
  it('ты и вы дают разные тексты', () => {
    const ty = pairTexts((a) => a);
    const vy = pairTexts((_a, b) => b);
    expect(ty.inviteText).not.toBe(vy.inviteText);
    expect(ty.copyLabel).not.toBe(vy.copyLabel);
  });
});
