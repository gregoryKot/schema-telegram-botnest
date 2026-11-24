// Листы потребностей: сверка с реестрами потребностей и доменов (схема → домен → потребность).
import { describe, it, expect } from 'vitest';
import { NEED_ORDER } from '../../needs/types';
import { buildNeedData } from '../../needs/needData';
import { needDomain } from '../schemaNeed';
import { buildSchemaDomainGuides, needGuides } from './index';
import { citationLabels } from './sources';

const tr = (ty: string) => ty;
/** «Покинутость / Нестабильность», «Пунитивность (на себя)» → «Покинутость», «Пунитивность». */
const shortName = (name: string) => name.split(/ \/ | \(/)[0];

describe('листы потребностей справочника', () => {
  it('лист есть у каждой потребности, в порядке NEED_ORDER, все поля заполнены', () => {
    expect(needGuides().map((n) => n.id)).toEqual([...NEED_ORDER]);
    for (const n of needGuides()) {
      for (const text of Object.values(n)) expect(text.trim()).not.toBe('');
    }
  });

  it('«Схемы домена» называет домен потребности и каждую его схему', () => {
    for (const n of needGuides()) {
      const domain = needDomain(n.id)!;
      expect(n.schemas).toContain(`«${domain.domain}»`);
      for (const s of domain.schemas)
        expect(n.schemas).toContain(shortName(s.name));
    }
  });

  it('подпись не повторяет слово из названия потребности', () => {
    const needs = buildNeedData(tr);
    for (const n of needGuides()) {
      const name = needs[n.id].name.toLowerCase();
      expect(n.subtitle.toLowerCase()).not.toContain(name.slice(0, -2));
    }
  });

  it('«Источники» покрывают метки текста листа и «общего для домена»', () => {
    const notes = new Map(
      buildSchemaDomainGuides(tr).map((d) => [d.domainId, d.note]),
    );
    for (const n of needGuides()) {
      const body = [
        n.essence,
        n.frustration,
        n.schemas,
        n.care,
        notes.get(needDomain(n.id)!.id),
      ].join('\n');
      expect(citationLabels(n.sources)).toEqual(
        expect.arrayContaining(citationLabels(body)),
      );
    }
  });
});
