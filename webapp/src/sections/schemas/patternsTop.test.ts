// @vitest-environment node
// Верх «Паттернов» (ревью g5 r3): герой над первой группой «Моих схем / режимов» близкой бумаги — на белом листе;
// белая строка или плитка теста и «Выраженные схемы» между ними уже разделяют листы.
import { describe, it, expect } from 'vitest';
import { firstGroupHue, patternsTop } from './patternsTop';
import { patternsHero } from './patternsHero';
import type { ScreenBlockId } from '../../../../shared/src/screens/screenBlocks';

const week = (id: string) => patternsHero({ ready: true, top: { kind: 'schema', id, days: 2, windowDays: 7 }, hasSchemas: true, hasModes: true, hasEntries: true });
const blocks = (hidden: ScreenBlockId[] = [], orderedIds: ScreenBlockId[] = ['heroes', 'ysq_status']) => ({ isHidden: (id: ScreenBlockId) => hidden.includes(id), orderedIds });
const d = { loading: false, ysqSchemaIds: [] as string[], ysqScores: {}, myModeIds: [] as string[] };
const base = { mobile: true, hero: week('abandonment'), ysqEntry: 'white' as const, blocks: blocks(), d, schemaIds: ['abandonment'], modeTop: null };

describe('firstGroupHue — лист под героем', () => {
  it('первая группа по порядку данных, а не по порядку выбора; групп нет — null', () => {
    expect(firstGroupHue('schema', ['abandonment'])).toBe(28);
    expect(firstGroupHue('mode', ['demanding_critic', 'vulnerable_child'])).toBe(28);
    expect(firstGroupHue('mode', ['demanding_critic'])).toBe(310);
    expect(firstGroupHue('schema', [])).toBeNull();
  });
});

describe('patternsTop — белый лист героя', () => {
  it('«Покинутость» над группой «Нарушение связи» той же бумаги — белый, если строка теста скрыта', () => {
    expect(patternsTop({ ...base, blocks: blocks(['ysq_status']) }).heroWhite).toBe(true);
    expect(patternsTop({ ...base, mobile: false, blocks: blocks(['ysq_status']) }).heroWhite).toBe(true);
  });

  it('между ними строка/плитка теста или «Выраженные схемы» — герой на бумаге', () => {
    expect(patternsTop(base).heroWhite).toBe(false);
    const expressed = { ...d, ysqSchemaIds: ['abandonment'], ysqScores: { abandonment: { avg: 5, pct5plus: 40 } } };
    expect(patternsTop({ ...base, blocks: blocks(['ysq_status']), d: expressed }).heroWhite).toBe(false);
    expect(patternsTop({ ...base, blocks: blocks(['ysq_status']), d: { ...d, loading: true } }).heroWhite).toBe(false);
  });

  it('строка теста выше героя («Настроить экран») — не между ними: белый; на компьютере порядка нет', () => {
    const testFirst = blocks([], ['ysq_status', 'heroes']);
    expect(patternsTop({ ...base, blocks: testFirst }).heroWhite).toBe(true);
    expect(patternsTop({ ...base, mobile: false, blocks: testFirst }).heroWhite).toBe(false);
  });

  it('далёкая бумага первой группы, силуэт героя, групп нет — бумага', () => {
    const hidden = blocks(['ysq_status']);
    expect(patternsTop({ ...base, blocks: hidden, hero: week('emotional_inhibition') }).heroWhite).toBe(false);
    expect(patternsTop({ ...base, blocks: hidden, hero: { kind: 'loading' } }).heroWhite).toBe(false);
    expect(patternsTop({ ...base, blocks: hidden, schemaIds: [] }).heroWhite).toBe(false);
  });

  it('«Чаще всего включается»: детский режим над «Детскими режимами» — белый, Критик над ними — бумага', () => {
    const modes = (id: string, myModeIds: string[]) => patternsTop({ ...base, d: { ...d, myModeIds }, modeTop: { id, days: 2, windowDays: 7 } }).modesHeroWhite;
    expect(modes('vulnerable_child', ['vulnerable_child', 'demanding_critic'])).toBe(true);
    expect(modes('demanding_critic', ['vulnerable_child', 'demanding_critic'])).toBe(false);
    expect(modes('demanding_critic', ['demanding_critic'])).toBe(true);
    expect(patternsTop({ ...base, d: { ...d, myModeIds: ['vulnerable_child'] } }).modesHeroWhite).toBe(false);
  });

  it('пара «Выраженные + Тест»: выраженные — по ранжированным схемам, а не по сырым id', () => {
    expect(patternsTop({ ...base, d: { ...d, ysqSchemaIds: ['нет-такой'] } }).pair).toEqual({ expressed: false, tile: true });
    expect(patternsTop({ ...base, blocks: blocks(['ysq_status']) }).pair).toEqual({ expressed: false, tile: false });
  });
});
