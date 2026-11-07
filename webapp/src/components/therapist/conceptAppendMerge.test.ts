// Сведение записи холста с неотправленными правками вкладки «Концептуализация» (#963).
import { describe, it, expect } from 'vitest';
import { mergeAppended, mergeIds } from './conceptAppendMerge';

const link = (modeId: string, schemaIds: string[], alias = '') => ({ modeId, alias, schemaIds, needIds: [], origin: '', manifest: '', strategy: '' });

describe('mergeIds', () => {
  it('правок нет — серверный список', () => {
    expect(mergeIds(['a'], ['a'], ['a', 'b'])).toEqual(['a', 'b']);
  });
  it('неотправленное добавление остаётся, снятое не возвращается', () => {
    expect(mergeIds(['a', 'x'], ['a', 'c'], ['a', 'x', 'b'])).toEqual(['a', 'b', 'c']);
  });
});

describe('mergeAppended', () => {
  it('списки — с сервера, текстовые поля — локальные', () => {
    const base = { modeIds: ['vulnerable_child'], schemaIds: [], modeLinks: [] };
    const local = { ...base, goals: 'черновик целей' };
    const merged = mergeAppended(base, local, { modeIds: ['vulnerable_child', 'demanding_critic'], schemaIds: ['failure'], modeLinks: [] });
    expect(merged).toMatchObject({ modeIds: ['vulnerable_child', 'demanding_critic'], schemaIds: ['failure'], goals: 'черновик целей' });
  });

  it('связь, правленная во вкладке, сохраняет свои поля; её схемы сводятся с серверными', () => {
    const base = { modeLinks: [link('demanding_critic', ['failure'])] };
    const local = { modeLinks: [link('demanding_critic', ['failure'], 'Голос отца')] };
    const server = { modeLinks: [link('demanding_critic', ['failure', 'defectiveness']), link('vulnerable_child', ['abandonment'])] };
    expect(mergeAppended(base, local, server).modeLinks).toEqual([
      link('demanding_critic', ['failure', 'defectiveness'], 'Голос отца'),
      link('vulnerable_child', ['abandonment']),
    ]);
  });

  // «Делали сегодня» (#995): отметка, поставленная во вкладке и ещё не ушедшая, и
  // отметка, уже лежащая на сервере, переживают запись с холста.
  it('отметки техник (done) не теряются ни у локальной правки, ни у серверной связи', () => {
    const done = [{ techniqueId: 'chairwork', day: '2026-11-05' }];
    const base = { modeLinks: [link('demanding_critic', ['failure'])] };
    const local = { modeLinks: [{ ...link('demanding_critic', ['failure']), done }] };
    const server = { modeLinks: [link('demanding_critic', ['failure', 'shame']), { ...link('vulnerable_child', []), done }] };
    expect(mergeAppended(base, local, server).modeLinks).toEqual([
      { ...link('demanding_critic', ['failure', 'shame']), done },
      { ...link('vulnerable_child', []), done },
    ]);
  });

  it('концептуализации ещё не было — локальные списки объединяются с серверными', () => {
    expect(mergeAppended(null, { modeIds: ['healthy_adult'] }, { modeIds: ['demanding_critic'] }).modeIds)
      .toEqual(['demanding_critic', 'healthy_adult']);
  });
});
