import { describe, it, expect } from 'vitest';
import { filterWorkGroups } from './pickerFilter';

const groups = [
  { title: 'Техники', options: [{ kind: 'technique' as const, refId: 'a', name: 'Рескриптинг в воображении' }, { kind: 'technique' as const, refId: 'b', name: 'Стул' }] },
  { title: 'Своё', options: [{ kind: 'custom' as const, name: 'Своё' }] },
];

describe('filterWorkGroups', () => {
  it('пустой запрос — список без изменений', () => {
    expect(filterWorkGroups(groups, '  ')).toBe(groups);
  });
  it('ищет по подстроке без учёта регистра и ё, пустые группы убирает', () => {
    const r = filterWorkGroups(groups, 'ВООБРАЖЕНИИ');
    expect(r).toHaveLength(1);
    expect(r[0].options.map((o) => o.refId)).toEqual(['a']);
    expect(filterWorkGroups(groups, 'нет такого')).toEqual([]);
  });
});
