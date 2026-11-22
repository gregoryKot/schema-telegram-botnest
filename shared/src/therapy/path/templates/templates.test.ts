// Шаблоны пути: id уникальны, недели положительны, каждый адрес и этап существуют в справочнике,
// у шаблона есть источник: книга полки или статья с годом.
import { describe, it, expect } from 'vitest';
import {
  buildPhaseGuides,
  guideAddressArticles,
} from '../../../schemaTherapy/guide';
import type { Tr } from '../../../needs/types';
import {
  buildPathTemplates,
  pathTemplate,
  pathTemplateWeeks,
  PATH_TEMPLATE_BUILDERS,
} from './index';

const ty: Tr = (t) => t;
const vy: Tr = (_t, v) => v;

describe.each([
  ['ты', ty],
  ['вы', vy],
])('шаблоны пути, форма «%s»', (_name, tr) => {
  const templates = buildPathTemplates(tr);
  const addresses = new Set(
    guideAddressArticles(tr).flatMap((a) =>
      [...a.sections.keys()].map((path) => `${a.kind}:${a.id}/${path}`),
    ),
  );
  const guidePhases = new Set(buildPhaseGuides(tr).map((p) => p.id));

  it('id шаблонов и фаз уникальны, тексты заполнены', () => {
    expect(new Set(templates.map((t) => t.id)).size).toBe(templates.length);
    for (const t of templates) {
      expect(t.id).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(t.phases.length).toBeGreaterThan(0);
      expect(new Set(t.phases.map((p) => p.id)).size).toBe(t.phases.length);
      expect(t.sources, t.id).toMatch(/\[[^\]]+\]/);
      for (const p of t.phases) {
        expect(p.id).toMatch(/^[a-z][a-z0-9_]*$/);
        for (const text of [p.name, p.goal, p.therapist, p.stance])
          expect(text.trim(), `${t.id}.${p.id}`).not.toBe('');
        expect(p.transition.length, `${t.id}.${p.id}`).toBeGreaterThan(0);
        expect(p.mistakes.length, `${t.id}.${p.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('недели — целые и положительные', () => {
    for (const t of templates)
      for (const p of t.phases) {
        expect(Number.isInteger(p.weeks), `${t.id}.${p.id}`).toBe(true);
        expect(p.weeks, `${t.id}.${p.id}`).toBeGreaterThan(0);
      }
  });

  it('адреса и этапы справочника существуют', () => {
    for (const t of templates)
      for (const p of t.phases) {
        expect(p.guidePhaseIds.length, `${t.id}.${p.id}`).toBeGreaterThan(0);
        for (const id of p.guidePhaseIds)
          expect(guidePhases.has(id), `${t.id}.${p.id}: ${id}`).toBe(true);
        for (const address of p.recommended)
          expect(addresses.has(address), `${t.id}.${p.id}: ${address}`).toBe(
            true,
          );
      }
  });
});

it('реестр: три стартовых шаблона, поиск по id, срок целиком', () => {
  expect(PATH_TEMPLATE_BUILDERS.length).toBeGreaterThanOrEqual(3);
  expect(pathTemplate(ty, 'нет')).toBeNull();
  expect(pathTemplateWeeks(pathTemplate(ty, 'bpd24')!)).toBe(104);
  expect(pathTemplateWeeks(pathTemplate(ty, 'brief50')!)).toBe(83);
});
