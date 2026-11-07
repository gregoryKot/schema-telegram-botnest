// Раздел «Для терапевта» «Справочника» (#995, шаг 4): разделы заполнены,
// ключи не повторяются — по ним строится список.
import { describe, it, expect } from 'vitest';
import { practiceNotes } from './index';
import type { Tr } from './types';

const ty: Tr = (t) => t;
const vy: Tr = (_t, v) => v;

describe.each([
  ['ты', ty],
  ['вы', vy],
])('«Для терапевта», форма «%s»', (_name, tr) => {
  const notes = practiceNotes(tr);

  it('есть разделы, ключи уникальны', () => {
    expect(notes.length).toBeGreaterThanOrEqual(4);
    expect(new Set(notes.map((n) => n.id)).size).toBe(notes.length);
  });

  it('у каждого раздела заголовок, 1–6 абзацев и источники', () => {
    for (const n of notes) {
      expect(n.id, n.title).toMatch(/^[a-z_]+$/);
      expect(n.title.trim(), n.id).not.toBe('');
      expect(n.paragraphs.length, n.id).toBeGreaterThanOrEqual(1);
      expect(n.paragraphs.length, n.id).toBeLessThanOrEqual(6);
      for (const p of n.paragraphs) expect(p.trim(), n.id).not.toBe('');
      expect(n.sources.trim(), n.id).not.toBe('');
    }
  });
});
