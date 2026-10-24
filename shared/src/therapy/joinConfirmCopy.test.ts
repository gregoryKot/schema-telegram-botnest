import { describe, it, expect } from 'vitest';
import { joinConfirmExplain, joinConfirmTitle } from './joinConfirmCopy';

const trFor = (form: 'ty' | 'vy') => (ty: string, vy: string) =>
  form === 'ty' ? ty : vy;

describe('joinConfirmCopy', () => {
  it('заголовок по виду приглашения', () => {
    expect(joinConfirmTitle(true)).toBe('Присоединиться к паре?');
    expect(joinConfirmTitle(false)).toBe('Открыть доступ терапевту?');
  });
  it('пара называет и индекс, и неделю (честный объём)', () => {
    for (const f of ['ty', 'vy'] as const) {
      expect(joinConfirmExplain(true, trFor(f))).toMatch(
        /индекс дня.*последнюю неделю/,
      );
    }
  });
  it('форма обращения разводится в обоих видах', () => {
    expect(joinConfirmExplain(true, trFor('vy'))).not.toMatch(
      /\bтвой|\bтебя\b/,
    );
    expect(joinConfirmExplain(false, trFor('ty'))).toMatch(/твоим записям/);
    expect(joinConfirmExplain(false, trFor('vy'))).toMatch(/вашим записям/);
  });
});
