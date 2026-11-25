// Статьи «ПТСР и комплексная травма» и «РПП» доходят до собранной вкладки, пункты не повторяются,
// каждая метка книги из текста названа в sources.
import { describe, it, expect } from 'vitest';
import { buildConcernGuides } from '../index';
import type { Tr } from '../types';

const ty: Tr = (t) => t;
const guides = buildConcernGuides(ty);
const byId = (id: string) => guides.find((g) => g.id === id)!;

const listItems = (g: ReturnType<typeof byId>): string[] => [
  ...(g.comorbidity ?? []),
  ...(g.differential ?? []),
  ...(g.course ?? []),
  ...(g.crisis ?? []),
  ...(g.relationship ?? []),
  ...(g.psychoeducation ?? []),
  ...(g.formats ?? []),
  ...(g.evidence ?? []),
];

describe.each(['ptsd', 'eating_disorders'])('запрос «%s»', (id) => {
  const g = byId(id);

  it('статья собрана, связи и кризис заполнены', () => {
    expect(g).toBeTruthy();
    expect(g.modeIds?.length).toBeGreaterThan(0);
    expect(g.schemaIds?.length ?? g.origins?.length).toBeGreaterThan(0);
    expect(g.techniques?.length).toBeGreaterThanOrEqual(2);
    expect(g.crisis?.length).toBeGreaterThan(0);
    expect((g.course ?? []).length).toBeGreaterThan(8);
  });

  it('пункты не повторяются и не длиннее 450 знаков', () => {
    const items = listItems(g);
    expect(new Set(items).size).toBe(items.length);
    for (const item of items)
      expect(item.length, item).toBeLessThanOrEqual(450);
  });

  it('каждая глава из текста названа в sources', () => {
    const text = JSON.stringify(g).replace(/\[[^\]]*\]/g, (m) => m);
    const labels = new Set(
      [...text.matchAll(/\[(Кембридж|Хис|Янг|Фаррелл|Арнтц ПРЛ)[^\]]*\]/g)].map(
        (m) => m[1],
      ),
    );
    for (const label of labels) expect(g.sources).toContain(`[${label}`);
  });
});
