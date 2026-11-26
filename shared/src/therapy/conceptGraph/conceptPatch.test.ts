import { describe, it, expect } from 'vitest';
import {
  applyLinksPatch,
  chunkConceptPatch,
  conceptPatch,
  CONCEPT_PATCH_LINKS_MAX,
  rebaseConcept,
} from './conceptPatch';
import { emptyModeLink } from './modeLinks';
import { emptySchemaLink } from './schemaLinks';

const mode = (modeId: string, origin = '') => ({
  ...emptyModeLink(modeId),
  origin,
});
const schema = (schemaId: string, belief = '') => ({
  ...emptySchemaLink(schemaId),
  belief,
});
const byId = (l: { id: string }) => l.id;

describe('conceptPatch — только изменённое против ответа сервера', () => {
  const base = {
    goals: 'опора',
    triggers: null,
    modeIds: ['vulnerable_child'],
    schemaIds: ['abandonment'],
    modeLinks: [
      mode('vulnerable_child', 'мама уходила'),
      mode('punitive_critic'),
    ],
    schemaLinks: [schema('abandonment', 'меня бросят')],
    updatedAt: '2026-11-08T10:00:00.000Z',
  };

  it('ничего не менялось — пустой патч (null и "" — одно и то же)', () => {
    expect(conceptPatch(base, { ...base, triggers: '' })).toEqual({});
  });

  it('поле и список — целиком, связь — одна изменённая, убранная — в remove', () => {
    const local = {
      ...base,
      goals: 'опора и границы',
      modeIds: ['vulnerable_child', 'angry_child'],
      modeLinks: [mode('vulnerable_child', 'мама уходила, папа молчал')],
    };
    expect(conceptPatch(base, local)).toEqual({
      goals: 'опора и границы',
      modeIds: ['vulnerable_child', 'angry_child'],
      modeLinksPatch: {
        upsert: [mode('vulnerable_child', 'мама уходила, папа молчал')],
        remove: ['punitive_critic'],
      },
    });
  });

  it('строки ещё нет (base = null) — уходит всё непустое', () => {
    const p = conceptPatch(null, {
      goals: 'g',
      schemaLinks: [schema('failure', 'b')],
    });
    expect(p).toEqual({
      goals: 'g',
      schemaLinksPatch: { upsert: [schema('failure', 'b')] },
    });
  });
});

describe('applyLinksPatch — тот же разбор на сервере', () => {
  const cur = [
    { id: 'a', v: 1 },
    { id: 'b', v: 1 },
  ];

  it('upsert заменяет на месте и дописывает новую, remove убирает', () => {
    expect(
      applyLinksPatch(
        cur,
        {
          upsert: [
            { id: 'b', v: 2 },
            { id: 'c', v: 1 },
          ],
          remove: ['a'],
        },
        byId,
      ),
    ).toEqual([
      { id: 'b', v: 2 },
      { id: 'c', v: 1 },
    ]);
  });

  it('без патча — копия как есть', () => {
    expect(applyLinksPatch(cur, undefined, byId)).toEqual(cur);
  });
});

describe('chunkConceptPatch — не больше CONCEPT_PATCH_LINKS_MAX связей на запрос', () => {
  it('маленький патч — один запрос, пустой — ни одного', () => {
    expect(chunkConceptPatch({ goals: 'g' })).toEqual([{ goals: 'g' }]);
    expect(chunkConceptPatch({})).toEqual([]);
  });

  it('связи режимов и схем режутся по пределу, поля и remove — в первом', () => {
    const modes = Array.from(
      { length: CONCEPT_PATCH_LINKS_MAX * 2 + 1 },
      (_, i) => mode(`m${i}`),
    );
    const schemas = Array.from(
      { length: CONCEPT_PATCH_LINKS_MAX + 1 },
      (_, i) => schema(`s${i}`),
    );
    const parts = chunkConceptPatch({
      goals: 'g',
      modeLinksPatch: { upsert: modes, remove: ['gone'] },
      schemaLinksPatch: { upsert: schemas },
    });
    expect(parts).toHaveLength(3);
    expect(parts[0].goals).toBe('g');
    expect(parts[0].modeLinksPatch?.remove).toEqual(['gone']);
    expect(parts[1].goals).toBeUndefined();
    for (const p of parts) {
      expect(p.modeLinksPatch?.upsert?.length ?? 0).toBeLessThanOrEqual(
        CONCEPT_PATCH_LINKS_MAX,
      );
      expect(p.schemaLinksPatch?.upsert?.length ?? 0).toBeLessThanOrEqual(
        CONCEPT_PATCH_LINKS_MAX,
      );
    }
    // Сохранил по частям → нашёл всё: собранные части дают исходный набор.
    const all = parts.flatMap((p) => p.modeLinksPatch?.upsert ?? []);
    expect(all.map((l) => l.modeId)).toEqual(modes.map((l) => l.modeId));
    expect(parts[2].schemaLinksPatch).toBeUndefined();
  });
});

describe('rebaseConcept — правка вкладки поверх свежей версии сервера', () => {
  const base = {
    goals: 'старое',
    triggers: 'т',
    modeIds: ['vulnerable_child'],
    modeLinks: [mode('vulnerable_child', 'истоки')],
    schemaLinks: [],
  };

  it('холст в другом окне дописал режим и связь — вкладка их не стирает, свои правки сохраняет', () => {
    const local = {
      ...base,
      goals: 'новое',
      modeLinks: [mode('vulnerable_child', 'истоки + правка')],
    };
    const server = {
      ...base,
      triggers: 'т из другого окна',
      modeIds: ['vulnerable_child', 'angry_child'],
      modeLinks: [mode('vulnerable_child', 'истоки'), mode('angry_child')],
    };
    const next = rebaseConcept(base, local, server);
    expect(next.goals).toBe('новое'); // правка вкладки
    expect(next.triggers).toBe('т из другого окна'); // не трогали — с сервера
    expect(next.modeIds).toEqual(['vulnerable_child', 'angry_child']);
    expect(next.modeLinks).toEqual([
      mode('vulnerable_child', 'истоки + правка'),
      mode('angry_child'),
    ]);
    // Повтор патча от свежей версии несёт только правки вкладки.
    expect(conceptPatch(server, next)).toEqual({
      goals: 'новое',
      modeLinksPatch: { upsert: [mode('vulnerable_child', 'истоки + правка')] },
    });
  });

  it('связь, убранную во вкладке, сервер обратно не возвращает', () => {
    const local = { ...base, modeLinks: [] };
    const server = {
      ...base,
      modeLinks: [mode('vulnerable_child', 'истоки'), mode('angry_child')],
    };
    expect(rebaseConcept(base, local, server).modeLinks).toEqual([
      mode('angry_child'),
    ]);
  });
});
