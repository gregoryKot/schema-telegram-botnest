import { describe, it, expect } from 'vitest';
import { SCHEMA_DOMAINS, MODE_GROUPS } from '../../schemaTherapyData';
import { groupMineByDomain, groupMineByModeGroup } from './mineGroups';

const [a, b] = SCHEMA_DOMAINS[0].schemas;

describe('groupMineByDomain', () => {
  const d1 = SCHEMA_DOMAINS[1].schemas[0];
  it('группирует по доменам в порядке данных, внутри — порядок профиля', () => {
    const g = groupMineByDomain(SCHEMA_DOMAINS, [d1.id, b.id, a.id]);
    expect(g.map(x => x.id)).toEqual([SCHEMA_DOMAINS[0].id, SCHEMA_DOMAINS[1].id]);
    expect(g[0].ids).toEqual([b.id, a.id]);
    expect(g[0].hue).toBe(28);
  });
  it('пустые домены, неизвестные id и повторы отбрасываются', () => {
    expect(groupMineByDomain(SCHEMA_DOMAINS, [])).toEqual([]);
    const g = groupMineByDomain(SCHEMA_DOMAINS, ['nope', a.id, a.id]);
    expect(g).toHaveLength(1);
    expect(g[0].ids).toEqual([a.id]);
  });
});

describe('groupMineByModeGroup', () => {
  const child = MODE_GROUPS.find(g => g.id === 'child')!;
  const critic = MODE_GROUPS.find(g => g.id === 'critic')!;
  const [c1, c2] = child.items;
  const k1 = critic.items[0];
  it('группы режимов — в порядке данных, внутри — порядок профиля, цвет группы', () => {
    const g = groupMineByModeGroup(MODE_GROUPS, [k1.id, c2.id, c1.id]);
    expect(g.map(x => x.id)).toEqual([child.id, critic.id]);
    expect(g[0].title).toBe(child.group);
    expect(g[0].ids).toEqual([c2.id, c1.id]);
    expect(g[0].hue).toBe(28);
    expect(g[1].hue).toBe(310);
  });
  it('нет режимов или чужие id — групп нет, повторы схлопываются', () => {
    expect(groupMineByModeGroup(MODE_GROUPS, [])).toEqual([]);
    expect(groupMineByModeGroup(MODE_GROUPS, ['nope'])).toEqual([]);
    expect(groupMineByModeGroup(MODE_GROUPS, [c1.id, c1.id])[0].ids).toEqual([c1.id]);
  });
  it('копинговые группы остаются отдельными, у них общий тон', () => {
    const ids = MODE_GROUPS.filter(g => g.id.startsWith('coping_')).map(g => g.items[0].id);
    const g = groupMineByModeGroup(MODE_GROUPS, ids);
    expect(g).toHaveLength(ids.length);
    expect(new Set(g.map(x => x.hue)).size).toBe(1);
  });
});
