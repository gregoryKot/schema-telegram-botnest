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

  it('вид фаз — по смыслу: ключ — стадия справочника из guidePhaseIds фазы, без повторов; «завершение» — после автономии', () => {
    for (const t of templates) {
      const keys = t.phases.map((p) => p.look);
      expect(new Set(keys).size, t.id).toBe(keys.length);
      for (const p of t.phases) {
        if (p.look === 'ending') {
          expect(p.guidePhaseIds, `${t.id}.${p.id}`).toEqual(['autonomy']);
          expect(keys.indexOf('autonomy'), `${t.id}.${p.id}`).toBeLessThan(
            keys.indexOf('ending'),
          );
          expect(
            keys.indexOf('autonomy'),
            `${t.id}.${p.id}`,
          ).toBeGreaterThanOrEqual(0);
        } else expect(p.guidePhaseIds, `${t.id}.${p.id}`).toContain(p.look);
      }
    }
  });

  it('вид фазы «автономия» общего шаблона — знак автономии, а не соседней стадии', () => {
    const general = templates.find((t) => t.id === 'general');
    expect(general?.phases.find((p) => p.id === 'autonomy')?.look).toBe(
      'autonomy',
    );
    expect(general?.phases.find((p) => p.id === 'ending')?.look).toBe('ending');
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
