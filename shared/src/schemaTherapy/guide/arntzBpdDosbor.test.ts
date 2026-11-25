// Досбор Арнца и ван Гендерен (гл. 1–5): добавки доходят до записей, номера глав — в sources, вставки в статью bpd находят своё место.
import { describe, it, expect } from 'vitest';
import { buildModeGuides, buildTechniqueGuides, practiceNotes } from './index';
import { withChapters } from './arntzBpdDosbor';
import { MODE_ADD, NOTE_ADD } from './arntzBpdDosborModes';
import { TECH_ADD } from './arntzBpdDosborTech';
import { BPD_ALL_SECTIONS, insertAfter } from './concerns/bpdDosbor';
import { BPD_ALL_SECTIONS as BASE } from './concerns/bpdRelationship';
import type { Tr } from './types';

const ty: Tr = (t) => t;
const vy: Tr = (_t, v) => v;

describe('withChapters', () => {
  it('дописывает недостающую главу в существующую метку и не трогает покрытое', () => {
    expect(withChapters('[Арнтц ПРЛ, гл. 2, 9], [Янг, гл. 1]', [2, 5])).toBe(
      '[Арнтц ПРЛ, гл. 2, 9, 5], [Янг, гл. 1]',
    );
    expect(withChapters('[Арнтц ПРЛ, гл. 1–12, прил. А]', [3, 5])).toBe(
      '[Арнтц ПРЛ, гл. 1–12, прил. А]',
    );
  });
  it('заводит метку, если её не было', () => {
    expect(withChapters('[Хис, гл. 3]', [4])).toBe(
      '[Хис, гл. 3], [Арнтц ПРЛ, гл. 4]',
    );
  });
});

describe('досбор доходит до записей', () => {
  const modes = buildModeGuides(ty);
  const techs = buildTechniqueGuides(ty);
  const notes = practiceNotes(ty);

  it.each(Object.keys(MODE_ADD))(
    'режим %s: абзацы в «Подробнее», главы в источниках',
    (id) => {
      const g = modes.find((m) => m.modeId === id)!;
      expect(g, id).toBeDefined();
      for (const p of MODE_ADD[id].more ?? []) expect(g.more).toContain(p);
      for (const n of MODE_ADD[id].chapters)
        expect(g.sources).toMatch(
          new RegExp(`Арнтц ПРЛ, гл\\.[^\\]]*\\b${n}\\b`),
        );
    },
  );

  it.each(Object.keys(TECH_ADD))(
    'техника %s: абзацы, реплики и главы на месте',
    (id) => {
      const g = techs.find((t) => t.id === id)!;
      expect(g, id).toBeDefined();
      for (const p of TECH_ADD[id].more ?? []) expect(g.more).toContain(p);
      expect(g.sources).toContain('Арнтц ПРЛ');
      if (TECH_ADD[id].cautions)
        expect(g.cautions).toContain(TECH_ADD[id].cautions);
    },
  );

  it.each(Object.keys(NOTE_ADD))('заметка %s: абзацы на месте', (id) => {
    const g = notes.find((n) => n.id === id)!;
    expect(g, id).toBeDefined();
    for (const p of NOTE_ADD[id].more ?? []) expect(g.more).toContain(p);
  });

  it('реплики есть в обеих формах обращения и различаются там, где есть «ты»', () => {
    const a = buildModeGuides(ty).find(
      (m) => m.modeId === 'detached_protector',
    )!;
    const b = buildModeGuides(vy).find(
      (m) => m.modeId === 'detached_protector',
    )!;
    expect(a.voice!.length).toBe(b.voice!.length);
    expect(a.voice!.at(-1)).not.toBe(b.voice!.at(-1));
  });

  it('пункт табл. 3.3 остаётся последним в «Подробнее» режима с добавками', () => {
    const g = modes.find((m) => m.modeId === 'punitive_critic')!;
    expect(g.more?.at(-1)).toContain('[Кембридж, табл. 3.3]');
  });
});

describe('вставки в статью bpd', () => {
  it('каждая вставка нашла свой абзац-якорь, а не упала в конец', () => {
    const grew = (k: 'course' | 'crisis' | 'relationship') =>
      (BPD_ALL_SECTIONS[k] ?? []).length - (BASE[k] ?? []).length;
    expect(grew('course')).toBe(5);
    expect(grew('crisis')).toBe(2);
    expect(grew('relationship')).toBe(1);
    const course = BPD_ALL_SECTIONS.course ?? [];
    const at = course.findIndex((t) => t.startsWith('Три канала работают'));
    expect(course[at + 1]).toMatch(/^Почему каналов три/);
    const crisis = BPD_ALL_SECTIONS.crisis ?? [];
    const c = crisis.findIndex((t) =>
      t.startsWith('На случай, когда терапевт недоступен'),
    );
    expect(crisis[c + 1]).toMatch(/^Запасной контакт/);
  });

  it('insertAfter без якоря дописывает в конец', () => {
    expect(insertAfter(['a', 'b'], 'x', ['c'])).toEqual(['a', 'b', 'c']);
    expect(insertAfter(['a', 'b'], 'a', ['c'])).toEqual(['a', 'c', 'b']);
  });
});
