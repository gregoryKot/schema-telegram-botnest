// Досбор «Кластера C» и «Других расстройств личности» (Кембридж, Янг, Хис, Фаррелл) доходит до собранного справочника.
import { describe, it, expect } from 'vitest';
import { buildConcernGuides } from '../index';
import { citedSources } from '../sources';
import type { ConcernGuide } from './types';
import type { Tr } from '../types';

const ty: Tr = (t) => t;
const vy: Tr = (_t, v) => v;

const listFields = [
  'comorbidity',
  'differential',
  'course',
  'relationship',
  'evidence',
  'formats',
] as const;

/** Пункты этого досбора: по меткам книг и по первым словам пунктов Янга. */
const NEW =
  /\[(Кембридж|Хис|Фаррелл|Арнтц ПРЛ)|табл\. 1\.3|\[Янг, гл. 3\]|После КПТ агорафобии|DSM-IV|Schmidt|Психологическая ригидность/;

function items(g: ConcernGuide): string[] {
  return listFields.flatMap((f) => g[f] ?? []);
}

describe.each([
  ['ты', ty],
  ['вы', vy],
])('досбор запросов кластера C и других РЛ, форма «%s»', (_n, tr) => {
  const guides = buildConcernGuides(tr);
  const clusterC = guides.find((g) => g.id === 'cluster_c')!;
  const other = guides.find((g) => g.id === 'other_personality_disorders')!;

  it('старые пункты идут первыми и в прежнем порядке', () => {
    expect(clusterC.modeIds?.slice(0, 3)).toEqual([
      'lonely_child',
      'abandoned_child',
      'dependent_child',
    ]);
    expect(clusterC.course?.[0]).toMatch(/^Главный фокус — злость/);
    expect(clusterC.course?.[4]).toMatch(/^Цель при зависимости/);
    expect(clusterC.differential?.[0]).toMatch(/^Требовательный Критик или/);
    expect(other.modeIds?.slice(0, 2)).toEqual([
      'vulnerable_child',
      'impulsive_child',
    ]);
    expect(other.course?.[0]).toMatch(/^Если клиент жалуется/);
    expect(other.relationship?.[0]).toMatch(/^Отношения с терапевтом/);
  });

  it('новые пункты доходят до справочника, каждый ≤300 знаков, с меткой книги', () => {
    const joined = items(clusterC).join(' ');
    for (const part of [
      'Сердитого Ребёнка вносят в карту',
      'игре «жалобы»',
      '20 начальных, 20 средних и 10 редких',
      'Mertens et al., 2020',
      'Дефективность / Стыд в трёх копингах',
      'месяцы надёжной заботы',
      'шкале от 0 до 10',
      'двое ведущих',
      'агорафобии',
    ])
      expect(joined, part).toContain(part);
    const otherJoined = items(other).join(' ');
    for (const part of ['унизит или высмеет', 'Bamelis et al., 2011'])
      expect(otherJoined, part).toContain(part);
    expect(otherJoined).toContain('Недоверие / Ожидание жестокого обращения');
    for (const g of [clusterC, other])
      for (const t of items(g).filter((x) => NEW.test(x))) {
        expect(t.length, t.slice(0, 40)).toBeLessThanOrEqual(300);
        expect(t, t.slice(0, 40)).toMatch(/\[[^\]]+, [^\]]+\]/);
      }
  });

  it('пункты не повторяются, метки книг есть в sources, связи существуют', () => {
    for (const g of [clusterC, other]) {
      const all = items(g);
      expect(new Set(all).size).toBe(all.length);
      const cited = citedSources(g.sources).map((c) => c.key);
      for (const key of ['Кембридж', 'Янг'])
        expect(cited, `${g.id}: ${key}`).toContain(key);
    }
    expect(clusterC.modeIds).toEqual(
      expect.arrayContaining([
        'angry_child',
        'healthy_adult',
        'happy_child',
        'detached_protector',
      ]),
    );
    expect(other.schemaIds).toEqual(['mistrust']);
    expect(other.modeIds).toContain('angry_child');
  });
});
