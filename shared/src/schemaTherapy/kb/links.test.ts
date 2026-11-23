// Связи справочника (.claude/rules/knowledge-base.md, разделы 2 и 4): каждое ребро ведёт в
// существующий id; режим без схемы и техника без раздела — только строкой в kb/gaps.ts.
import { describe, expect, it } from 'vitest';
import { danglingEdges, gapProblems, KB_KIND_LABEL } from './check';
import { MODES_WITHOUT_SCHEMA, TECHNIQUES_WITHOUT_SECTION } from './gaps';
import { KB_LINKS, schemasOfMode, usagesOfTechnique } from './links';
import { kbIds } from './tables';
import { buildModeGuides, buildSchemaGuides } from '../guide/index';
import type { TechniqueId, Tr } from '../guide/types';

describe('рёбра справочника (kb/links.ts)', () => {
  it.each(KB_LINKS.map((l) => [`${l.from}.${l.field} → ${l.to}`, l]))(
    '%s ведёт в существующий id',
    (_, l) => {
      const bad = danglingEdges(l.pairs(), kbIds(l.to)).map(
        ([src, dst]) =>
          `${l.from} ${src}: в поле ${l.field} нет ${KB_KIND_LABEL[l.to]} ${dst} — исправь id`,
      );
      expect(bad).toEqual([]);
    },
  );

  it('обратная сторона считается из поля, а не пишется руками', () => {
    const [schemaId, modeId] = KB_LINKS[0].pairs()[0];
    expect(schemasOfMode(modeId)).toContain(schemaId);
    const [src, tech] = KB_LINKS.find(
      (l) => l.from === 'mode' && l.to === 'technique',
    )!.pairs()[0];
    expect(usagesOfTechnique(tech)).toContainEqual({ kind: 'mode', id: src });
  });
});

describe('два уровня техник: главные и «Ещё техники»', () => {
  const tr: Tr = (t) => t;
  const sections: [string, TechniqueId[], TechniqueId[]][] = [
    ...buildModeGuides(tr).map(
      (g) =>
        [g.modeId, g.techniques, g.moreTechniques ?? []] as [
          string,
          TechniqueId[],
          TechniqueId[],
        ],
    ),
    ...buildSchemaGuides(tr).map(
      (g) =>
        [g.schemaId, g.techniques, g.moreTechniques ?? []] as [
          string,
          TechniqueId[],
          TechniqueId[],
        ],
    ),
  ];

  it('«Ещё техники» без повторов внутри и с главными', () => {
    const bad = sections.flatMap(([id, main, more]) =>
      more
        .filter((t, i) => main.includes(t) || more.indexOf(t) !== i)
        .map((t) => `${id}: ${t}`),
    );
    expect(
      bad,
      'техника стоит в разделе дважды — оставь её на одном уровне',
    ).toEqual([]);
  });

  it('техника из «Ещё техник» видна в «Где применяется»', () => {
    const [id, , more] = sections.find(([, , m]) => m.length > 0)!;
    expect(usagesOfTechnique(more[0]).map((u) => u.id)).toContain(id);
  });
});

describe('известные дыры (kb/gaps.ts) только убывают', () => {
  it('режим без схемы — только из MODES_WITHOUT_SCHEMA', () => {
    const ids = kbIds('mode');
    const holes = ids.filter((id) => schemasOfMode(id).length === 0);
    const r = gapProblems(holes, Object.keys(MODES_WITHOUT_SCHEMA), ids);
    expect(
      r.unlisted,
      'добавь режим в modeIds схемы по книге (или строку theory в kb/gaps.ts)',
    ).toEqual([]);
    expect(
      r.stale,
      'у режима уже есть схема — удали строку из kb/gaps.ts',
    ).toEqual([]);
    expect(r.unknown, 'такого режима нет — удали строку из kb/gaps.ts').toEqual(
      [],
    );
  });

  it('техника без раздела — только из TECHNIQUES_WITHOUT_SECTION', () => {
    const ids = kbIds('technique');
    const holes = ids.filter((id) => usagesOfTechnique(id).length === 0);
    const r = gapProblems(holes, Object.keys(TECHNIQUES_WITHOUT_SECTION), ids);
    expect(
      r.unlisted,
      'добавь технику в techniques режима, схемы или запроса по книге',
    ).toEqual([]);
    expect(
      r.stale,
      'технику уже зовёт раздел — удали строку из kb/gaps.ts',
    ).toEqual([]);
    expect(r.unknown, 'такой техники нет — удали строку из kb/gaps.ts').toEqual(
      [],
    );
  });

  it('у каждой строки есть причина', () => {
    const all = [
      ...Object.values(MODES_WITHOUT_SCHEMA),
      ...Object.values(TECHNIQUES_WITHOUT_SECTION),
    ];
    expect(all.filter((g) => g.why.trim().length < 20)).toEqual([]);
  });
});
