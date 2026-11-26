import { describe, it, expect } from 'vitest';
import { buildTherapyBridgeTexts } from './therapyBridgeTexts';

const ty = (a: string) => a;
const vy = (_a: string, b: string) => b;

describe('buildTherapyBridgeTexts', () => {
  it('обе формы обращения отдают непустые строки', () => {
    for (const tr of [ty as (a: string, b: string) => string, vy]) {
      const t = buildTherapyBridgeTexts(tr);
      for (const [key, value] of Object.entries(t)) {
        expect(typeof value, key).toBe('string');
        expect(value.length, key).toBeGreaterThan(0);
      }
    }
  });

  it('«вы»-вариант без форм «ты»', () => {
    const t = buildTherapyBridgeTexts((_a, b) => b);
    const all = Object.values(t).join(' ');
    expect(all).not.toMatch(
      /(^|[^а-яё])(ты|тебе|тебя|твой|твоя|твоё|твои|тобой)([^а-яё]|$)/i,
    );
  });

  it('тексты нейтральны по роду и не называют цену', () => {
    const all = Object.values(buildTherapyBridgeTexts((a) => a)).join(' ');
    expect(all).not.toMatch(/\(а\)|₽|руб/);
  });
});
