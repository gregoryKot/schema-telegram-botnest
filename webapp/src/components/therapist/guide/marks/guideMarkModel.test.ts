import { describe, expect, it } from 'vitest';
import * as guide from '../../../../../../shared/src/schemaTherapy/guide';
import type { GuideMark } from '../../../../../../shared/src/therapy/guideMarks/guideMarksApi';
import { articleAddress, dropMark, isMarkableAddress, markCounts, markEntries, upsertMark } from './guideMarkModel';

const tr = (_ty: string, vy: string) => vy;
const mark = (id: number, address: string, extra: Partial<GuideMark> = {}): GuideMark => ({
  id, clientId: '7', address, note: null, snapshot: 'старый текст', createdAt: '', updatedAt: '', ...extra,
});

describe('guideMarkModel', () => {
  it('копинг схемы и чужая строка не отмечаются здесь, остальные разделы — да', () => {
    expect(isMarkableAddress('schema:subjugation/coping.surrender')).toBe(false);
    expect(isMarkableAddress('nonsense')).toBe(false);
    expect(isMarkableAddress(undefined)).toBe(false);
    expect(isMarkableAddress(articleAddress('schema', 'subjugation')('inSession'))).toBe(true);
  });

  it('повторная отметка того же адреса правит запись, а не плодит дубль; снятие убирает', () => {
    const a = mark(1, 'mode:vulnerable_child/goal');
    const list = upsertMark([a], { ...a, note: 'у Анны' });
    expect(list).toHaveLength(1);
    expect(list[0].note).toBe('у Анны');
    expect(upsertMark(list, mark(2, 'mode:vulnerable_child/stuck'))).toHaveLength(2);
    expect(dropMark(list, 1)).toEqual([]);
  });

  it('счётчик по статьям — ключ узла холста', () => {
    const counts = markCounts([
      mark(1, 'schema:subjugation/need'), mark(2, 'schema:subjugation/inSession'), mark(3, 'mode:vulnerable_child/goal'), mark(4, 'мусор'),
    ]);
    expect(counts.get('schema:subjugation')).toBe(2);
    expect(counts.get('mode:vulnerable_child')).toBe(1);
    expect(counts.size).toBe(2);
  });

  it('найденный раздел — текст справочника; исчезнувший — сохранённый текст и «раздел изменился»', () => {
    const live = guide.listAddresses('schema').find((a) => a.endsWith('/inSession'))!;
    const [found, gone] = markEntries([mark(1, live), mark(2, 'schema:subjugation/noSuchField')], guide, tr);
    expect(found.changed).toBe(false);
    expect(found.text).toBe(guide.resolveAddress(live, tr)!.text);
    expect(found.title).toContain('В кабинете');
    expect(gone).toMatchObject({ changed: true, text: 'старый текст' });
  });
});
