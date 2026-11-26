// Раскладка бенто «Главного»: число колонок по ширине и листы по колонкам без пустоты под коротким листом.
import { describe, it, expect } from 'vitest';
import type { BriefSection } from '../../../../../shared/src/therapy/conceptBrief/conceptBrief';
import { briefColumnCount, briefWeight, packBrief } from './briefColumns';

const sec = (p: Partial<BriefSection>): BriefSection =>
  ({ id: 'goals', label: 'x', kind: 'text', items: [], modes: [], text: '', empty: false, ...p }) as BriefSection;

describe('briefColumnCount', () => {
  it('телефон и контейнер до замера — одна, планшет — две, компьютер — три', () => {
    expect(briefColumnCount(0)).toBe(1);
    expect(briefColumnCount(358)).toBe(1);
    expect(briefColumnCount(728)).toBe(2);
    expect(briefColumnCount(984)).toBe(3);
    expect(briefColumnCount(1240)).toBe(3);
  });
});

describe('briefWeight', () => {
  it('пустой лист легче заполненного, длинный текст тяжелее короткого, режимы растут с числом режимов', () => {
    const short = sec({ text: 'Коротко' });
    const long = sec({ text: 'Очень длинная строка про цели терапии. '.repeat(6) });
    expect(briefWeight(sec({ empty: true }))).toBeLessThan(briefWeight(long));
    expect(briefWeight(short)).toBeLessThan(briefWeight(long));
    const mode = { modeId: 'm', name: 'Карающий Критик', lane: 'Критик', manifest: '«Ты сама виновата»', schemas: ['Неуспешность'] };
    const one = sec({ kind: 'modes', modes: [mode] });
    const many = sec({ kind: 'modes', modes: [mode, mode, mode, mode] });
    expect(briefWeight(one)).toBeLessThan(briefWeight(many));
    expect(briefWeight(sec({ kind: 'chips', items: [{ text: 'Неуспешность' }] }))).toBeGreaterThan(3);
  });
});

describe('packBrief', () => {
  const w = (n: number) => n;
  it('одна колонка — порядок как есть', () => {
    expect(packBrief([2, 9, 3], 1, w)).toEqual([[2, 9, 3]]);
  });
  it('следующий лист идёт в самую короткую колонку: под коротким листом не остаётся пустоты во всю высоту соседа', () => {
    // схемы 2, режимы 9, потребности 3, цикл 3, цели 2, проблемы 2
    expect(packBrief([2, 9, 3, 3, 2, 2], 3, w)).toEqual([[2, 3, 2], [9], [3, 2]]);
  });
  it('листов меньше, чем колонок, — пустых колонок нет; пустой список — одна пустая колонка', () => {
    expect(packBrief([5, 1], 3, w)).toEqual([[5], [1]]);
    expect(packBrief([], 3, w)).toEqual([[]]);
  });
});
