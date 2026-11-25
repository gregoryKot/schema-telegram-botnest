// Досбор Янга (гл. 9–10): пункты доходят до собранного справочника ровно по одному разу, короткие, метки глав есть в sources.
import { describe, it, expect } from 'vitest';
import { buildModeGuides, buildTechniqueGuides, practiceNotes } from './index';
import { buildConcernGuides } from './concerns/all';
import type { Tr } from './types';
import { bpdPsychoeducationYoung } from './concerns/bpdYoung2';
import { punitiveCriticYoung3 } from './modes/punitiveCriticYoung3';
import { detachedProtectorYoung3 } from './modes/detachedProtectorYoung3';
import { aggrYoung3 } from './modes/selfAggrandiserYoung3';
import { lonelyChildYoung3 } from './modes/lonelyChildYoung3';
import { selfDisclosureYoung3 } from './practiceSelfDisclosureYoung3';
import { imageryRescriptingYoung2 } from './techniques/imageryRescriptingYoung2';
import { lrYoung3 } from './techniques/limitedReparentingYoung3';
import { lsYoung3 } from './techniques/limitSettingYoung3';

const ty: Tr = (t) => t;
const modes = buildModeGuides(ty);
const techniques = buildTechniqueGuides(ty);
const notes = practiceNotes(ty);
const bpd = buildConcernGuides(ty).find((c) => c.id === 'bpd')!;
const narc = buildConcernGuides(ty).find((c) => c.id === 'narcissism')!;
const mode = (id: string) => modes.find((m) => m.modeId === id)!;
const tech = (id: string) => techniques.find((t) => t.id === id)!;
const note = (id: string) => notes.find((n) => n.id === id)!;

const SHELVES: [string, string[] | undefined, string[]][] = [
  ['bpd.psychoeducation', bpd.psychoeducation, bpdPsychoeducationYoung],
  ['punitive_critic', mode('punitive_critic').more, punitiveCriticYoung3],
  [
    'detached_protector',
    mode('detached_protector').more,
    detachedProtectorYoung3,
  ],
  ['self_aggrandiser', mode('self_aggrandiser').more, aggrYoung3],
  ['lonely_child', mode('lonely_child').more, lonelyChildYoung3],
  ['self_disclosure', note('self_disclosure').more, selfDisclosureYoung3],
  [
    'imagery_rescripting',
    tech('imagery_rescripting').more,
    imageryRescriptingYoung2,
  ],
  ['limited_reparenting', tech('limited_reparenting').more, lrYoung3],
  ['limit_setting', tech('limit_setting').more, lsYoung3],
];

describe('досбор Янга гл. 9–10: подключение', () => {
  it.each(SHELVES)(
    '%s: пункты досбора есть в записи ровно один раз',
    (_n, assembled, mine) => {
      for (const item of mine.filter((t) => /Янг, гл\. (9|10)/.test(t))) {
        expect(assembled!.filter((t) => t === item)).toHaveLength(1);
      }
    },
  );

  it.each(SHELVES)(
    '%s: нового пункта не длиннее 300 знаков',
    (_n, _a, mine) => {
      for (const item of mine.filter((t) => /Янг, гл\. (9|10)/.test(t))) {
        expect(item.length).toBeLessThanOrEqual(300);
      }
    },
  );

  it('нарциссизм: три истории детства и спектр', () => {
    expect(narc.origins).toMatch(/одарённый ребёнок/);
    expect(narc.differential!.join(' ')).toMatch(
      /доброкачественного до злокачественного/,
    );
  });

  it('ПРЛ: четыре семейных фактора, критерии на языке режимов, кризис', () => {
    expect(bpd.origins).toMatch(/Четыре семейных фактора/);
    expect(bpd.criteria!.join(' ')).toMatch(/табл\. 9\.1/);
    expect(bpd.crisis!.join(' ')).toMatch(/никчёмности или покинутости/);
  });
});

describe('досбор Янга гл. 9–10: метки глав', () => {
  const LABEL = /\[Янг, гл\. ([^\]]+)\]/g;
  const chapters = (text: string): Set<number> => {
    const out = new Set<number>();
    for (const m of text.matchAll(LABEL))
      for (const p of m[1].split(', ')) {
        const n = /^\d+$/.test(p) ? Number(p) : NaN;
        if (!Number.isNaN(n)) out.add(n);
      }
    return out;
  };
  const records = [
    ...[
      'punitive_critic',
      'detached_protector',
      'self_aggrandiser',
      'lonely_child',
      'detached_self_soother',
    ].map((id) => mode(id)),
    ...[
      'imagery_rescripting',
      'limited_reparenting',
      'limit_setting',
      'anger_expression',
      'flashcards',
      'mode_dialogue_imagery',
    ].map(tech),
    note('self_disclosure'),
  ];

  it('глава из «Подробнее» и реплик названа в sources записи', () => {
    const problems: string[] = [];
    for (const g of records) {
      const text = [...(g.more ?? []), ...(g.voice ?? [])].join(' ');
      for (const n of chapters(text))
        if (n >= 9 && !chapters(g.sources).has(n))
          problems.push(`${'modeId' in g ? g.modeId : g.id}: гл. ${n}`);
    }
    expect(problems).toEqual([]);
  });

  it('статьи bpd и narcissism называют гл. 9 и 10 в sources', () => {
    expect(chapters(bpd.sources).has(9)).toBe(true);
    expect(chapters(narc.sources).has(10)).toBe(true);
  });
});
