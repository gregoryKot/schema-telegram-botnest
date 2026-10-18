import { describe, it, expect } from 'vitest';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { groupMineByDomain } from './mineGroups';

const [a, b] = SCHEMA_DOMAINS[0].schemas;

describe('groupMineByDomain', () => {
  const d1 = SCHEMA_DOMAINS[1].schemas[0];
  it('группирует по доменам в порядке данных, внутри — порядок профиля', () => {
    const g = groupMineByDomain(SCHEMA_DOMAINS, [d1.id, b.id, a.id]);
    expect(g.map(x => x.id)).toEqual([SCHEMA_DOMAINS[0].id, SCHEMA_DOMAINS[1].id]);
    expect(g[0].schemaIds).toEqual([b.id, a.id]);
    expect(g[0].hue).toBe(28);
  });
  it('пустые домены, неизвестные id и повторы отбрасываются', () => {
    expect(groupMineByDomain(SCHEMA_DOMAINS, [])).toEqual([]);
    const g = groupMineByDomain(SCHEMA_DOMAINS, ['nope', a.id, a.id]);
    expect(g).toHaveLength(1);
    expect(g[0].schemaIds).toEqual([a.id]);
  });
});
