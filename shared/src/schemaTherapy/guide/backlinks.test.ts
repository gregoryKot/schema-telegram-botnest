// Названия обратной стороны связей сходятся с прямыми полями разделов (правило №4), на живых данных
// без конкретных id: данные справочника правят параллельно.
import { describe, expect, it } from 'vitest';
import { getSchemaById } from '../schemaTherapyData';
import { buildConcernGuides, buildModeGuides, buildSchemaGuides, buildTechniqueGuides } from './index';
import { modeSchemaLinks, techniqueUsageGroups, usageLines } from './backlinks';

const tr = (_ty: string, vy: string) => vy;

describe('modeSchemaLinks', () => {
  it('режим из modeIds схемы видит эту схему с её названием', () => {
    for (const s of buildSchemaGuides(tr)) {
      for (const modeId of s.modeIds) {
        expect(modeSchemaLinks(modeId)).toContainEqual({ id: s.schemaId, name: getSchemaById(s.schemaId)?.name });
      }
    }
  });

  it('неизвестный режим — пусто', () => {
    expect(modeSchemaLinks('no_such_mode')).toEqual([]);
  });
});

describe('techniqueUsageGroups', () => {
  it('каждый раздел, зовущий технику, есть в своей группе; группы по порядку и без пустых', () => {
    const callers = [
      ...buildModeGuides(tr).map((g) => ({ kind: 'mode', id: g.modeId, t: g.techniques })),
      ...buildSchemaGuides(tr).map((g) => ({ kind: 'schema', id: g.schemaId, t: g.techniques })),
      ...buildConcernGuides(tr).map((g) => ({ kind: 'concern', id: g.id, t: g.techniques ?? [] })),
    ];
    for (const { id: techniqueId } of buildTechniqueGuides(tr)) {
      const groups = techniqueUsageGroups(tr, techniqueId);
      const order = groups.map((g) => ['mode', 'schema', 'concern'].indexOf(g.kind));
      expect(order).toEqual([...order].sort());
      expect(groups.every((g) => g.items.length > 0)).toBe(true);
      for (const c of callers.filter((x) => x.t.includes(techniqueId))) {
        const group = groups.find((g) => g.kind === c.kind);
        expect(group?.items.map((i) => i.id)).toContain(c.id);
      }
    }
  });

  it('техника, которую никто не зовёт, — без групп', () => {
    expect(techniqueUsageGroups(tr, 'no_such_technique')).toEqual([]);
  });
});

it('usageLines: строка на группу «Подпись: А, Б»', () => {
  const lines = usageLines([
    { kind: 'mode', lead: 'Режимы', items: [{ id: 'a', name: 'А' }, { id: 'b', name: 'Б' }] },
    { kind: 'concern', lead: 'Запросы', items: [{ id: 'c', name: 'В' }] },
  ]);
  expect(lines).toEqual(['Режимы: А, Б', 'Запросы: В']);
});
