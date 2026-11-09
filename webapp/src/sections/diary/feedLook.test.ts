import { describe, it, expect } from 'vitest';
import { ENTITY_LOOK, modeGroupLook } from '../../../../shared/src/theme/entityLook';
import { buildEntries } from './diaryModel';
import { draftLook, entryLook, kindLook } from './feedLook';
import type { EntryKind } from './entryKind';

const at = '2026-10-15T09:00:00Z';
const [schema, thought] = buildEntries([
  { id: 1, createdAt: at, trigger: 't', emotions: [], schemaIds: ['abandonment'] },
  { id: 2, createdAt: '2026-10-15T08:00:00Z', trigger: 't', emotions: [], schemaIds: [] },
], [], []);
const [critic, found, own] = buildEntries([], [
  { id: 3, createdAt: '2026-10-15T12:00:00Z', modeId: 'punitive_critic', situation: 's' },
  { id: 4, createdAt: '2026-10-15T11:00:00Z', modeId: 'punitive_critic', situation: 's', fromCase: true },
  { id: 5, createdAt: '2026-10-15T10:00:00Z', modeId: 'my_own_mode', situation: 's' },
], []);
const grat = (items: string[]) => buildEntries([], [], [{ id: 6, date: '2026-10-15', items, createdAt: at }])[0];

describe('entryLook: знак и бумага по типу записи — из ENTITY_LOOK, а не один Pebbles на всех', () => {
  it('схема — Layers на глине, мысль — Pebbles на персике, разбор — Ribbon на шалфее', () => {
    expect(entryLook(schema)).toEqual({ hue: 28, sign: 'layers' });
    expect(entryLook(thought)).toEqual({ hue: 45, sign: 'pebbles' });
    expect(entryLook(found)).toEqual({ hue: ENTITY_LOOK.case.hue, sign: 'ribbon' });
  });

  it('режим — знак и бумага своей группы; режим без группы — общий знак режимов', () => {
    expect(entryLook(critic)).toEqual(modeGroupLook('critic'));
    expect(entryLook(own)).toEqual({ hue: 240, sign: 'cluster' });
  });

  it('благодарность — бирюза и камешков столько, сколько «спасибо» (не больше трёх)', () => {
    expect(entryLook(grat(['a']))).toEqual({ hue: 195, sign: 'pebbles', filled: 1 });
    expect(entryLook(grat(['a', 'b', 'c', 'd'])).filled).toBe(3);
  });

  it('у каждого типа знак есть, у соседних типов дневника — разная бумага', () => {
    const kinds: EntryKind[] = ['schema', 'thought', 'mode', 'case', 'gratitude', 'tracker'];
    for (const k of kinds) expect(kindLook(k).sign, k).toBeTruthy();
    expect(new Set(kinds.map((k) => kindLook(k).hue)).size).toBe(kinds.length);
  });
});

describe('draftLook: черновик — вид своего типа (раньше всегда бумага схем)', () => {
  it('схема, режим без выбора и режим с выбором, благодарность', () => {
    expect(draftLook('schema', { trigger: 'x' })).toEqual({ hue: 28, sign: 'layers' });
    expect(draftLook('mode', { situation: 'x' })).toEqual({ hue: 240, sign: 'cluster' });
    expect(draftLook('mode', { modeId: 'punitive_critic' })).toEqual(modeGroupLook('critic'));
    expect(draftLook('gratitude', { items: ['a', ' ', ''] })).toEqual({ hue: 195, sign: 'pebbles', filled: 1 });
  });

  it('битый черновик не роняет экран', () => {
    expect(draftLook('gratitude', null).filled).toBe(0);
    expect(draftLook('mode', { modeId: 42 }).sign).toBe('cluster');
  });
});
