// Статьи «Тревожные расстройства», «ОКР», «Расстройство адаптации» и досбор «Депрессии» доходят до собранного справочника.
import { describe, it, expect } from 'vitest';
import { buildConcernGuides } from '../index';
import type { Tr } from '../types';

const ty: Tr = (t) => t;
const guides = buildConcernGuides(ty);
const byId = (id: string) => guides.find((g) => g.id === id)!;

describe('запросы: тревога, ОКР, адаптация, депрессия', () => {
  it('новые статьи собраны и названы в каталоге вкладки', () => {
    for (const id of ['anxiety', 'ocd', 'adjustment_disorder']) {
      const g = byId(id);
      expect(g, id).toBeTruthy();
      expect(g.modeIds?.length, id).toBeGreaterThan(0);
      expect(g.techniques?.length, id).toBeGreaterThan(0);
    }
  });

  it('депрессия: прежние режимы идут первыми, таблица 13.1 и схемы Кембриджа доехали', () => {
    const d = byId('depression');
    expect(d.modeIds?.slice(0, 5)).toEqual([
      'detached_protector',
      'worrying_oc',
      'invincible_oc',
      'self_aggrandiser',
      'happy_child',
    ]);
    expect(d.modeIds).toContain('vulnerable_child');
    expect(d.modeIds).toContain('helpless_surrenderer');
    expect(d.schemaIds).toEqual(
      expect.arrayContaining(['self_sacrifice', 'social_isolation']),
    );
    expect((d.more ?? []).join(' ')).toContain('табл. 13.1');
  });

  it('пункты депрессии не повторяются', () => {
    const d = byId('depression');
    const items = [
      ...(d.comorbidity ?? []),
      ...(d.course ?? []),
      ...(d.more ?? []),
    ];
    expect(new Set(items).size).toBe(items.length);
  });
});
