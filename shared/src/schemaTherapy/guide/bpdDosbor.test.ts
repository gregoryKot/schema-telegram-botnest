// Досбор Арнца и ван Гендерен (гл. 1–5): собранный справочник — каждая метка главы в тексте записи есть и в её sources; пункты короткие.
import { describe, it, expect } from 'vitest';
import { buildModeGuides, buildTechniqueGuides, practiceNotes } from './index';
import { buildConcernGuides } from './concerns/all';
import type { Tr } from './types';

const ty: Tr = (t) => t;
const LABEL = /\[Арнтц ПРЛ, гл\. ([^\]]+)\]/g;

const chaptersIn = (text: string): Set<number> => {
  const out = new Set<number>();
  for (const m of text.matchAll(LABEL)) {
    for (const part of m[1].split(', ')) {
      const [a, b = a] = part
        .split('–')
        .map((x) => Number(x.replace(/\D/g, '')));
      if (Number.isFinite(a) && Number.isFinite(b))
        for (let n = a; n <= b; n++) out.add(n);
    }
  }
  return out;
};

const TOUCHED = new Set([
  'detached_protector',
  'angry_child',
  'abandoned_child',
  'punitive_critic',
  'healthy_adult',
  'mode_flipping',
  'complaint_to_mode',
  'empathic_confrontation',
  'limit_setting',
  'imagery_rescripting',
  'diagnostic_imagery',
  'historical_role_play',
  'anger_expression',
  'body_grounding',
  'mode_map',
  'guess_the_mode',
]);
const records = [
  ...buildModeGuides(ty).map((g) => ({ id: g.modeId, ...g })),
  ...buildTechniqueGuides(ty),
  ...practiceNotes(ty),
].filter((g) => TOUCHED.has(g.id));

describe('досбор Арнца о ПРЛ: метки глав', () => {
  it('глава, названная в «Подробнее», есть в sources записи', () => {
    const problems: string[] = [];
    for (const g of records) {
      const used = chaptersIn((g.more ?? []).join(' '));
      const have = chaptersIn(g.sources);
      for (const n of used)
        if (n <= 5 && !have.has(n)) problems.push(`${g.id}: гл. ${n}`);
    }
    expect(problems).toEqual([]);
  });
});

describe('досбор Арнца о ПРЛ: статья bpd', () => {
  const bpd = buildConcernGuides(ty).find((c) => c.id === 'bpd')!;
  const at = (list: string[] | undefined, start: string) =>
    (list ?? []).findIndex((t) => t.startsWith(start));

  it('абзацы курса встали после абзаца о трёх каналах', () => {
    const i = at(bpd.course, 'Три канала работают');
    expect(bpd.course![i + 1]).toMatch(/^Почему каналов три/);
  });

  it('запасной контакт и ориентир по звонкам встали в кризис рядом со своими абзацами', () => {
    expect(bpd.crisis![at(bpd.crisis, 'Связь между сессиями') + 1]).toMatch(
      /^Ориентир по звонкам/,
    );
    expect(
      bpd.crisis![at(bpd.crisis, 'На случай, когда терапевт недоступен') + 1],
    ).toMatch(/^Запасной контакт/);
  });

  it('психообразование и отношения получили пункты досбора', () => {
    expect(
      bpd.psychoeducation!.some((t) => t.startsWith('К рационалу рескрипции')),
    ).toBe(true);
    expect(bpd.relationship!.at(-1)).toMatch(/образец уважительного/);
  });
});
