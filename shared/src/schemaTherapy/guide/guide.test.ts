// Сверка подсказок терапевту (#995): у каждого стандартного режима есть свой
// раздел, каждая техника, на которую ссылается раздел, есть в библиотеке, и
// форма раздела держит плашку «Обычно в методе» короткой.
import { describe, it, expect } from 'vitest';
import { ALL_MODES } from '../schemaTherapyData';
import { buildModeGuides, buildTechniqueGuides, modeGuide } from './index';
import type { Tr } from './types';

const ty: Tr = (t) => t;
const vy: Tr = (_t, v) => v;

describe.each([
  ['ты', ty],
  ['вы', vy],
])('подсказки терапевту, форма «%s»', (_name, tr) => {
  const modes = buildModeGuides(tr);
  const techniques = buildTechniqueGuides(tr);
  const techniqueIds = new Set(techniques.map((t) => t.id));

  it('у каждого стандартного режима есть ровно один раздел', () => {
    const ids = modes.map((g) => g.modeId);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ALL_MODES.map((m) => m.id).sort());
  });

  it('техники в библиотеке не повторяются и у каждой есть шаги', () => {
    expect(techniqueIds.size).toBe(techniques.length);
    for (const t of techniques) {
      expect(t.name.trim(), t.id).not.toBe('');
      expect(t.summary.trim(), t.id).not.toBe('');
      expect(t.steps.length, t.id).toBeGreaterThanOrEqual(2);
      expect(t.sources.trim(), t.id).not.toBe('');
    }
  });

  it('каждая техника раздела режима есть в библиотеке', () => {
    for (const g of modes) {
      for (const id of g.techniques)
        expect(techniqueIds.has(id), `${g.modeId} → ${id}`).toBe(true);
    }
  });

  it('плашка короткая: цель в одну-две строки, 2–5 техник, 1–4 пункта между сессиями', () => {
    for (const g of modes) {
      expect(g.goal.trim(), g.modeId).not.toBe('');
      expect(g.goal.length, g.modeId).toBeLessThanOrEqual(160);
      expect(g.what.trim(), g.modeId).not.toBe('');
      expect(g.sources.trim(), g.modeId).not.toBe('');
      expect(g.techniques.length, g.modeId).toBeGreaterThanOrEqual(2);
      expect(g.techniques.length, g.modeId).toBeLessThanOrEqual(5);
      expect(new Set(g.techniques).size, g.modeId).toBe(g.techniques.length);
      expect(g.betweenSessions.length, g.modeId).toBeGreaterThanOrEqual(1);
      expect(g.betweenSessions.length, g.modeId).toBeLessThanOrEqual(4);
      for (const b of g.betweenSessions) {
        expect(b.title.trim(), g.modeId).not.toBe('');
        if (b.kind === 'custom')
          expect(b.text.trim(), `${g.modeId}: ${b.title}`).not.toBe('');
      }
    }
  });

  it('свой режим терапевта раздела не имеет — сайт показывает строку группы', () => {
    expect(modeGuide(tr, 'custom_mode_xyz')).toBeNull();
    expect(modeGuide(tr, 'vulnerable_child')?.modeId).toBe('vulnerable_child');
  });
});
