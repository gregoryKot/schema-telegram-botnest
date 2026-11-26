// @vitest-environment node
// Герой результата YSQ и первая группа потребности под ним (ревью g5 r3): одна бумага подряд — герой белый.
import { describe, it, expect } from 'vitest';
import { resultHeroWhite } from './resultHeroLook';

const view = (...needIds: string[]) => ({ activeByDomain: needIds.map((needId) => ({ needId, label: needId, schemas: [] })) });

describe('resultHeroWhite — белый лист героя результата', () => {
  it('первая группа «Привязанность» (бумага теста) — герой белый', () => {
    expect(resultHeroWhite(view('attachment', 'expression'))).toBe(true);
  });
  it('первая группа далёкой бумаги — герой на бумаге, вторая группа не в счёт', () => {
    expect(resultHeroWhite(view('expression', 'attachment'))).toBe(false);
    expect(resultHeroWhite(view('limits'))).toBe(false);
  });
  it('выраженных схем нет — групп под героем нет, бумага', () => {
    expect(resultHeroWhite(view())).toBe(false);
  });
});
