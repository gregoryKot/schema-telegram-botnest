// Пилот живого языка в подсказках терапевту (2026-11): переписанный раздел
// держит форму, ради которой его переписывали, — до пяти шагов или пунктов на
// виду, «Как это звучит» из одной-двух реплик, остальное под «Подробнее».
// Реплики — без кавычек по краям: их ставит лист (как у фразы репарентинга).
import { describe, it, expect } from 'vitest';
import {
  buildModeGuides,
  buildSchemaGuides,
  buildTechniqueGuides,
  modeGuide,
  schemaGuide,
  techniqueGuide,
} from './index';
import type { Tr } from './types';

const ty: Tr = (t) => t;
const vy: Tr = (_t, v) => v;

describe.each([
  ['ты', ty],
  ['вы', vy],
])('переписанные разделы, форма «%s»', (_name, tr) => {
  it('техника pattern_breaking: до пяти шагов, реплика, «Подробнее»', () => {
    const t = techniqueGuide(tr, 'pattern_breaking')!;
    expect(t.steps.length).toBeGreaterThanOrEqual(3);
    expect(t.steps.length).toBeLessThanOrEqual(5);
    expect(t.voice?.length).toBeGreaterThanOrEqual(1);
    expect(t.voice?.length).toBeLessThanOrEqual(2);
    expect(t.more?.length).toBeGreaterThanOrEqual(1);
  });

  it('режим vulnerable_child: четыре коротких канала, реплика, «Подробнее»', () => {
    const g = modeGuide(tr, 'vulnerable_child')!;
    for (const text of [
      g.relationship,
      g.cognitive,
      g.experiential,
      g.behavioral,
    ])
      expect(text?.length ?? 0).toBeLessThanOrEqual(260);
    expect(g.voice?.length).toBeGreaterThanOrEqual(1);
    expect(g.voice?.length).toBeLessThanOrEqual(2);
    expect(g.more?.length).toBeGreaterThanOrEqual(1);
  });

  it('схема abandonment: суть в две фразы, до пяти пунктов «Что делать»', () => {
    const g = schemaGuide(tr, 'abandonment')!.guide;
    expect(g.essence.length).toBeLessThanOrEqual(240);
    expect(g.interventions.length).toBeLessThanOrEqual(5);
  });

  it('у любого раздела реплики «Как это звучит» и пункты «Подробнее» непустые, реплика без кавычек по краям', () => {
    const all = [
      ...buildTechniqueGuides(tr),
      ...buildModeGuides(tr),
      ...buildSchemaGuides(tr),
    ];
    for (const g of all) {
      for (const line of g.voice ?? []) {
        expect(line.trim()).not.toBe('');
        expect(line).not.toMatch(/^«|»[.!?…]?$/);
      }
      for (const item of g.more ?? []) expect(item.trim()).not.toBe('');
    }
  });
});
