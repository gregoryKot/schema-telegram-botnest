// Статьи «ПТСР и комплексная травма» и «РПП» доходят до собранной вкладки, пункты не повторяются,
// каждая метка книги из текста названа в sources.
import { describe, it, expect } from 'vitest';
import { buildConcernGuides } from '../index';
import type { Tr } from '../types';

const ty: Tr = (t) => t;
const guides = buildConcernGuides(ty);
const byId = (id: string) => guides.find((g) => g.id === id)!;

const textItems = (g: ReturnType<typeof byId>): string[] => [
  g.essence,
  g.origins ?? '',
  g.modeModel ?? '',
  g.inSession ?? '',
  g.stuck ?? '',
  ...(g.criteria ?? []),
  ...(g.comorbidity ?? []),
  ...(g.differential ?? []),
  ...(g.course ?? []),
  ...(g.crisis ?? []),
  ...(g.relationship ?? []),
  ...(g.psychoeducation ?? []),
  ...(g.formats ?? []),
  ...(g.evidence ?? []),
  ...(g.more ?? []),
];

describe.each(['ptsd', 'eating_disorders'])('запрос «%s»', (id) => {
  const g = byId(id);

  it('статья собрана, связи и кризис заполнены', () => {
    expect(g).toBeTruthy();
    expect(g.modeIds?.length).toBeGreaterThan(0);
    expect(g.schemaIds?.length).toBeGreaterThan(0);
    expect(g.techniques?.length).toBeGreaterThanOrEqual(2);
    expect(g.crisis?.length).toBeGreaterThan(0);
    expect((g.course ?? []).length).toBeGreaterThan(8);
  });

  it('пункты не повторяются и не длиннее 300 знаков', () => {
    const items = textItems(g).filter(Boolean);
    expect(new Set(items).size).toBe(items.length);
    for (const item of items)
      expect(item.length, item).toBeLessThanOrEqual(300);
  });

  it('каждая книга из текста названа в sources', () => {
    const text = JSON.stringify(g);
    const labels = new Set(
      [...text.matchAll(/\[(Кембридж|Хис|Янг|Фаррелл|Арнтц ПРЛ)[^\]]*\]/g)].map(
        (m) => m[1],
      ),
    );
    for (const label of labels) expect(g.sources).toContain(`[${label}`);
  });
});

describe('безопасность', () => {
  it('кризис РПП говорит о враче и об очистительном поведении', () => {
    const t = (byId('eating_disorders').crisis ?? []).join(' ');
    expect(t).toContain('врач');
    expect(t).toContain('очистительное');
  });

  it('ПТСР: есть пункт, когда переработку откладывают', () => {
    expect((byId('ptsd').course ?? []).join(' ')).toContain('откладывают');
  });
});
