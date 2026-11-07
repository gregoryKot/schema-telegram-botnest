// Сверка разделов схем (#995, шаг 2): у каждой из 20 схем сайта ровно один
// раздел в своём домене, режимы и техники ссылаются на существующие id, а
// плашка «Обычно в методе» остаётся короткой.
import { describe, it, expect } from 'vitest';
import { ALL_MODES, SCHEMA_DOMAINS } from '../schemaTherapyData';
import {
  buildSchemaDomainGuides,
  buildSchemaGuides,
  buildTechniqueGuides,
  schemaGuide,
} from './index';
import type { Tr } from './types';

const ty: Tr = (t) => t;
const vy: Tr = (_t, v) => v;
const modeIds = new Set(ALL_MODES.map((m) => m.id));

describe.each([
  ['ты', ty],
  ['вы', vy],
])('разделы схем, форма «%s»', (_name, tr) => {
  const domains = buildSchemaDomainGuides(tr);
  const schemas = buildSchemaGuides(tr);
  const techniqueIds = new Set(buildTechniqueGuides(tr).map((t) => t.id));

  it('домены идут как на сайте, у каждого есть «общее для домена»', () => {
    expect(domains.map((d) => d.domainId)).toEqual(
      SCHEMA_DOMAINS.map((d) => d.id),
    );
    for (const d of domains) expect(d.note.trim(), d.domainId).not.toBe('');
  });

  it('каждая схема сайта — ровно один раздел и в своём домене', () => {
    for (const d of SCHEMA_DOMAINS) {
      const guide = domains.find((g) => g.domainId === d.id);
      expect(guide?.schemas.map((s) => s.schemaId).sort()).toEqual(
        d.schemas.map((s) => s.id).sort(),
      );
    }
    const ids = schemas.map((s) => s.schemaId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('режимы и техники раздела существуют', () => {
    for (const s of schemas) {
      for (const m of s.modeIds)
        expect(modeIds.has(m), `${s.schemaId} → ${m}`).toBe(true);
      for (const t of s.techniques)
        expect(techniqueIds.has(t), `${s.schemaId} → ${t}`).toBe(true);
    }
  });

  it('плашка короткая, раздел заполнен', () => {
    for (const s of schemas) {
      const id = s.schemaId;
      expect(s.goal.trim(), id).not.toBe('');
      expect(s.goal.length, id).toBeLessThanOrEqual(160);
      for (const field of [
        s.essence,
        s.need,
        s.inSession,
        s.reparenting,
        s.sources,
      ])
        expect(field.trim(), id).not.toBe('');
      // Кавычки реплики ставит экран (SchemaGuideSheet): в данных их нет,
      // иначе на листе выходит «…».» (так и было в первой версии текстов).
      expect(s.reparenting, id).not.toMatch(/^«|»[.!?…]?$/);
      for (const c of Object.values(s.coping))
        expect(c.trim(), id).not.toBe('');
      expect(s.modeIds.length, id).toBeGreaterThanOrEqual(1);
      expect(s.interventions.length, id).toBeGreaterThanOrEqual(2);
      expect(s.interventions.length, id).toBeLessThanOrEqual(6);
      expect(s.techniques.length, id).toBeGreaterThanOrEqual(2);
      expect(s.techniques.length, id).toBeLessThanOrEqual(5);
      expect(s.betweenSessions.length, id).toBeGreaterThanOrEqual(1);
      expect(s.betweenSessions.length, id).toBeLessThanOrEqual(4);
      for (const b of s.betweenSessions) {
        expect(b.title.trim(), id).not.toBe('');
        if (b.kind === 'custom')
          expect(b.text.trim(), `${id}: ${b.title}`).not.toBe('');
      }
    }
  });

  it('schemaGuide отдаёт раздел вместе с «общим для домена»', () => {
    const found = schemaGuide(tr, 'abandonment');
    expect(found?.guide.schemaId).toBe('abandonment');
    expect(found?.domainNote).toBe(domains[0].note);
    expect(schemaGuide(tr, 'нет_такой')).toBeNull();
  });
});
