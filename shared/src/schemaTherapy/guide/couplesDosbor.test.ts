// Досбор статьи couples (Хис гл. 13 и др.): пункты из файла-продолжения дошли до собранной статьи.
import { describe, it, expect } from 'vitest';
import { buildConcernGuides } from './index';
import {
  couplesCourse,
  couplesCrisis,
  couplesEvidence,
  couplesFormats,
  couplesPsychoeducation,
  couplesRelationship,
} from './concerns/couplesDosbor';
import type { Tr } from './types';

const ty: Tr = (t) => t;
const vy: Tr = (_t, v) => v;

describe.each([
  ['ты', ty],
  ['вы', vy],
])('досбор «Работа с парами», форма «%s»', (_n, tr) => {
  const g = buildConcernGuides(tr).find((c) => c.id === 'couples');

  it.each([
    ['relationship', couplesRelationship],
    ['course', couplesCourse],
    ['psychoeducation', couplesPsychoeducation],
    ['formats', couplesFormats],
  ] as const)('поле %s содержит пункты досбора', (field, items) => {
    expect(g?.[field]).toEqual(expect.arrayContaining(items));
  });

  it('evidence и voice подключены, связи на месте', () => {
    expect(g?.evidence).toEqual(couplesEvidence);
    expect(g?.voice?.length).toBe(2);
    expect(g?.modeIds).toContain('happy_child');
    expect(g?.schemaIds).toEqual(
      expect.arrayContaining(['abandonment', 'mistrust', 'subjugation']),
    );
  });

  it('безопасность: насилие в паре ведёт к заметке об опасном партнёре', () => {
    const hits = [...(g?.crisis ?? []), ...(g?.formats ?? [])].filter(
      (s) => s.includes('насили') && s.includes('Опасный партнёр клиента'),
    );
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it('новые пункты до 300 знаков, метки глав названы в sources', () => {
    const fresh = [
      ...couplesRelationship,
      ...couplesCourse,
      ...couplesCrisis,
      ...couplesPsychoeducation,
      ...couplesFormats,
      couplesEvidence[couplesEvidence.length - 1],
    ];
    for (const s of fresh) expect(s.length).toBeLessThanOrEqual(300);
    for (const label of ['Хис', 'Бехари', 'Арнтц ПРЛ', 'Янг', 'Кембридж'])
      expect(g?.sources).toContain(`${label}, гл.`);
  });
});
