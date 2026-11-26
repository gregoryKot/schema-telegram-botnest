// Вкладка «Путь терапии»: листы фаз собираются в обеих формах обращения, ссылки на режимы, техники
// и заметки «Для терапевта» ведут на существующие записи, у каждого листа есть источник с полки.
import { describe, it, expect } from 'vitest';
import { getModeById } from '../../schemaTherapyData';
import {
  buildPhaseGuides,
  buildTechniqueGuides,
  practiceNotes,
} from '../index';
import { citedSources } from '../sources';
import type { Tr } from '../types';
import { PHASE_SESSIONS } from './all';

const ty: Tr = (t) => t;
const vy: Tr = (_t, v) => v;

describe.each([
  ['ты', ty],
  ['вы', vy],
])('листы «Пути терапии», форма «%s»', (_name, tr) => {
  const phases = buildPhaseGuides(tr);
  const techniqueIds = new Set(buildTechniqueGuides(tr).map((t) => t.id));
  const noteIds = new Set(practiceNotes(tr).map((n) => n.id));

  it('первый лист — обзор, за ним идут фазы', () => {
    expect(phases[0]?.id).toBe('overview');
    expect(phases.length).toBeGreaterThan(1);
  });

  it('ключи уникальны, обязательные поля заполнены', () => {
    expect(new Set(phases.map((p) => p.id)).size).toBe(phases.length);
    for (const p of phases) {
      expect(p.id).toMatch(/^[a-z][a-z0-9_]*$/);
      for (const text of [p.name, p.goal, p.essence])
        expect(text.trim()).not.toBe('');
      // Лист шаблона может стоять на статье протокола: ссылка с годом, а не книга полки.
      if (p.group === 'templates') expect(p.sources).toMatch(/\[[^\]]+\]/);
      else expect(citedSources(p.sources).length).toBeGreaterThan(0);
    }
  });

  it('режимы, техники и заметки «Для терапевта» листов существуют', () => {
    for (const p of phases) {
      for (const id of p.modeIds ?? [])
        expect(getModeById(id), id).toBeTruthy();
      for (const id of p.techniques ?? [])
        expect(techniqueIds.has(id), id).toBe(true);
      for (const id of p.noteIds ?? [])
        expect(noteIds.has(id), `${p.id}: ${id}`).toBe(true);
    }
  });
});

it('длительность в сессиях названа только для существующих фаз', () => {
  const ids = new Set(buildPhaseGuides((t) => t).map((p) => p.id));
  for (const [id, span] of Object.entries(PHASE_SESSIONS)) {
    expect(ids.has(id), id).toBe(true);
    expect(span?.from ?? 0).toBeLessThanOrEqual(span?.to ?? 0);
  }
});
