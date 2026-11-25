// Досбор Хис и Стартап (гл. 3–8, 17–20): пункты из файлов-продолжений дошли до собранных записей справочника.
import { describe, it, expect } from 'vitest';
import { buildModeGuides, buildTechniqueGuides, practiceNotes } from './index';
import type { Tr } from './types';
import { healthyAdultHeathMore } from './modes/healthyAdultHeathMore';
import { angryProtectorMore } from './modes/angryProtectorMore';
import {
  bodyGroundingHeathMore,
  chairworkHeathMore,
} from './techniques/bodyHeathMore';
import { compassionHeathMore } from './techniques/compassionHeathMore';
import { rescriptingHeathMore } from './techniques/imageryRescriptingHeath';
import {
  futureHeathMore,
  modeDialogueHeathMore,
} from './techniques/imageryFutureHeath';
import { transitionalHeathMore } from './techniques/transitionalObjectsHeath';
import { toysHeathMore } from './techniques/creativeModeWorkToysHeath';
import { angerExpressionHeath } from './techniques/angerExpressionHeath';
import { limitedReparentingHeathMore } from './techniques/reparentingPatternsHeath';
import { schemaDialogueMore } from './techniques/schemaDialogueMore';
import { patternsHeathMore } from './practicePatternsHeathMore';
import {
  cbtWithSchemasHeathMore,
  endingPhaseHeathMore,
  prematureEndingHeathMore,
} from './practiceEndingHeathMore';

const ty: Tr = (t) => t;
const vy: Tr = (_t, v) => v;

const MODES: [string, string[]][] = [
  ['healthy_adult', healthyAdultHeathMore],
  ['angry_protector', angryProtectorMore],
];
const TECHNIQUES: [string, string[]][] = [
  ['body_grounding', bodyGroundingHeathMore],
  ['chairwork', chairworkHeathMore],
  ['compassionate_self', compassionHeathMore],
  ['imagery_rescripting', rescriptingHeathMore],
  ['future_imagery', futureHeathMore],
  ['mode_dialogue_imagery', modeDialogueHeathMore],
  ['transitional_objects', transitionalHeathMore],
  ['creative_mode_work', toysHeathMore],
  ['anger_expression', angerExpressionHeath],
  ['limited_reparenting', limitedReparentingHeathMore],
  ['schema_dialogue', schemaDialogueMore],
];
const PRACTICE: [string, string[]][] = [
  ['positive_patterns_in_session', patternsHeathMore],
  ['ending_phase', endingPhaseHeathMore],
  ['premature_ending', prematureEndingHeathMore],
  ['cbt_with_schemas', cbtWithSchemasHeathMore],
];

describe.each([
  ['ты', ty],
  ['вы', vy],
])('досбор Хис в справочнике, форма «%s»', (_name, tr) => {
  it.each(MODES)('режим %s', (id, items) => {
    const g = buildModeGuides(tr).find((m) => m.modeId === id);
    expect(g?.more).toEqual(expect.arrayContaining(items));
  });

  it.each(TECHNIQUES)('техника %s', (id, items) => {
    const g = buildTechniqueGuides(tr).find((t) => t.id === id);
    expect(g?.more).toEqual(expect.arrayContaining(items));
  });

  it.each(PRACTICE)('раздел «Для терапевта» %s', (id, items) => {
    const g = practiceNotes(tr).find((n) => n.id === id);
    expect(g?.more).toEqual(expect.arrayContaining(items));
  });
});

describe('ссылки на главы Хис попадают в sources записи', () => {
  it('в каждой записи с досбором названы главы из её текста', () => {
    const cases: [string, string[]][] = [
      ['imagery_rescripting', rescriptingHeathMore],
      ['compassionate_self', compassionHeathMore],
      ['body_grounding', bodyGroundingHeathMore],
    ];
    for (const [id, items] of cases) {
      const g = buildTechniqueGuides(ty).find((t) => t.id === id);
      const chapters = new Set(
        items.flatMap((s) =>
          [...s.matchAll(/\[Хис, гл\. (\d+)/g)].map((m) => m[1]),
        ),
      );
      const src = g?.sources ?? '';
      const named = [...src.matchAll(/\[Хис, гл\. ([^\]]+)\]/g)]
        .flatMap((m) => m[1].split(','))
        .flatMap((p) => {
          const r = p.trim().match(/^(\d+)[–-](\d+)$/);
          return r
            ? Array.from({ length: Number(r[2]) - Number(r[1]) + 1 }, (_, i) =>
                String(Number(r[1]) + i),
              )
            : [p.trim()];
        });
      for (const ch of chapters)
        expect(named, `${id}: гл. ${ch}`).toContain(ch);
    }
  });
});
