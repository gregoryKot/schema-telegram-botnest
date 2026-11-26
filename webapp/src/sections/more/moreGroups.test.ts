import { describe, it, expect } from 'vitest';
import { groupMoreRows, tasksRowSub } from './moreGroups';

const row = (id: string, phoneOnly = false) => ({ id, phoneOnly });
const CLIENT = ['why', 'tasks', 'schemas', 'selfmap', 'practice', 'journey', 'talk', 'test', 'settings', 'profile'];

describe('groupMoreRows', () => {
  it('клиент: четыре группы по смыслу, «Зачем это всё» — внизу', () => {
    const g = groupMoreRows(CLIENT.map(id => row(id)));
    expect(g.map(x => [x.title, x.rows.map(r => r.id)])).toEqual([
      ['Что складывается', ['selfmap', 'schemas', 'journey', 'test']],
      ['Делать', ['practice', 'tasks']],
      ['Терапевт', ['talk']],
      ['Настройки и помощь', ['settings', 'profile', 'why']],
    ]);
  });

  it('пустая группа выпадает, неизвестная строка не теряется — уходит в последнюю', () => {
    const g = groupMoreRows([row('why'), row('cabinet'), row('new')]);
    expect(g.map(x => x.id)).toEqual(['therapist', 'help']);
    expect(g[1].rows.map(r => r.id)).toEqual(['why', 'new']);
  });

  it('группа только из телефонных строк помечена phoneOnly', () => {
    const g = groupMoreRows([row('practice', true), row('schemas', true), row('journey')]);
    expect(g.find(x => x.id === 'do')!.phoneOnly).toBe(true);
    expect(g.find(x => x.id === 'grow')!.phoneOnly).toBe(false);
  });
});

describe('tasksRowSub', () => {
  it('«от терапевта» — только при подключённом терапевте', () => {
    expect(tasksRowSub(true)).toMatch(/терапевт/);
    expect(tasksRowSub(false)).not.toMatch(/терапевт/);
  });
});
