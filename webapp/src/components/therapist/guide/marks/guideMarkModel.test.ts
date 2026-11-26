import { describe, expect, it } from 'vitest';
import * as guide from '../../../../../../shared/src/schemaTherapy/guide';
import type { GuideMark } from '../../../../../../shared/src/therapy/guideMarks/guideMarksApi';
import { articleAddress, dropMark, isMarkableAddress, markCounts, findMark, markEntries, sameMark, upsertMark } from './guideMarkModel';

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

  it('фрагменты одного адреса живут рядом с разделом; тот же текст (с другими пробелами) — правка', () => {
    const addr = 'mode:vulnerable_child/goal';
    const whole = mark(1, addr);
    const frag = mark(2, addr, { fragment: true, snapshot: 'кусок  один' });
    let list = upsertMark([whole], frag);
    list = upsertMark(list, mark(3, addr, { fragment: true, snapshot: 'кусок два' }));
    list = upsertMark(list, { ...frag, note: 'правка', snapshot: ' кусок один ' });
    expect(list.map((m) => m.id)).toEqual([1, 2, 3]);
    expect(list[1].note).toBe('правка');
    expect(upsertMark(list, { ...whole, note: 'целиком' })[0].note).toBe('целиком');
    expect(sameMark(whole, addr, 'кусок один')).toBe(false);
    expect(findMark(list, addr)?.id).toBe(1);
    expect(findMark(list, addr, 'кусок   два')?.id).toBe(3);
  });

  it('фрагмент в блоке — его текст, «раздел изменился» ему не ставится', () => {
    const live = guide.listAddresses('schema').find((a) => a.endsWith('/inSession'))!;
    const [a, b] = markEntries([mark(1, live, { fragment: true, snapshot: 'выделено' }), mark(2, 'schema:subjugation/noSuchField', { fragment: true })], guide, tr);
    expect(a).toMatchObject({ text: 'выделено', fragment: true, changed: false });
    expect(b).toMatchObject({ fragment: true, changed: false });
  });
});
